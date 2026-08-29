const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const {
  RESERVATION_STATUS,
  PRODUCT_STATUS,
  SHOP_STATUS,
  SHOP_OPEN,
  NOTIFICATION_AUDIENCE,
  RESERVATION_CANCEL_REASON,
} = require("../constants");
const { applyTabFilterToQuery } = require("../utils/reservationTabFilter");
const {
  toPublicReservation,
  reserveVariantInventory,
  releaseVariantInventory,
  processReservationLifecycle,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  finalizeCompleted,
  finalizeBuyerForfeit,
  isBeforePickupTime,
  isPastPickupTime,
  isWithinDepositDecisionWindow,
} = require("./reservationService");
const {
  loadDisputesByReservationIds,
  disputeViewFromRecord,
} = require("../utils/reservationDisputeView");
const { isActiveDispute } = require("../utils/reservationCompat");
const { holdDepositToSystem, notifyWalletBalanceUpdated, getWalletBalance } = require("./walletService");
const { createNotification, NOTIFICATION_INDEX } = require("./notificationService");
const { emitOrderUpdated } = require("./orderRealtimeService");
const { loadActiveReviewsByReservationIds } = require("./buyerReviewService");
function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertPhoneVerifiedForTrade(user) {
  const phone = String(user?.Phone || "").trim();
  if (!/^\d{10}$/.test(phone)) {
    throw createServiceError(
      "Vui lòng thêm và xác minh số điện thoại trước khi giữ hàng.",
      403
    );
  }
  if (!User.isPhoneVerified(user)) {
    throw createServiceError(
      "Vui lòng xác minh số điện thoại trước khi giữ hàng.",
      403
    );
  }
}

function pickNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function pickString(value) {
  return String(value || "").trim();
}

async function validateProductAndShop(productId, variantId) {
  const product = await Product.findById(productId);
  if (!product || product.Status !== PRODUCT_STATUS.ACTIVE) {
    throw createServiceError("Sản phẩm không khả dụng.", 404);
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant || variant.ProductId?.toString() !== product._id.toString()) {
    throw createServiceError("Biến thể sản phẩm không hợp lệ.", 400);
  }
  if (variant.Status !== undefined && variant.Status !== 1) {
    throw createServiceError("Biến thể sản phẩm không khả dụng.", 400);
  }

  const shop = await ShopProfile.findById(product.ShopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw createServiceError("Cửa hàng không hoạt động.", 400);
  }
  const { isSubscriptionActive } = require("../constants");
  if (!isSubscriptionActive(shop)) {
    throw createServiceError("Cửa hàng chưa có gói bán hàng còn hiệu lực.", 400);
  }
  if (shop.isOpen !== SHOP_OPEN.OPEN) {
    throw createServiceError("Cửa hàng đang đóng cửa.", 400);
  }

  return { product, variant, shop };
}

async function notifyShopOwner(shop, { title, content }) {
  if (!shop?.userId) {
    return;
  }
  await createNotification(shop.userId, {
    title,
    content,
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
  });
}

