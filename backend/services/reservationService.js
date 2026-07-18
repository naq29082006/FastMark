const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const crypto = require("crypto");
const {
  RESERVATION_STATUS,
  BUYER_CANCEL_LOCK_MINUTES,
} = require("../constants/reservationStatus");
const { createNotification } = require("./notificationService");
const { NOTIFICATION_AUDIENCE } = require("../constants/notificationAudience");
const { getShopForSeller } = require("./shopSettingsService");
const { creditWalletRefund } = require("./walletService");

const NO_SHOW_CANCEL_REASON = "Người mua không đến lấy hàng";
const SHOP_UNCONFIRMED_CANCEL_REASON = "Do shop chưa xác nhận đơn hàng";
const SHOP_CANCEL_REASON = "Shop hủy";
const BUYER_CANCEL_REASON = "Người mua hủy đơn";
const PICKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function generatePickupCode(length = 6) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    code += PICKUP_CODE_ALPHABET[bytes[i] % PICKUP_CODE_ALPHABET.length];
  }
  return code;
}

function buildPickupQrPayload(reservationId, pickupCode) {
  return `FM|PICKUP|${String(reservationId)}|${String(pickupCode || "").toUpperCase()}`;
}

function parsePickupScanPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return { reservationId: "", pickupCode: "" };
  }

  const pipeMatch = text.match(/^FM\|PICKUP\|([a-f\d]{24})\|([A-Z0-9]{4,12})$/i);
  if (pipeMatch) {
    return {
      reservationId: pipeMatch[1],
      pickupCode: pipeMatch[2].toUpperCase(),
    };
  }

  // Cho phép shop nhập tay chỉ mã 6 ký tự.
  if (/^[A-Z0-9]{4,12}$/i.test(text) && !/^[a-f\d]{24}$/i.test(text)) {
    return { reservationId: "", pickupCode: text.toUpperCase() };
  }

  if (/^[a-f\d]{24}$/i.test(text)) {
    return { reservationId: text, pickupCode: "" };
  }

  return { reservationId: "", pickupCode: text.toUpperCase() };
}

async function ensurePickupCode(reservation) {
  if (
    reservation.status !== RESERVATION_STATUS.CONFIRMED &&
    reservation.status !== RESERVATION_STATUS.COMPLETED
  ) {
    return reservation;
  }

  if (reservation.pickupCode) {
    return reservation;
  }

  reservation.pickupCode = generatePickupCode(6);
  reservation.UpdatedAt = new Date();
  await reservation.save();
  return reservation;
}

function computeTotal(reservation) {
  const price = Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0;
  const quantity = Number(reservation.quantity) || 0;
  return price * quantity;
}