async function createReservation(user, payload) {
  assertPhoneVerifiedForTrade(user);

  const productId = pickString(payload.productId);
  const variantId = pickString(payload.variantId);
  const quantity = pickNumber(payload.quantity) || 1;
  const note = pickString(payload.note);
  const pickupTimeRaw = payload.pickupTime ?? payload.pickup_time;

  if (!productId || !variantId) {
    throw createServiceError("Thiếu sản phẩm hoặc biến thể.");
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw createServiceError("Số lượng không hợp lệ.");
  }

  let pickupTime = null;
  if (pickupTimeRaw) {
    pickupTime = new Date(pickupTimeRaw);
    if (Number.isNaN(pickupTime.getTime())) {
      throw createServiceError("Thời gian nhận hàng không hợp lệ.");
    }
    if (pickupTime.getTime() <= Date.now()) {
      throw createServiceError("Thời gian nhận hàng phải ở tương lai.");
    }
  } else {
    throw createServiceError("Vui lòng chọn thời gian nhận hàng.");
  }

  const { product, variant, shop } = await validateProductAndShop(productId, variantId);
  const { resolveEscrowProtectionDaysForProduct } = require("../utils/escrowProtection");
  const soNgayKN = await resolveEscrowProtectionDaysForProduct(product._id);

  if ((variant.Quantity ?? 0) < quantity) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  const { getPromotionalUnitPrice } = require("./productPromotionService");
  const agreedPrice = getPromotionalUnitPrice(product, variant.Price);
  const depositPercent = Math.max(0, Math.min(100, Number(shop.cocTien ?? shop.depositPercent) || 0));
  const depositAmount =
    depositPercent > 0 ? Math.round((agreedPrice * quantity * depositPercent) / 100) : 0;
  const now = new Date();
  const session = await mongoose.startSession();

  try {
    let reservation;
    await session.withTransaction(async () => {
      await reserveVariantInventory(variant._id, quantity, session);

      reservation = await Reservation.create(
        [
          {
            userId: user._id,
            variantId: variant._id,
            shopId: shop._id,
            productId: product._id,
            pickupCode: require("../utils/reservationCompat").generatePickupCode(),
            quantity,
            reservedPrice: agreedPrice,
            pickupTime,
            note,
            status: RESERVATION_STATUS.PENDING,
            inventoryHeld: true,
            depositPercent,
            depositAmount,
            soNgayKN,
            tgGiaiCoc: null,
            cocChuyenDen: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
        { session }
      );
      reservation = reservation[0];

      if (depositAmount > 0) {
        await holdDepositToSystem(user._id, depositAmount, {
          description: `Cọc giữ hàng ${product.ProductName || ""}`.trim(),
          reservationId: reservation._id,
          session,
        });
        await reservation.save({ session });
      }
    });

    const depositNote =
      depositAmount > 0
        ? ` Đã cọc ${depositAmount.toLocaleString("vi-VN")}đ (${depositPercent}%) vào ví hệ thống.`
        : "";

    await notifyShopOwner(shop, {
      title: "Yêu cầu giữ hàng mới",
      content: `${user.FullName || user.UserName} yêu cầu giữ ${quantity} ${product.ProductName} — nhận lúc ${pickupTime.toLocaleString("vi-VN")}.${depositNote}`,
    });

    await createNotification(user._id, {
      title: "Đã gửi yêu cầu giữ hàng",
      content: `Yêu cầu giữ ${quantity} ${product.ProductName} đã gửi tới shop. Chờ shop xác nhận trước giờ lấy.${depositNote}`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
    });

    await emitOrderUpdated(reservation, { action: "created" });
    if (depositAmount > 0) {
      const wallet = await getWalletBalance(user._id);
      notifyWalletBalanceUpdated(user._id, wallet.balance, {
        reservationId: String(reservation._id),
      });
    }
    return toPublicReservation(reservation);
  } finally {
    session.endSession();
  }
}

async function listBuyerReservations(user, { tab = "pending", search, page, limit } = {}) {
  await processReservationLifecycle();
  const reservationQuery = { userId: user._id };
  const tabKey = applyTabFilterToQuery(reservationQuery, tab);

  const { listReservationsWithSearch } = require("../utils/reservationSearch");

  return listReservationsWithSearch({
    reservationQuery,
    tab: tabKey,
    search,
    page,
    limit,
    searchRole: "buyer",
    mapReservation: async (doc) => {
      const reservationId = String(doc._id);
      const activeReviewByReservation = await loadActiveReviewsByReservationIds(
        [doc._id],
        user._id
      );
      const disputesMap = await loadDisputesByReservationIds([doc._id]);
      const publicReservation = await toPublicReservation(doc, {
        activeReview: activeReviewByReservation.get(reservationId) || null,
        disputeRecord: disputesMap.get(reservationId) || null,
      });
      return {
        ...publicReservation,
        shopId: doc.shopId ? String(doc.shopId) : publicReservation.shopId || "",
      };
    },
  });
}

async function listBuyerOrders(user, { tab = "pending", search, page, limit } = {}) {
  const result = await listBuyerReservations(user, { tab, search, page, limit });
  return { tab, ...result };
}

async function getBuyerReservation(user, reservationId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  const activeReviewByReservation = await loadActiveReviewsByReservationIds(
    [reservation._id],
    user._id
  );
  const disputeRecord = await loadDisputesByReservationIds([reservation._id]).then(
    (map) => map.get(String(reservation._id)) || null
  );
  const product = reservation.productId
    ? await Product.findById(reservation.productId).select("ProductName").lean()
    : null;
  const { loadAdjustmentsForReservation } = require("./reservationAdjustmentService");
  const adjustments = await loadAdjustmentsForReservation(reservation._id, {
    productName: product?.ProductName || "",
  });
  const { loadWalletTransactionsForReservation } = require("./walletService");
  const walletTransactions = await loadWalletTransactionsForReservation(reservation._id);
  const publicReservation = await toPublicReservation(reservation, {
    activeReview: activeReviewByReservation.get(String(reservation._id)) || null,
    disputeRecord,
    adjustments,
    walletTransactions,
  });
  return {
    ...publicReservation,
    shopId: reservation.shopId ? String(reservation.shopId) : publicReservation.shopId || "",
  };
}

async function cancelReservationByBuyer(user, reservationId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const now = new Date();

  if (reservation.status === RESERVATION_STATUS.WAITING_PICKUP) {
    if (!isBeforePickupTime(reservation, now)) {
      throw createServiceError(
        "Đã quá giờ nhận hàng. Bạn không thể hủy — hãy dùng khiếu nại hoặc đồng ý mất cọc.",
        403
      );
    }
    if (isActiveDispute(reservation)) {
      throw createServiceError("Không thể hủy đơn đang tranh chấp.", 403);
    }
    reservation.status = RESERVATION_STATUS.CANCELLED;
    reservation.cancelledAt = now;
    reservation.cancelType = RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING;
    await releaseVariantInventory(reservation);
    const shop = await ShopProfile.findById(reservation.shopId);
    if (shop) {
      await releaseDepositIfHeld(reservation, shop);
    }
    reservation.updatedAt = now;
    await reservation.save();

    await notifyShopOwner(shop, {
      title: "Khách hủy giữ hàng",
      content: `${user.FullName || user.UserName} đã hủy đơn giữ hàng. Cọc đã chuyển vào ví shop.`,
    });

    await createNotification(user._id, {
      title: "Bạn đã hủy đơn giữ hàng",
      content: "Đơn giữ hàng đã bị hủy. Cọc đã chuyển vào ví shop theo quy định.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.ORDER,
    });

    await emitOrderUpdated(reservation, { action: "buyer_cancelled_holding" });
    return toPublicReservation(reservation);
  }

  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Không thể hủy đơn ở trạng thái này.");
  }

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelType = RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  await releaseVariantInventory(reservation);
  await refundDepositIfHeld(reservation);
  reservation.updatedAt = now;
  await reservation.save();

  const shop = await ShopProfile.findById(reservation.shopId);
  await notifyShopOwner(shop, {
    title: "Khách hủy giữ hàng",
    content: `${user.FullName || user.UserName} đã hủy yêu cầu giữ hàng.`,
  });

  await createNotification(user._id, {
    title: "Bạn đã hủy yêu cầu giữ hàng",
    content: "Yêu cầu giữ hàng đã bị hủy. Tiền cọc (nếu có) đã hoàn về ví của bạn.",
    audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
  });

  await emitOrderUpdated(reservation, { action: "buyer_cancelled_pending" });
  return toPublicReservation(reservation);
}

/** Luồng cũ (buyer quét QR shop) — đã thay bằng seller quét QR đơn. */
async function confirmReceivedByBuyer(user, reservationId) {
  throw createServiceError(
    "Vui lòng đưa mã QR đơn hàng cho shop quét để xác nhận giao hàng.",
    410
  );
}

/** Luồng cũ — buyer quét QR shop (deprecated). */
async function validateShopQrScan(user, reservationId, scannedShopId) {
  throw createServiceError(
    "Vui lòng mở mã QR đơn hàng và đưa cho shop quét.",
    410
  );
}

/** Buyer báo cáo / khiếu nại — pickup-time (Report) hoặc sau giao (ReservationDispute). */
async function reportReservationByBuyer(user, reservationId, payload = {}) {
  const { reason, description, images, videos } = payload || {};
  const reservationDisputeService = require("./reservationDisputeService");
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.PICKUP_CONFIRMED ||
    status === RESERVATION_STATUS.COMPLETED
  ) {
    return reservationDisputeService.buyerPostDeliveryComplaint(user, {
      reservationId,
      reason,
      description: description || reason,
      images,
      videos,
    });
  }
  return reservationDisputeService.buyerReportSeller(user, {
    reservationId,
    description: description || reason,
    reason,
    images,
  });
}

/**
 * Buyer đồng ý mất cọc sau quá giờ nhận (trong 48h).
 * Giải ngân SystemWallet → Seller, đơn chuyển tab Đã hủy.
 */
async function forfeitDepositByBuyer(user, reservationId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const status = Number(reservation.status);
  if (
    status !== RESERVATION_STATUS.WAITING_PICKUP &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError(
      "Chỉ đồng ý mất cọc khi đơn đang chờ nhận hàng / tranh chấp và đã quá giờ."
    );
  }
  if (!isPastPickupTime(reservation)) {
    throw createServiceError("Chưa tới giờ nhận hàng — không thể mất cọc.", 403);
  }
  if (
    !isWithinDepositDecisionWindow(reservation) &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError(
      "Đã quá 48 giờ sau giờ nhận hàng. Cọc đã (hoặc sẽ) chuyển cho người bán theo mặc định.",
      403
    );
  }
  if (
    Number(reservation.cocChuyenDen) === 1 ||
    Number(reservation.cocChuyenDen) === 2 ||
    reservation.tgGiaiCoc ||
    reservation.depositReleasedAt ||
    reservation.depositRefundedAt
  ) {
    throw createServiceError("Cọc đã được xử lý trước đó.", 400);
  }

  if (status === RESERVATION_STATUS.DISPUTED) {
    const disputes = await loadDisputesByReservationIds([reservation._id]);
    const disputeView = disputeViewFromRecord(
      disputes.get(String(reservation._id)) || null
    );
    if (disputeView.disputeByBuyer) {
      throw createServiceError(
        "Bạn đã gửi báo cáo tranh chấp. Không thể đồng ý mất cọc.",
        403
      );
    }
  }

  const shop = await ShopProfile.findById(reservation.shopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }

  const now = new Date();
  const result = await finalizeBuyerForfeit(reservation, shop, { now });

  try {
    const ReservationDispute = require("../models/ReservationDispute");
    const { RESERVATION_DISPUTE_STATUS } = require("../constants");
    const dispute = await ReservationDispute.findOne({ reservationId: reservation._id });
    if (dispute) {
      dispute.status = RESERVATION_DISPUTE_STATUS.SELLER_WIN;
      dispute.adminNote = "Buyer đồng ý mất cọc.";
      dispute.resolvedAt = now;
      dispute.updatedAt = now;
      await dispute.save();
    }
  } catch (error) {
    console.warn("forfeitDepositByBuyer close dispute:", error.message);
  }

  if (shop.userId) {
    await createNotification(shop.userId, {
      title: "Nhận cọc giữ hàng",
      content: `${user.FullName || user.UserName} đã đồng ý mất cọc sau giờ nhận hàng. Cọc đã vào ví của bạn.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await createNotification(user._id, {
    title: "Bạn đã đồng ý mất cọc",
    content: "Bạn đã đồng ý mất cọc sau giờ nhận hàng. Cọc đã chuyển vào ví người bán.",
    audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
  });

  return result;
}

module.exports = {
  createReservation,
  listBuyerReservations,
  listBuyerOrders,
  getBuyerReservation,
  cancelReservationByBuyer,
  confirmReceivedByBuyer,
  validateShopQrScan,
  reportReservationByBuyer,
  forfeitDepositByBuyer,
};