async function refundDepositIfPaid(reservation) {
  if (!reservation?.depositPaidAt || !(Number(reservation.depositAmount) > 0)) {
    return;
  }
  if (!reservation.userId) {
    return;
  }
  await creditWalletRefund(reservation.userId, reservation.depositAmount, {
    description: `Hoàn cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
  });
}

async function toPublicReservation(doc) {
  const [buyer, product, variant, shop] = await Promise.all([
    User.findById(doc.userId),
    Product.findById(doc.productId),
    ProductVariant.findById(doc.variantId),
    doc.shopId ? ShopProfile.findById(doc.shopId) : null,
  ]);

  return {
    id: doc._id,
    orderCode: `ID: ${String(doc._id).slice(-8).toUpperCase()}`,
    status: doc.status,
    quantity: doc.quantity || 0,
    reservedPrice: doc.reservedPrice || 0,
    agreedPrice: doc.agreedPrice ?? doc.reservedPrice ?? 0,
    totalAmount: computeTotal(doc),
    pickupTime: doc.pickupTime || null,
    note: doc.note || "",
    confirmedAt: doc.confirmedAt || null,
    completedAt: doc.completedAt || null,
    cancelledAt: doc.cancelledAt || null,
    cancelReason: doc.cancelReason || "",
    buyerPriceAcceptedAt: doc.buyerPriceAcceptedAt || null,
    cancelLockedAt: doc.cancelLockedAt || null,
    buyerCancelLocked: doc.cancelLockedAt ? new Date() >= new Date(doc.cancelLockedAt) : false,
    depositRequired: Boolean(doc.depositRequired),
    depositPercent: Number(doc.depositPercent) || 0,
    depositAmount: Number(doc.depositAmount) || 0,
    depositPaidAt: doc.depositPaidAt || null,
    depositTxnId: doc.depositTxnId ? String(doc.depositTxnId) : null,
    voucherCode: doc.voucherCode || "",
    discountAmount: Number(doc.discountAmount) || 0,
    pickupCode: doc.pickupCode || "",
    qrPayload:
      doc.pickupCode &&
      (doc.status === RESERVATION_STATUS.CONFIRMED ||
        doc.status === RESERVATION_STATUS.COMPLETED)
        ? buildPickupQrPayload(doc._id, doc.pickupCode)
        : "",
    createdAt: doc.CreatedAt,
    updatedAt: doc.UpdatedAt,
    shopId: doc.shopId ? String(doc.shopId) : "",
    storeName: shop?.shopName || shop?.description || "",
    buyer: buyer
      ? {
          id: buyer._id,
          fullName: buyer.FullName || "",
          phone: buyer.Phone || "",
          userName: buyer.UserName || "",
          avatar: buyer.Avatar || "",
        }
      : null,
    product: product
      ? {
          id: product._id,
          productName: product.ProductName || "",
          thumbnail: product.Thumbnail || "",
        }
      : null,
    variant: variant
      ? {
          id: variant._id,
          variantName: variant.VariantName || "",
          price: variant.Price || 0,
        }
      : null,
  };
}

async function getOwnedReservation(user, reservationId) {
  const shop = await getShopForSeller(user);
  const reservation = await Reservation.findOne({ _id: reservationId, shopId: shop._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  return { shop, reservation };
}

async function reserveVariantInventory(variantId, quantity, session = null) {
  const normalizedQuantity = Number(quantity) || 1;
  const now = new Date();
  const query = ProductVariant.findOneAndUpdate(
    { _id: variantId, Quantity: { $gte: normalizedQuantity } },
    { $inc: { Quantity: -normalizedQuantity }, $set: { UpdatedAt: now } },
    { new: true }
  );

  const updatedVariant = session ? await query.session(session) : await query;
  if (!updatedVariant) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  return updatedVariant;
}

async function releaseVariantInventory(reservation, session = null) {
  if (!reservation?.inventoryHeld || !reservation.variantId) {
    return;
  }

  const quantity = Number(reservation.quantity) || 1;
  const now = new Date();
  const query = ProductVariant.findByIdAndUpdate(
    reservation.variantId,
    { $inc: { Quantity: quantity }, $set: { UpdatedAt: now } }
  );

  if (session) {
    await query.session(session);
  } else {
    await query;
  }

  reservation.inventoryHeld = false;
}

async function markReservationSold(reservation, session = null) {
  const soldQuantity = Number(reservation.quantity) || 1;
  const now = new Date();

  if (reservation.productId) {
    const productQuery = Product.findByIdAndUpdate(
      reservation.productId,
      { $inc: { SoldCount: soldQuantity }, $set: { UpdatedAt: now } }
    );
    if (session) {
      await productQuery.session(session);
    } else {
      await productQuery;
    }
  }

  if (reservation.variantId) {
    const variantQuery = ProductVariant.findByIdAndUpdate(
      reservation.variantId,
      { $inc: { SoldCount: soldQuantity }, $set: { UpdatedAt: now } }
    );
    if (session) {
      await variantQuery.session(session);
    } else {
      await variantQuery;
    }
  }

  reservation.inventoryHeld = false;
}

async function listSellerReservations(user, { tab = "holding" } = {}) {
  await expireOverdueReservations();
  const shop = await getShopForSeller(user);
  let statusFilter = [];

  switch (tab) {
    case "holding":
      statusFilter = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];
      break;
    case "cancelled":
      statusFilter = [RESERVATION_STATUS.CANCELLED];
      break;
    case "completed":
      statusFilter = [RESERVATION_STATUS.COMPLETED];
      break;
    default:
      statusFilter = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];
  }

  const reservations = await Reservation.find({
    shopId: shop._id,
    status: { $in: statusFilter },
  })
    .sort({ UpdatedAt: -1 })
    .limit(100);

  return Promise.all(reservations.map(toPublicReservation));
}

async function getSellerReservationDetail(user, reservationId) {
  await expireOverdueReservations();
  const { reservation } = await getOwnedReservation(user, reservationId);
  await ensurePickupCode(reservation);
  return toPublicReservation(reservation);
}

async function confirmReservation(user, reservationId) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể xác nhận đơn đang chờ.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CONFIRMED;
  reservation.confirmedAt = now;
  reservation.agreedPrice = reservation.agreedPrice ?? reservation.reservedPrice;
  reservation.pickupCode = reservation.pickupCode || generatePickupCode(6);
  reservation.UpdatedAt = now;
  await reservation.save();

  return toPublicReservation(reservation);
}

async function rejectReservation(user, reservationId, { reason } = {}) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
    throw createServiceError(
      "Đơn đã được xác nhận giữ hàng. Shop không thể hủy đơn này nữa.",
      403
    );
  }
  if ([RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.CANCELLED].includes(reservation.status)) {
    throw createServiceError("Không thể từ chối đơn này.");
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể từ chối đơn đang chờ xác nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelReason = String(reason || "").trim() || SHOP_CANCEL_REASON;
  await releaseVariantInventory(reservation);
  await refundDepositIfPaid(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  return toPublicReservation(reservation);
}

async function cancelReservationBySeller(user, reservationId, { reason } = {}) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
    throw createServiceError(
      "Đơn đã được xác nhận giữ hàng. Shop không thể hủy đơn này nữa.",
      403
    );
  }
  if (reservation.status === RESERVATION_STATUS.COMPLETED) {
    throw createServiceError("Đơn đã hoàn thành, không thể hủy.");
  }
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    throw createServiceError("Đơn đã được hủy.");
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể hủy đơn đang chờ xác nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelReason = String(reason || "").trim() || SHOP_CANCEL_REASON;
  await releaseVariantInventory(reservation);
  await refundDepositIfPaid(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  return toPublicReservation(reservation);
}

async function completeReservation(user, reservationId) {
  const { reservation, shop } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    throw createServiceError("Chỉ xác nhận hoàn thành khi đơn đã được chấp nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.COMPLETED;
  reservation.completedAt = now;
  reservation.UpdatedAt = now;

  const soldQuantity = Number(reservation.quantity) || 1;
  shop.soldCount = (shop.soldCount || 0) + soldQuantity;
  shop.UpdatedAt = now;
  await shop.save();

  await markReservationSold(reservation);
  await reservation.save();

  return toPublicReservation(reservation);
}

async function completeReservationByScan(user, rawPayload) {
  const shop = await getShopForSeller(user);
  const parsed = parsePickupScanPayload(rawPayload);

  let reservation = null;
  if (parsed.reservationId) {
    reservation = await Reservation.findOne({
      _id: parsed.reservationId,
      shopId: shop._id,
    });
  } else if (parsed.pickupCode) {
    reservation = await Reservation.findOne({
      shopId: shop._id,
      pickupCode: parsed.pickupCode,
      status: RESERVATION_STATUS.CONFIRMED,
    }).sort({ UpdatedAt: -1 });
  }

  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn khớp mã quét.", 404);
  }

  if (parsed.pickupCode && reservation.pickupCode) {
    if (String(reservation.pickupCode).toUpperCase() !== parsed.pickupCode) {
      throw createServiceError("Mã nhận hàng không khớp.", 400);
    }
  }

  if (!reservation.pickupCode && parsed.pickupCode) {
    throw createServiceError("Đơn chưa có mã nhận hàng.", 400);
  }

  return completeReservation(user, reservation._id);
}

async function expireOverdueReservations() {
  const now = new Date();
  const overdue = await Reservation.find({
    status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED] },
    pickupTime: { $ne: null, $lte: now },
  }).limit(200);

  let cancelledCount = 0;

  for (const reservation of overdue) {
    try {
      const product = await Product.findById(reservation.productId);
      const shop = await ShopProfile.findById(reservation.shopId);
      const productName = product?.ProductName || "sản phẩm";

      const wasPending = reservation.status === RESERVATION_STATUS.PENDING;
      const cancelReason = wasPending
        ? SHOP_UNCONFIRMED_CANCEL_REASON
        : NO_SHOW_CANCEL_REASON;

      reservation.status = RESERVATION_STATUS.CANCELLED;
      reservation.cancelledAt = now;
      reservation.cancelReason = cancelReason;
      await releaseVariantInventory(reservation);
      await refundDepositIfPaid(reservation);
      reservation.UpdatedAt = now;
      await reservation.save();
      cancelledCount += 1;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã bị hủy",
          content: wasPending
            ? `Đơn giữ ${productName} đã bị hủy vì quá giờ lấy hàng (${SHOP_UNCONFIRMED_CANCEL_REASON.toLowerCase()}).`
            : `Đơn giữ ${productName} đã bị hủy vì quá giờ lấy hàng (${NO_SHOW_CANCEL_REASON.toLowerCase()}).`,
          audience: NOTIFICATION_AUDIENCE.BUYER,
        });
      }

      if (shop?.userId) {
        await createNotification(shop.userId, {
          title: "Đơn giữ hàng hết hạn",
          content: wasPending
            ? `Đơn giữ ${productName} đã tự hủy vì shop chưa xác nhận trước giờ lấy. Tồn kho đã được cộng lại.`
            : `Đơn giữ ${productName} đã tự hủy vì khách không đến lấy. Tồn kho đã được cộng lại.`,
          audience: NOTIFICATION_AUDIENCE.SELLER,
        });
      }
    } catch (error) {
      console.error("expireOverdueReservations failed:", reservation._id, error.message);
    }
  }

  return { cancelledCount, checkedAt: now };
}

module.exports = {
  listSellerReservations,
  getSellerReservationDetail,
  confirmReservation,
  rejectReservation,
  cancelReservationBySeller,
  completeReservation,
  completeReservationByScan,
  toPublicReservation,
  ensurePickupCode,
  computeTotal,
  reserveVariantInventory,
  releaseVariantInventory,
  markReservationSold,
  expireOverdueReservations,
  NO_SHOW_CANCEL_REASON,
  SHOP_UNCONFIRMED_CANCEL_REASON,
  SHOP_CANCEL_REASON,
  BUYER_CANCEL_REASON,
};
