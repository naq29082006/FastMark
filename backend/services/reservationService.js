const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const Report = require("../models/Report");
const ReservationDispute = require("../models/ReservationDispute");
const {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  RESERVATION_DISPUTE_WINDOW_HOURS,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
  NOTIFICATION_AUDIENCE,
  DEPOSIT_SETTLE_TO,
  DEPOSIT_SETTLE_TO_LABEL,
  REPORT_STATUS,
  MAX_SELLER_CANCEL_IMAGES,
  RESERVATION_CANCEL_REASON,
  RESERVATION_TAB_STATUS_MAP,
  getReservationReasonLabels,
} = require("../constants");
const { createNotification, NOTIFICATION_INDEX } = require("./notificationService");
const { emitOrderUpdated } = require("./orderRealtimeService");
const { getShopForSeller } = require("./shopSettingsService");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const {
  refundDepositFromSystem,
  releaseDepositFromSystem,
} = require("./walletService");
const { normalizeImageUrls } = require("./reportService");
const {
  buildPickupQrPayload,
  buildOrderCode,
  parsePickupQrPayload,
} = require("../utils/pickupQr");
const {
  finalizeReceivedBySeller,
  processEscrowAutoReleases,
} = require("./reservationEscrowService");
const { PAYMENT_STATUS, BUYER_COMPLAINT_REASON_OPTIONS } = require("../constants");
const { formatEscrowProtectionLabel } = require("../utils/escrowProtection");
const {
  disputeViewFromRecord,
  loadDisputeForReservation,
  loadDisputesByReservationIds,
} = require("../utils/reservationDisputeView");
const { isPostDeliveryDispute } = require("../utils/postDeliveryDispute");
const {
  getReservationBuyerId,
  getReservationSellerId,
  reservationHasReview,
  reservationHasDispute,
  getReservationCreatedAt,
  getReservationUpdatedAt,
} = require("../utils/reservationCompat");

const PICKUP_REMINDER_MS = 15 * 60 * 1000;
const MIN_PICKUP_LEAD_MS = 15 * 60 * 1000;

const SHOP_CANCEL_REASON = "Shop hủy";
const BUYER_CANCEL_REASON = "Người mua hủy đơn";
const SHOP_REJECT_REASON = "Shop từ chối giữ hàng";
const SHOP_UNCONFIRMED_CANCEL_REASON =
  "Quá giờ lấy hàng — người bán không xác nhận đơn";
const SHOP_CANCEL_AFTER_ACCEPT_REASON = "Shop hủy sau khi xác nhận giữ hàng";

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveShopDisplayFields(shop, owner) {
  return {
    storeName: resolveShopDisplayName(shop, owner),
    shopUsername: resolveShopUsername(shop, owner),
  };
}

/** Hỗ trợ doc cũ (Released/Refunded) lẫn schema mới (Settled). */
function resolveDepositSettleTo(doc) {
  const raw = Number(doc?.depositSettleTo);
  if (raw === DEPOSIT_SETTLE_TO.BUYER || raw === DEPOSIT_SETTLE_TO.SELLER) {
    return raw;
  }
  if (doc?.depositRefundedAt) return DEPOSIT_SETTLE_TO.BUYER;
  if (doc?.depositReleasedAt) return DEPOSIT_SETTLE_TO.SELLER;
  return DEPOSIT_SETTLE_TO.NONE;
}

function resolvePaymentStatusFromSettleTo(doc) {
  const settleTo = resolveDepositSettleTo(doc);
  if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
    return PAYMENT_STATUS.REFUNDED;
  }
  if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
    return PAYMENT_STATUS.RELEASED;
  }
  return PAYMENT_STATUS.ESCROW;
}

function resolveDepositSettledAt(doc) {
  if (doc?.depositSettledAt) return doc.depositSettledAt;
  if (doc?.depositRefundedAt) return doc.depositRefundedAt;
  if (doc?.depositReleasedAt) return doc.depositReleasedAt;
  return null;
}

function isDepositSettled(doc) {
  return resolveDepositSettleTo(doc) !== DEPOSIT_SETTLE_TO.NONE;
}

function isDepositHeld(doc) {
  return (
    Boolean(doc?.depositPaidAt) &&
    !isDepositSettled(doc) &&
    Number(doc?.depositAmount) > 0
  );
}

function markDepositSettled(reservation, settleTo, at = new Date()) {
  reservation.depositSettledAt = at;
  reservation.depositSettleTo = settleTo;
}

function computeTotal(reservation) {
  const price = Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0;
  const quantity = Number(reservation.quantity) || 0;
  return price * quantity;
}

function computeReviewDeadline(pickupTime, fromDate = new Date()) {
  const pickup = pickupTime ? new Date(pickupTime) : null;
  const base =
    pickup && Number.isFinite(pickup.getTime()) ? pickup : new Date(fromDate);
  return new Date(base.getTime() + RESERVATION_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
}

/** Alias: thời điểm auto-release cọc = pickupTime + 24h. */
function computeAutoReleaseAt(pickupTime, fromDate = new Date()) {
  return computeReviewDeadline(pickupTime, fromDate);
}

function isBeforePickupTime(reservation, now = new Date()) {
  if (!reservation?.pickupTime) {
    return true;
  }
  const pickup = new Date(reservation.pickupTime);
  return !Number.isFinite(pickup.getTime()) || now.getTime() < pickup.getTime();
}

function isPastPickupTime(reservation, now = new Date()) {
  if (!reservation?.pickupTime) {
    return false;
  }
  const pickup = new Date(reservation.pickupTime);
  return Number.isFinite(pickup.getTime()) && now.getTime() >= pickup.getTime();
}

/** Hạn khiếu nại / auto giải ngân = escrowReleaseAt (ưu tiên) hoặc field legacy. */
function getDepositDecisionDeadline(reservation) {
  if (reservation?.escrowReleaseAt) {
    const d = new Date(reservation.escrowReleaseAt);
    if (Number.isFinite(d.getTime())) return d;
  }
  if (reservation?.autoReleaseAt) {
    const d = new Date(reservation.autoReleaseAt);
    if (Number.isFinite(d.getTime())) return d;
  }
  if (reservation?.reviewDeadlineAt) {
    const d = new Date(reservation.reviewDeadlineAt);
    if (Number.isFinite(d.getTime())) return d;
  }
  if (reservation?.pickupTime) {
    return computeReviewDeadline(reservation.pickupTime);
  }
  return null;
}

function isWithinDepositDecisionWindow(reservation, now = new Date()) {
  const deadline = getDepositDecisionDeadline(reservation);
  if (!deadline) {
    return false;
  }
  return now.getTime() < deadline.getTime();
}

/** Shop đã quét QR giao hàng — COMPLETED mới, RECEIVED data cũ. */
function isPostDeliveryStatus(status) {
  const code = Number(status);
  return (
    code === RESERVATION_STATUS.COMPLETED || code === RESERVATION_STATUS.RECEIVED
  );
}

function buildActionFlags(doc, now = new Date(), disputeView = null) {
  const dv = disputeView || disputeViewFromRecord(null);
  const status = Number(doc.status);
  const beforePickup = isBeforePickupTime(doc, now);
  const pastPickup = isPastPickupTime(doc, now);
  const withinDecisionWindow = isWithinDepositDecisionWindow(doc, now);
  const depositHeld = isDepositHeld(doc);
  const waitingOrDisputed =
    status === RESERVATION_STATUS.WAITING_PICKUP || status === RESERVATION_STATUS.DISPUTED;
  const hasDispute = Boolean(doc.hasDispute || doc.disputed || dv.hasDispute);
  const postDelivery = isPostDeliveryStatus(status);
  const reviewed = reservationHasReview(doc);

  const canPostPickupDepositActions =
    waitingOrDisputed && pastPickup && (withinDecisionWindow || status === RESERVATION_STATUS.DISPUTED);

  return {
    canCancel:
      (status === RESERVATION_STATUS.PENDING && beforePickup) ||
      (status === RESERVATION_STATUS.WAITING_PICKUP && beforePickup && !hasDispute),
    canCancelAccepted:
      status === RESERVATION_STATUS.WAITING_PICKUP && !hasDispute,
    canShowPickupQr: status === RESERVATION_STATUS.WAITING_PICKUP,
    canScanPickupQr: status === RESERVATION_STATUS.WAITING_PICKUP,
    canScanShopQr: false,
    canConfirmReceived: false,
    canReportShop:
      postDelivery &&
      withinDecisionWindow &&
      !hasDispute &&
      !dv.disputeByBuyer &&
      status !== RESERVATION_STATUS.DISPUTED,
    canComplaint:
      postDelivery &&
      withinDecisionWindow &&
      !hasDispute &&
      !dv.disputeByBuyer &&
      status !== RESERVATION_STATUS.DISPUTED,
    canReview:
      postDelivery &&
      !reviewed &&
      status !== RESERVATION_STATUS.DISPUTED &&
      !hasDispute,
    canForfeitDeposit:
      canPostPickupDepositActions &&
      !dv.disputeByBuyer &&
      (depositHeld || !doc.depositPaidAt) &&
      !isDepositSettled(doc),
    canReportBuyer: canPostPickupDepositActions && !dv.disputeBySeller,
    canRefundDisputeDeposit:
      status === RESERVATION_STATUS.DISPUTED &&
      !dv.disputeBySeller &&
      !isDepositSettled(doc),
    canDispute: waitingOrDisputed && pastPickup && !hasDispute,
    canSellerRespondToComplaint: Boolean(dv.canSellerRespondToComplaint),
    awaitingAdminDisputeReview: Boolean(dv.awaitingAdminReview),
    disputeKind: dv.disputeKind || "",
    isPostDeliveryDispute: Boolean(dv.isPostDeliveryDispute),
    sellerResponseDeadlineAt: dv.sellerResponseDeadlineAt || null,
    sellerRespondedAt: dv.sellerRespondedAt || null,
    sellerResponse: dv.sellerResponse || null,
    depositDecisionDeadline: getDepositDecisionDeadline(doc),
    withinDepositDecisionWindow: Boolean(
      (postDelivery && withinDecisionWindow) ||
        (waitingOrDisputed && pastPickup && withinDecisionWindow)
    ),
  };
}

async function refundDepositIfHeld(reservation) {
  if (!reservation?.depositPaidAt || !(Number(reservation.depositAmount) > 0)) {
    return null;
  }
  if (isDepositSettled(reservation)) {
    return null;
  }
  if (!reservation.userId) {
    return null;
  }

  const result = await refundDepositFromSystem(
    reservation.userId,
    reservation.depositAmount,
    {
      description: `Hoàn cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
      reservationId: reservation._id,
    }
  );
  markDepositSettled(reservation, DEPOSIT_SETTLE_TO.BUYER);
  return result;
}

async function releaseDepositIfHeld(reservation, shop) {
  if (!reservation?.depositPaidAt || !(Number(reservation.depositAmount) > 0)) {
    return null;
  }
  if (isDepositSettled(reservation)) {
    return null;
  }
  if (!shop?.userId) {
    throw createServiceError("Không tìm thấy chủ shop để nhận cọc.", 400);
  }

  const result = await releaseDepositFromSystem(shop.userId, reservation.depositAmount, {
    description: `Giải phóng cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
    reservationId: reservation._id,
  });
  markDepositSettled(reservation, DEPOSIT_SETTLE_TO.SELLER);
  return result;
}

async function closePendingReservationReports(reservationId, decision, note, now = new Date()) {
  await closePendingDisputeReports(reservationId, { decision, note, processedAt: now });
}

async function toPublicReservation(doc, extras = {}) {
  const activeReview = extras.activeReview || null;
  const activeReviewId = String(
    activeReview?.id || extras.activeReviewId || ""
  ).trim();
  const disputeRecord =
    extras.disputeRecord !== undefined
      ? extras.disputeRecord
      : await loadDisputeForReservation(doc._id);
  const disputeView = disputeViewFromRecord(disputeRecord);
  const buyerId = getReservationBuyerId(doc);
  const [buyer, product, variant, shop] = await Promise.all([
    buyerId ? User.findById(buyerId) : null,
    Product.findById(doc.productId),
    ProductVariant.findById(doc.variantId),
    doc.shopId ? ShopProfile.findById(doc.shopId) : null,
  ]);
  const shopOwner = shop?.userId
    ? await User.findById(shop.userId).select("FullName UserName Avatar Phone")
    : null;
  const { storeName, shopUsername } = resolveShopDisplayFields(shop, shopOwner);
  const shopAvatar = resolveShopAvatar(shop, shopOwner);
  const shopPhone = String(shopOwner?.Phone || "").trim();

  const { loadProductImages, toPublicProductImages } = require("./productService");
  const imageDocs = product?._id ? await loadProductImages(product._id) : [];
  const thumbnails = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  const legacyThumbs = Array.isArray(product?.Thumbnail)
    ? product.Thumbnail.filter(Boolean)
    : product?.Thumbnail
      ? [product.Thumbnail]
      : [];
  const productThumbnails = thumbnails.length > 0 ? thumbnails : legacyThumbs;

  const now = new Date();
  const actions = buildActionFlags(doc, now, disputeView);
  const reasonLabels = getReservationReasonLabels(doc);

  const disputeExpireAt =
    doc.escrowReleaseAt || doc.reviewDeadlineAt || doc.autoReleaseAt || null;
  const orderCode = buildOrderCode(doc._id);
  const pickupCode = doc.pickupCode || orderCode.slice(-6);
  const pickupQrPayload =
    Number(doc.status) === RESERVATION_STATUS.WAITING_PICKUP
      ? buildPickupQrPayload({
          reservationId: doc._id,
          orderCode,
          buyerId,
        })
      : "";

  return {
    id: doc._id,
    orderCode,
    pickupCode,
    status: doc.status,
    statusLabel: RESERVATION_STATUS_LABEL[doc.status] || "Không rõ",
    quantity: doc.quantity || 0,
    reservedPrice: doc.reservedPrice || 0,
    agreedPrice: doc.agreedPrice ?? doc.reservedPrice ?? 0,
    totalAmount: computeTotal(doc),
    pickupTime: doc.pickupTime || null,
    note: doc.note || "",
    sellerConfirmedAt: doc.sellerConfirmedAt || null,
    reviewDeadlineAt: disputeExpireAt,
    autoReleaseAt: disputeExpireAt,
    escrowReleaseAt: disputeExpireAt,
    deliveredAt: doc.completedAt || null,
    disputeExpireAt,
    completedAt: doc.completedAt || null,
    confirmedAt: doc.sellerConfirmedAt || null,
    escrowProtectionDays: doc.escrowProtectionDays ?? null,
    paymentStatus: resolvePaymentStatusFromSettleTo(doc),
    disputed: reservationHasDispute(doc) || disputeView.hasDispute,
    hasDispute: reservationHasDispute(doc) || disputeView.hasDispute,
    pickupQrPayload,
    hasReviewed: reservationHasReview(doc),
    hasReview: reservationHasReview(doc),
    hasActiveReview: Boolean(activeReviewId),
    buyerReviewId: activeReviewId,
    buyerReview: activeReview,
    cancelledAt: doc.cancelledAt || null,
    cancelReason: doc.cancelReason || "",
    cancelNote: doc.cancelNote || "",
    reasonCode: reasonLabels.reasonCode,
    reasonLabelBuyer: reasonLabels.buyer,
    reasonLabelSeller: reasonLabels.seller,
    cancelledBy: doc.cancelledBy || "",
    cancelledBySellerAfterAccept: Boolean(doc.cancelledBySellerAfterAccept),
    sellerCancelImages: Array.isArray(doc.sellerCancelImages)
      ? doc.sellerCancelImages.filter(Boolean)
      : [],
    depositPercent: Number(doc.depositPercent) || 0,
    depositAmount: Number(doc.depositAmount) || 0,
    // Suy ra từ %/số tiền (không lưu field riêng).
    depositRequired:
      (Number(doc.depositPercent) || 0) > 0 || (Number(doc.depositAmount) || 0) > 0,
    depositPaidAt: doc.depositPaidAt || null,
    depositSettledAt: resolveDepositSettledAt(doc),
    depositSettleTo: resolveDepositSettleTo(doc),
    depositSettleToLabel:
      DEPOSIT_SETTLE_TO_LABEL[resolveDepositSettleTo(doc)] || "Không rõ",
    // Alias tương thích UI cũ.
    depositReleasedAt:
      resolveDepositSettleTo(doc) === DEPOSIT_SETTLE_TO.SELLER
        ? resolveDepositSettledAt(doc)
        : null,
    depositRefundedAt:
      resolveDepositSettleTo(doc) === DEPOSIT_SETTLE_TO.BUYER
        ? resolveDepositSettledAt(doc)
        : null,
    disputeByBuyer: disputeView.disputeByBuyer,
    disputeBySeller: disputeView.disputeBySeller,
    disputeReason: disputeView.disputeReason,
    disputeReasonLabel: disputeView.disputeReasonLabel,
    disputeDescription: disputeView.disputeDescription,
    disputedAt: disputeView.disputedAt,
    disputeFirstBy: disputeView.disputeFirstBy,
    buyerDisputedAt: disputeView.buyerDisputedAt,
    sellerDisputedAt: disputeView.sellerDisputedAt,
    disputeKind: disputeView.disputeKind || "",
    isPostDeliveryDispute: Boolean(disputeView.isPostDeliveryDispute),
    sellerResponseDeadlineAt: disputeView.sellerResponseDeadlineAt || null,
    sellerRespondedAt: disputeView.sellerRespondedAt || null,
    sellerResponse: disputeView.sellerResponse || null,
    awaitingAdminDisputeReview: Boolean(disputeView.awaitingAdminReview),
    depositDecisionDeadline: actions.depositDecisionDeadline || null,
    withinDepositDecisionWindow: Boolean(actions.withinDepositDecisionWindow),
    createdAt: getReservationCreatedAt(doc),
    updatedAt: getReservationUpdatedAt(doc),
    shopId: doc.shopId ? String(doc.shopId) : "",
    buyerId: buyerId ? String(buyerId) : "",
    sellerId: getReservationSellerId(doc)
      ? String(getReservationSellerId(doc))
      : shopOwner?._id
        ? String(shopOwner._id)
        : "",
    storeName,
    shopUsername,
    shop: shop
      ? {
          id: String(shop._id),
          shopName: storeName,
          shopUsername,
          avatar: shopAvatar,
          phone: shopPhone,
        }
      : null,
    ...actions,
    isPastPickup: isPastPickupTime(doc, now),
    buyer: buyer
      ? {
          id: buyer._id,
          fullName: buyer.FullName || "",
          phone: buyer.Phone || "",
          userName: buyer.UserName || "",
          avatar: buyer.Avatar || "",
          email: buyer.Email || "",
        }
      : null,
    product: product
      ? {
          id: product._id,
          productName: product.ProductName || "",
          thumbnail: productThumbnails[0] || "",
          thumbnails: productThumbnails,
        }
      : null,
    variant: variant
      ? {
          id: variant._id,
          variantName: variant.VariantName || "",
          price: variant.Price || 0,
          imageUrl: variant.ImageUrl || variant.Images?.[0]?.ImageUrl || "",
        }
      : null,
    remainingAmount: Math.max(0, computeTotal(doc) - (Number(doc.depositAmount) || 0)),
    cashDue: Math.max(0, computeTotal(doc) - (Number(doc.depositAmount) || 0)),
    adjustments: Array.isArray(extras.adjustments) ? extras.adjustments : [],
    walletTransactions: Array.isArray(extras.walletTransactions) ? extras.walletTransactions : [],
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
    { returnDocument: "after" }
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

async function listSellerReservations(user, { tab = "pending", search, page, limit } = {}) {
  await processReservationLifecycle();
  const shop = await getShopForSeller(user);
  let statusFilter = null;

  switch (tab) {
    case "all":
      statusFilter = RESERVATION_TAB_STATUS_MAP.all;
      break;
    case "pending":
    case "awaiting":
    case "awaiting_confirm":
      statusFilter = RESERVATION_TAB_STATUS_MAP.pending;
      break;
    case "holding":
      statusFilter = RESERVATION_TAB_STATUS_MAP.holding;
      break;
    case "dispute":
      statusFilter = RESERVATION_TAB_STATUS_MAP.dispute;
      break;
    case "cancelled":
      statusFilter = RESERVATION_TAB_STATUS_MAP.cancelled;
      break;
    case "completed":
      statusFilter = RESERVATION_TAB_STATUS_MAP.completed;
      break;
    default:
      statusFilter = RESERVATION_TAB_STATUS_MAP.holding;
  }

  const reservationQuery = { shopId: shop._id };
  if (statusFilter) {
    reservationQuery.status = { $in: statusFilter };
  }

  const { listReservationsWithSearch } = require("../utils/reservationSearch");

  return listReservationsWithSearch({
    reservationQuery,
    tab,
    search,
    page,
    limit,
    searchRole: "seller",
    mapReservation: async (doc) => {
      const disputesMap = await loadDisputesByReservationIds([doc._id]);
      return toPublicReservation(doc, {
        disputeRecord: disputesMap.get(String(doc._id)) || null,
      });
    },
  });
}

async function getSellerReservationDetail(user, reservationId) {
  await processReservationLifecycle();
  const { reservation } = await getOwnedReservation(user, reservationId);
  const { loadActiveReviewsByReservationIds } = require("./buyerReviewService");
  const { loadAdjustmentsForReservation } = require("./reservationAdjustmentService");
  const activeReviewByReservation = await loadActiveReviewsByReservationIds([
    reservation._id,
  ]);
  const disputeRecord = await loadDisputeForReservation(reservation._id);
  const product = reservation.productId
    ? await Product.findById(reservation.productId).select("ProductName").lean()
    : null;
  const adjustments = await loadAdjustmentsForReservation(reservation._id, {
    productName: product?.ProductName || "",
  }).then((rows) =>
    rows.map((row) => ({
      ...row,
      productName: row.productName || product?.ProductName || "",
    }))
  );
  const { loadWalletTransactionsForReservation } = require("./walletService");
  const walletTransactions = await loadWalletTransactionsForReservation(reservation._id);
  return toPublicReservation(reservation, {
    activeReview: activeReviewByReservation.get(String(reservation._id)) || null,
    disputeRecord,
    adjustments,
    walletTransactions,
  });
}

/** Seller đồng ý giữ hàng → WaitingPickup. */
async function confirmReservation(user, reservationId) {
  const { shop, reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể đồng ý đơn đang chờ xác nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.WAITING_PICKUP;
  reservation.sellerConfirmedAt = now;
  reservation.agreedPrice = reservation.agreedPrice ?? reservation.reservedPrice;
  const releaseAt = computeAutoReleaseAt(reservation.pickupTime, now);
  reservation.reviewDeadlineAt = releaseAt;
  reservation.autoReleaseAt = releaseAt;
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop đã đồng ý giữ hàng",
      content: "Đơn giữ hàng đã được xác nhận. Hãy đến nhận trước giờ lấy và bấm Đã nhận hàng.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Bạn đã xác nhận đơn giữ hàng",
      content: "Đơn đã chuyển sang chờ khách nhận hàng. Hãy chuẩn bị hàng trước giờ lấy.",
      audience: NOTIFICATION_AUDIENCE.SELLER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await emitOrderUpdated(reservation, { action: "confirmed" });
  return toPublicReservation(reservation);
}

/** Seller từ chối → Rejected + hoàn cọc. */
async function rejectReservation(user, reservationId, { reason } = {}) {
  const { shop, reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status === RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError(
      "Đơn đã được đồng ý giữ hàng. Hãy dùng Hủy đơn (cần lý do và ảnh chứng minh).",
      403
    );
  }
  if (
    [
      RESERVATION_STATUS.COMPLETED,
      RESERVATION_STATUS.COMPLETED,
      RESERVATION_STATUS.DISPUTED,
      RESERVATION_STATUS.CANCELLED,
      RESERVATION_STATUS.REJECTED,
      RESERVATION_STATUS.CANCELLED,
    ].includes(reservation.status)
  ) {
    throw createServiceError("Không thể từ chối đơn này.");
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể từ chối đơn đang chờ xác nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.REJECTED;
  reservation.cancelledAt = now;
  reservation.cancelledBy = "seller_reject";
  reservation.cancelledBySellerAfterAccept = false;
  reservation.cancelReason = RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  await releaseVariantInventory(reservation);
  await refundDepositIfHeld(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop từ chối giữ hàng",
      content: "Yêu cầu giữ hàng bị từ chối. Tiền cọc đã hoàn về ví của bạn.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Bạn đã từ chối đơn giữ hàng",
      content: "Yêu cầu giữ hàng đã bị từ chối. Tiền cọc đã hoàn về ví người mua.",
      audience: NOTIFICATION_AUDIENCE.SELLER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await emitOrderUpdated(reservation, { action: "rejected" });
  return toPublicReservation(reservation);
}

/**
 * Seller hủy sau khi đã xác nhận (WaitingPickup):
 * bắt buộc lý do cụ thể + 1–5 ảnh → REFUNDED + hoàn cọc + thông báo buyer.
 */
async function cancelAcceptedReservationBySeller(
  user,
  reservationId,
  { reason, images } = {}
) {
  const { shop, reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError(
      "Chỉ có thể hủy đơn đã xác nhận khi đang chờ nhận hàng.",
      400
    );
  }
  if (reservation.disputed) {
    throw createServiceError(
      "Đơn đang có báo cáo tranh chấp. Không thể hủy theo cách này.",
      403
    );
  }

  const cancelReason = String(reason || "").trim();
  if (cancelReason.length < 5) {
    throw createServiceError(
      "Vui lòng nhập lý do hủy cụ thể (ít nhất 5 ký tự).",
      400
    );
  }

  const imageList = Array.isArray(images) ? images : [];
  if (!imageList.length) {
    throw createServiceError("Vui lòng đính kèm ít nhất 1 ảnh chứng minh.", 400);
  }
  if (imageList.length > MAX_SELLER_CANCEL_IMAGES) {
    throw createServiceError(
      `Tối đa ${MAX_SELLER_CANCEL_IMAGES} ảnh chứng minh khi hủy đơn.`,
      400
    );
  }

  const imageUrls = await normalizeImageUrls(imageList);
  if (!imageUrls.length) {
    throw createServiceError("Vui lòng đính kèm ít nhất 1 ảnh chứng minh.", 400);
  }

  const now = new Date();
  const pastPickup = isPastPickupTime(reservation, now);
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelledBy = "seller_after_accept";
  reservation.cancelledBySellerAfterAccept = true;
  reservation.cancelReason = pastPickup
    ? RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
    : RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  reservation.cancelNote = cancelReason || SHOP_CANCEL_AFTER_ACCEPT_REASON;
  reservation.sellerCancelImages = imageUrls;
  await releaseVariantInventory(reservation);
  await refundDepositIfHeld(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop đã hủy đơn giữ hàng",
      content: `Shop đã hủy đơn sau khi xác nhận. Lý do: ${reservation.cancelNote}. Tiền cọc đã được hoàn về ví của bạn.`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Bạn đã hủy đơn giữ hàng",
      content: `Đơn đã hủy. Lý do: ${reservation.cancelNote}. Tiền cọc đã hoàn về ví người mua.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await emitOrderUpdated(reservation, { action: "seller_cancelled" });
  return toPublicReservation(reservation);
}

async function closePendingDisputeReports(reservationId, { decision, note, processedBy = null } = {}) {
  const dispute = await ReservationDispute.findOne({ reservationId });
  if (!dispute) {
    return;
  }
  const now = new Date();
  dispute.adminNote = String(note || "").trim() || dispute.adminNote;
  if (processedBy) {
    dispute.resolvedBy = processedBy;
  }
  dispute.resolvedAt = now;
  dispute.updatedAt = now;
  await dispute.save();
}

/**
 * Seller tự hoàn cọc khi đơn đang tranh chấp (shop thừa nhận sai).
 */
async function refundDisputeDepositBySeller(user, reservationId) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (Number(reservation.status) !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Chỉ có thể hoàn cọc khi đơn đang tranh chấp.", 400);
  }
  const disputeRecord = await loadDisputeForReservation(reservation._id);
  const disputeView = disputeViewFromRecord(disputeRecord);
  if (disputeView.disputeBySeller) {
    throw createServiceError(
      "Bạn đã gửi báo cáo tranh chấp. Không thể hoàn cọc cho người mua.",
      403
    );
  }
  if (isDepositSettled(reservation)) {
    throw createServiceError("Tiền cọc đã được xử lý.", 400);
  }

  const now = new Date();
  const pastPickup = isPastPickupTime(reservation, now);

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelledBy = "seller_after_accept";
  reservation.cancelledBySellerAfterAccept = true;
  reservation.cancelReason = pastPickup
    ? RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
    : RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  reservation.cancelNote = "Shop tự hoàn cọc trong tranh chấp.";
  reservation.UpdatedAt = now;
  await reservation.save();

  await closePendingDisputeReports(reservation._id, {
    decision: "approve_buyer",
    note: "Shop tự hoàn cọc cho người mua.",
    processedBy: user._id,
  });

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop đã hoàn cọc",
      content:
        "Shop đã hoàn cọc trong tranh chấp. Tiền cọc đã được hoàn về ví của bạn.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await emitOrderUpdated(reservation, { action: "seller_refund_dispute" });
  return toPublicReservation(reservation);
}

async function cancelReservationBySeller(
  user,
  reservationId,
  { reason, images } = {}
) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status === RESERVATION_STATUS.WAITING_PICKUP) {
    return cancelAcceptedReservationBySeller(user, reservationId, {
      reason,
      images,
    });
  }

  return rejectReservation(user, reservationId, {
    reason: String(reason || "").trim() || SHOP_CANCEL_REASON,
  });
}

/** Seller không được hoàn tất / xác nhận nhận hàng. */
async function completeReservation() {
  throw createServiceError(
    "Shop không thể hoàn tất đơn. Buyer bấm Đã nhận hàng hoặc hệ thống tự hoàn tất sau hạn báo cáo.",
    403
  );
}

async function finalizeCompleted(
  reservation,
  shop,
  {
    status,
    now = new Date(),
    reasonCode = RESERVATION_CANCEL_REASON.BUYER_RECEIVED,
  } = {}
) {
  reservation.status = status;
  reservation.completedAt = now;
  reservation.cancelReason = reasonCode;
  reservation.UpdatedAt = now;
  await releaseDepositIfHeld(reservation, shop);

  const soldQuantity = Number(reservation.quantity) || 1;
  shop.soldCount = (shop.soldCount || 0) + soldQuantity;
  shop.UpdatedAt = now;
  await shop.save();
  await markReservationSold(reservation);
  await reservation.save();
  await emitOrderUpdated(reservation, { action: "completed" });
  return toPublicReservation(reservation);
}

/**
 * Buyer đồng ý mất cọc — đơn hủy (không hoàn thành), cọc chuyển seller, trả tồn kho.
 */
async function finalizeBuyerForfeit(reservation, shop, { now = new Date() } = {}) {
  await releaseDepositIfHeld(reservation, shop);
  await releaseVariantInventory(reservation);
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelledBy = "buyer";
  reservation.cancelReason = RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
  reservation.completedAt = null;
  reservation.UpdatedAt = now;
  await reservation.save();
  await emitOrderUpdated(reservation, { action: "buyer_forfeit" });
  return toPublicReservation(reservation);
}

async function repairMislabeledForfeitReservation(reservation, now = new Date()) {
  const shop = await ShopProfile.findById(reservation.shopId);
  if (!shop) {
    return false;
  }

  const soldQuantity = Number(reservation.quantity) || 1;

  if (reservation.completedAt) {
    shop.soldCount = Math.max(0, (shop.soldCount || 0) - soldQuantity);
    shop.UpdatedAt = now;
    await shop.save();
  }

  if (reservation.productId) {
    await Product.findByIdAndUpdate(reservation.productId, {
      $inc: { SoldCount: -soldQuantity },
      $set: { UpdatedAt: now },
    });
  }
  if (reservation.variantId) {
    await ProductVariant.findByIdAndUpdate(reservation.variantId, {
      $inc: { SoldCount: -soldQuantity, Quantity: soldQuantity },
      $set: { UpdatedAt: now },
    });
  }

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = reservation.cancelledAt || reservation.completedAt || now;
  reservation.cancelledBy = reservation.cancelledBy || "buyer";
  reservation.cancelReason =
    reservation.cancelReason || RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
  reservation.completedAt = null;
  reservation.inventoryHeld = false;
  reservation.UpdatedAt = now;
  await reservation.save();
  return true;
}

/**
 * Job: nhắc buyer + seller trước giờ nhận 15 phút.
 * Bỏ qua nếu khoảng cách đặt → nhận <= 15 phút.
 */
async function sendPickupReminders() {
  const now = new Date();
  const reminderWindowEnd = new Date(now.getTime() + PICKUP_REMINDER_MS);
  let sentCount = 0;

  const reservations = await Reservation.find({
    status: RESERVATION_STATUS.WAITING_PICKUP,
    pickupTime: { $gt: now, $lte: reminderWindowEnd },
    pickupReminderSentAt: null,
  })
    .select("userId shopId productId pickupTime CreatedAt")
    .limit(200)
    .lean();

  for (const reservation of reservations) {
    try {
      const pickup = new Date(reservation.pickupTime);
      const placedAt = new Date(reservation.CreatedAt);
      if (!Number.isFinite(pickup.getTime())) {
        continue;
      }

      const leadMs = pickup.getTime() - placedAt.getTime();
      const marked = await Reservation.findOneAndUpdate(
        { _id: reservation._id, pickupReminderSentAt: null },
        { $set: { pickupReminderSentAt: now, UpdatedAt: now } }
      );
      if (!marked) {
        continue;
      }

      if (leadMs <= MIN_PICKUP_LEAD_MS) {
        continue;
      }

      const product = reservation.productId
        ? await Product.findById(reservation.productId).select("ProductName").lean()
        : null;
      const productName = product?.ProductName || "sản phẩm";
      const pickupLabel = pickup.toLocaleString("vi-VN");
      const buyerContent = `Đơn giữ ${productName} sắp đến giờ nhận (${pickupLabel}). Hãy đến shop đúng giờ.`;
      const sellerContent = `Đơn giữ ${productName} sắp đến giờ giao (${pickupLabel}). Hãy chuẩn bị giao dịch với khách.`;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Sắp đến giờ nhận hàng",
          content: buyerContent,
          audience: NOTIFICATION_AUDIENCE.BUYER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }

      const shop = reservation.shopId
        ? await ShopProfile.findById(reservation.shopId).select("userId").lean()
        : null;
      if (shop?.userId) {
        await createNotification(shop.userId, {
          title: "Sắp đến giờ giao hàng",
          content: sellerContent,
          audience: NOTIFICATION_AUDIENCE.SELLER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }

      sentCount += 1;
    } catch (error) {
      console.warn("[pickup-reminder] failed:", reservation._id, error?.message || error);
    }
  }

  return { sentCount };
}

/**
 * Job: (1) Pending quá pickupTime → Rejected + hoàn cọc
 *      (2) Hết hạn phản hồi (= pickupTime + 24h):
 *          - Chỉ buyer báo cáo → hoàn cọc cho buyer
 *          - Buyer không báo cáo → release cọc cho seller
 *          - Cả hai báo cáo → giữ cọc chờ admin
 */
async function processReservationLifecycle() {
  const now = new Date();
  let cancelledCount = 0;
  let autoCompletedCount = 0;
  let buyerRefundedCount = 0;
  let sellerReleasedCount = 0;

  try {
    const escrowResult = await processEscrowAutoReleases();
    autoCompletedCount += Number(escrowResult?.releasedCount) || 0;
    sellerReleasedCount += Number(escrowResult?.releasedCount) || 0;
  } catch (error) {
    console.error("[processReservationLifecycle] escrow job failed:", error.message);
  }

  // Sửa data cũ: đơn tranh chấp bị gắn nhầm COMPLETED/AUTO_COMPLETED/RECEIVED.
  const mislabeledDisputes = await Reservation.find({
    status: {
      $in: [
        RESERVATION_STATUS.RECEIVED,
        RESERVATION_STATUS.COMPLETED,
        RESERVATION_STATUS.COMPLETED,
      ],
    },
    $or: [{ disputed: true }, { status: RESERVATION_STATUS.DISPUTED }],
  }).limit(200);

  for (const reservation of mislabeledDisputes) {
    try {
      const settleTo = resolveDepositSettleTo(reservation);
      reservation.status =
        settleTo === DEPOSIT_SETTLE_TO.BUYER
          ? RESERVATION_STATUS.CANCELLED
          : RESERVATION_STATUS.CANCELLED;
      reservation.cancelledAt =
        reservation.cancelledAt || reservation.completedAt || now;
      reservation.completedAt = null;
      if (!reservation.cancelReason) {
        reservation.cancelReason =
          settleTo === DEPOSIT_SETTLE_TO.BUYER
            ? "Đã xử lý tranh chấp: hoàn cọc người mua."
            : "Đã xử lý tranh chấp: đền cọc người bán.";
      }
      reservation.UpdatedAt = now;
      await reservation.save();
      await emitOrderUpdated(reservation, { action: "lifecycle_repair" });
    } catch (error) {
      console.error(
        "processReservationLifecycle repair disputed status failed:",
        reservation._id,
        error.message
      );
    }
  }

  const mislabeledForfeits = await Reservation.find({
    status: {
      $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED],
    },
    cancelReason: RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  }).limit(200);

  for (const reservation of mislabeledForfeits) {
    try {
      await repairMislabeledForfeitReservation(reservation, now);
    } catch (error) {
      console.error(
        "processReservationLifecycle repair forfeit status failed:",
        reservation._id,
        error.message
      );
    }
  }

  const overduePending = await Reservation.find({
    status: RESERVATION_STATUS.PENDING,
    pickupTime: { $ne: null, $lte: now },
  }).limit(200);

  for (const reservation of overduePending) {
    try {
      const product = await Product.findById(reservation.productId);
      const shop = await ShopProfile.findById(reservation.shopId);
      const productName = product?.ProductName || "sản phẩm";

      reservation.status = RESERVATION_STATUS.REJECTED;
      reservation.cancelledAt = now;
      reservation.cancelledBy = "system";
      reservation.cancelReason = RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
      await releaseVariantInventory(reservation);
      await refundDepositIfHeld(reservation);
      reservation.UpdatedAt = now;
      await reservation.save();
      await emitOrderUpdated(reservation, { action: "lifecycle_timeout_pending" });
      cancelledCount += 1;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã hủy",
          content: `Đơn giữ ${productName} bị hủy vì shop chưa xác nhận trước giờ lấy. Cọc đã hoàn về ví.`,
          audience: NOTIFICATION_AUDIENCE.BUYER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }
      if (shop?.userId) {
        await createNotification(shop.userId, {
          title: "Đơn giữ hàng hết hạn",
          content: `Đơn giữ ${productName} tự hủy vì chưa xác nhận trước giờ lấy.`,
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
    });
      }
    } catch (error) {
      console.error("processReservationLifecycle pending failed:", reservation._id, error.message);
    }
  }

  // Xử lý cọc khi hết 24 giờ phản hồi, gồm cả đơn đã có báo cáo một phía.
  const dueDepositDecision = await Reservation.find({
    status: {
      $in: [RESERVATION_STATUS.WAITING_PICKUP, RESERVATION_STATUS.DISPUTED],
    },
    $or: [
      { autoReleaseAt: { $ne: null, $lte: now } },
      { reviewDeadlineAt: { $ne: null, $lte: now } },
    ],
  }).limit(200);

  const disputeMap = await loadDisputesByReservationIds(
    dueDepositDecision.map((row) => row._id)
  );

  for (const reservation of dueDepositDecision) {
    try {
      const disputeView = disputeViewFromRecord(
        disputeMap.get(String(reservation._id)) || null
      );
      const disputeRecord = disputeMap.get(String(reservation._id)) || null;

      if (disputeRecord && isPostDeliveryDispute(disputeRecord, reservation)) {
        continue;
      }

      if (disputeView.disputeByBuyer && disputeView.disputeBySeller) {
        // Cả hai báo cáo → giữ cọc chờ admin xử lý, không tự động giải ngân.
        continue;
      }

      if (disputeView.disputeByBuyer) {
        if (
          isDepositSettled(reservation) &&
          resolveDepositSettleTo(reservation) !== DEPOSIT_SETTLE_TO.BUYER
        ) {
          continue;
        }
        await refundDepositIfHeld(reservation);
        await releaseVariantInventory(reservation);
        reservation.status = RESERVATION_STATUS.CANCELLED;
        reservation.cancelledAt = now;
        reservation.cancelledBy = "system";
        reservation.cancelReason = RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN;
        reservation.UpdatedAt = now;
        await reservation.save();
        await emitOrderUpdated(reservation, { action: "lifecycle_auto_buyer_win" });
        await closePendingReservationReports(
          reservation._id,
          "auto_buyer_win",
          "Người bán không phản hồi trong thời hạn 24 giờ.",
          now
        );
        buyerRefundedCount += 1;

        if (reservation.userId) {
          await createNotification(reservation.userId, {
            title: "Đã hoàn cọc giữ hàng",
            content:
              "Shop không phản hồi báo cáo trong 24 giờ. Cọc đã được hoàn về ví của bạn.",
            audience: NOTIFICATION_AUDIENCE.BUYER,
            index: NOTIFICATION_INDEX.ORDER,
          });
        }
        const reportedShop = await ShopProfile.findById(reservation.shopId);
        if (reportedShop?.userId) {
          await createNotification(reportedShop.userId, {
            title: "Đơn báo cáo đã tự động xử lý",
            content:
              "Bạn không phản hồi báo cáo của người mua trong 24 giờ. Cọc đã hoàn cho người mua.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
    });
        }
        continue;
      }

      // Seller đã báo buyer không đến và buyer không phản hồi: seller nhận cọc, hàng về kho.
      if (disputeView.disputeBySeller) {
        const shop = await ShopProfile.findById(reservation.shopId);
        if (!shop) {
          continue;
        }
        await releaseDepositIfHeld(reservation, shop);
        await releaseVariantInventory(reservation);
        reservation.status = RESERVATION_STATUS.CANCELLED;
        reservation.cancelledAt = now;
        reservation.cancelledBy = "system";
        reservation.cancelReason = RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN;
        reservation.UpdatedAt = now;
        await reservation.save();
        await emitOrderUpdated(reservation, { action: "lifecycle_auto_seller_win" });
        await closePendingReservationReports(
          reservation._id,
          "auto_seller_win",
          "Người mua không phản hồi trong thời hạn 24 giờ.",
          now
        );
        sellerReleasedCount += 1;

        if (reservation.userId) {
          await createNotification(reservation.userId, {
            title: "Đã xử lý báo cáo giữ hàng",
            content:
              "Bạn không phản hồi báo cáo trong 24 giờ. Cọc đã được chuyển cho người bán.",
            audience: NOTIFICATION_AUDIENCE.BUYER,
            index: NOTIFICATION_INDEX.ORDER,
          });
        }
        if (shop.userId) {
          await createNotification(shop.userId, {
            title: "Đã nhận cọc giữ hàng",
            content:
              "Người mua không phản hồi báo cáo trong 24 giờ. Cọc đã được chuyển vào ví của bạn.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
    });
        }
        continue;
      }

      // Đã settle cọc rồi → đồng bộ trạng thái (idempotent).
      // Có tranh chấp thì không được gắn "Hoàn thành".
      if (isDepositSettled(reservation)) {
        if (
          Number(reservation.status) === RESERVATION_STATUS.COMPLETED ||
          Number(reservation.status) === RESERVATION_STATUS.COMPLETED
        ) {
          if (reservation.disputed || disputeView.hasDispute) {
            const settleTo = resolveDepositSettleTo(reservation);
            reservation.status =
              settleTo === DEPOSIT_SETTLE_TO.BUYER
                ? RESERVATION_STATUS.CANCELLED
                : RESERVATION_STATUS.CANCELLED;
            reservation.cancelledAt = reservation.cancelledAt || reservation.completedAt || now;
            reservation.completedAt = null;
            if (!reservation.cancelReason) {
              reservation.cancelReason =
                settleTo === DEPOSIT_SETTLE_TO.BUYER
                  ? "Đã xử lý tranh chấp: hoàn cọc người mua."
                  : "Đã xử lý tranh chấp: đền cọc người bán.";
            }
            reservation.UpdatedAt = now;
            await reservation.save();
            await emitOrderUpdated(reservation, { action: "lifecycle_deposit_sync" });
          } else if (!reservation.completedAt) {
            reservation.completedAt = now;
            reservation.UpdatedAt = now;
            await reservation.save();
            await emitOrderUpdated(reservation, { action: "lifecycle_completed_sync" });
          }
        } else if (
          Number(reservation.status) === RESERVATION_STATUS.WAITING_PICKUP ||
          Number(reservation.status) === RESERVATION_STATUS.DISPUTED
        ) {
          if (reservation.disputed || disputeView.hasDispute) {
            const settleTo = resolveDepositSettleTo(reservation);
            reservation.status =
              settleTo === DEPOSIT_SETTLE_TO.BUYER
                ? RESERVATION_STATUS.CANCELLED
                : RESERVATION_STATUS.CANCELLED;
            reservation.cancelledAt = reservation.cancelledAt || now;
            if (!reservation.cancelReason) {
              reservation.cancelReason =
                settleTo === DEPOSIT_SETTLE_TO.BUYER
                  ? "Đã xử lý tranh chấp: hoàn cọc người mua."
                  : "Đã xử lý tranh chấp: đền cọc người bán.";
            }
          } else {
            reservation.status = RESERVATION_STATUS.COMPLETED;
            reservation.completedAt = now;
            autoCompletedCount += 1;

            const product = reservation.productId
              ? await Product.findById(reservation.productId).select("ProductName").lean()
              : null;
            const productName = product?.ProductName || "sản phẩm";
            const shop = reservation.shopId
              ? await ShopProfile.findById(reservation.shopId).select("userId").lean()
              : null;

            if (reservation.userId) {
              await createNotification(reservation.userId, {
                title: "Đơn giữ hàng hoàn thành",
                content: `Đơn giữ ${productName} đã tự hoàn thành sau thời hạn xử lý.`,
                audience: NOTIFICATION_AUDIENCE.BUYER,
                index: NOTIFICATION_INDEX.ORDER,
              });
            }
            if (shop?.userId) {
              await createNotification(shop.userId, {
                title: "Đơn giữ hàng hoàn thành",
                content: `Đơn giữ ${productName} đã tự hoàn thành. Cọc đã vào ví của bạn.`,
                audience: NOTIFICATION_AUDIENCE.SELLER,
                index: NOTIFICATION_INDEX.ORDER,
              });
            }
          }
          reservation.UpdatedAt = now;
          await reservation.save();
          await emitOrderUpdated(reservation, { action: "lifecycle_auto_complete" });
        }
        continue;
      }

      // Không ai báo cáo trong 24h → hủy, cọc chuyển seller (không tính hoàn thành).
      const shop = await ShopProfile.findById(reservation.shopId);
      if (!shop) {
        continue;
      }
      await releaseDepositIfHeld(reservation, shop);
      await releaseVariantInventory(reservation);
      reservation.status = RESERVATION_STATUS.CANCELLED;
      reservation.cancelledAt = now;
      reservation.cancelledBy = "system";
      reservation.cancelReason = RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
      reservation.UpdatedAt = now;
      await reservation.save();
      await emitOrderUpdated(reservation, { action: "lifecycle_pickup_timeout" });
      sellerReleasedCount += 1;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã hủy",
          content:
            "Quá 24 giờ sau giờ nhận hàng, bạn không gửi báo cáo — đơn đã hủy và cọc chuyển cho shop.",
          audience: NOTIFICATION_AUDIENCE.BUYER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }
      if (shop.userId) {
        await createNotification(shop.userId, {
          title: "Nhận cọc giữ hàng",
          content: "Khách không báo cáo trong 24 giờ. Cọc đã vào ví của bạn.",
          audience: NOTIFICATION_AUDIENCE.SELLER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }
      continue;
    } catch (error) {
      console.error(
        "processReservationLifecycle deposit-decision failed:",
        reservation._id,
        error.message
      );
    }
  }

  return {
    cancelledCount,
    autoCompletedCount,
    buyerRefundedCount,
    sellerReleasedCount,
    checkedAt: now,
  };
}

/** Alias cho job cũ. */
async function expireOverdueReservations() {
  return processReservationLifecycle();
}

const ACTIVE_LOCK_CANCEL_STATUSES = [
  RESERVATION_STATUS.PENDING,
  RESERVATION_STATUS.WAITING_PICKUP,
  RESERVATION_STATUS.DISPUTED,
];

async function assertNoActiveReservationsForProduct(productId) {
  const activeCount = await Reservation.countDocuments({
    productId,
    status: { $in: ACTIVE_LOCK_CANCEL_STATUSES },
  });

  if (activeCount > 0) {
    throw createServiceError(
      activeCount === 1
        ? "Đang có đơn giữ hàng liên quan. Hoàn thành đơn này trước khi gỡ sản phẩm."
        : `Đang có ${activeCount} đơn giữ hàng liên quan. Hoàn thành các đơn này trước khi gỡ sản phẩm.`
    );
  }
}

/**
 * Hủy đơn đang active khi admin khóa tài khoản — luôn hoàn cọc cho buyer.
 * - Đơn buyer của user bị khóa → BUYER_ACCOUNT_LOCKED
 * - Đơn shop của seller bị khóa → SELLER_ACCOUNT_LOCKED
 */
async function cancelActiveReservationsForAccountLock(targetUserId) {
  const now = new Date();
  let cancelledCount = 0;
  const userObjectId = targetUserId;

  const shopDocs = await ShopProfile.find({ userId: userObjectId }).select("_id userId").lean();
  const shopIds = shopDocs.map((shop) => shop._id);

  const [buyerReservations, sellerReservations] = await Promise.all([
    Reservation.find({
      userId: userObjectId,
      status: { $in: ACTIVE_LOCK_CANCEL_STATUSES },
    }).limit(300),
    shopIds.length
      ? Reservation.find({
          shopId: { $in: shopIds },
          status: { $in: ACTIVE_LOCK_CANCEL_STATUSES },
        }).limit(300)
      : Promise.resolve([]),
  ]);

  const seen = new Set();
  const batches = [
    ...sellerReservations.map((doc) => ({
      reservation: doc,
      reasonCode: RESERVATION_CANCEL_REASON.SELLER_ACCOUNT_LOCKED,
    })),
    ...buyerReservations.map((doc) => ({
      reservation: doc,
      reasonCode: RESERVATION_CANCEL_REASON.BUYER_ACCOUNT_LOCKED,
    })),
  ];

  for (const { reservation, reasonCode } of batches) {
    const reservationId = String(reservation._id);
    if (seen.has(reservationId)) {
      continue;
    }
    seen.add(reservationId);

    try {
      if (!ACTIVE_LOCK_CANCEL_STATUSES.includes(Number(reservation.status))) {
        continue;
      }

      await releaseVariantInventory(reservation);
      await refundDepositIfHeld(reservation);
      await closePendingReservationReports(
        reservation._id,
        reasonCode === RESERVATION_CANCEL_REASON.SELLER_ACCOUNT_LOCKED
          ? "account_lock_seller"
          : "account_lock_buyer",
        "Đơn hủy do tài khoản bị khóa bởi quản trị viên.",
        now
      );

      reservation.status = RESERVATION_STATUS.CANCELLED;
      reservation.cancelledAt = now;
      reservation.cancelledBy = "admin";
      reservation.cancelReason = reasonCode;
      reservation.cancelNote = "Tài khoản bị khóa bởi quản trị viên.";
      reservation.UpdatedAt = now;
      await reservation.save();
      cancelledCount += 1;

      const shop = reservation.shopId
        ? await ShopProfile.findById(reservation.shopId).select("userId").lean()
        : null;
      const product = reservation.productId
        ? await Product.findById(reservation.productId).select("ProductName").lean()
        : null;
      const productName = product?.ProductName || "sản phẩm";

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã hủy",
          content:
            reasonCode === RESERVATION_CANCEL_REASON.BUYER_ACCOUNT_LOCKED
              ? `Tài khoản của bạn bị khóa. Đơn giữ ${productName} đã hủy và cọc đã hoàn về ví (nếu có).`
              : `Người bán bị khóa tài khoản. Đơn giữ ${productName} đã hủy và cọc đã hoàn về ví.`,
          audience: NOTIFICATION_AUDIENCE.BUYER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }

      if (shop?.userId) {
        await createNotification(shop.userId, {
          title: "Đơn giữ hàng đã hủy",
          content:
            reasonCode === RESERVATION_CANCEL_REASON.SELLER_ACCOUNT_LOCKED
              ? `Tài khoản shop bị khóa. Đơn giữ ${productName} đã hủy và cọc hoàn cho người mua.`
              : `Người mua bị khóa tài khoản. Đơn giữ ${productName} đã hủy.`,
          audience: NOTIFICATION_AUDIENCE.SELLER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }
    } catch (error) {
      console.error(
        "cancelActiveReservationsForAccountLock failed:",
        reservationId,
        error.message
      );
    }
  }

  return { cancelledCount, checkedAt: now };
}

/**
 * Hủy đơn đang active khi admin khóa gian hàng — luôn hoàn cọc cho buyer.
 */
async function cancelActiveReservationsForShopLock(shopId) {
  const now = new Date();
  let cancelledCount = 0;
  const shopObjectId = shopId;

  const shop = await ShopProfile.findById(shopObjectId).select("_id userId").lean();
  if (!shop) {
    return { cancelledCount: 0, checkedAt: now };
  }

  const sellerReservations = await Reservation.find({
    shopId: shopObjectId,
    status: { $in: ACTIVE_LOCK_CANCEL_STATUSES },
  }).limit(300);

  for (const reservation of sellerReservations) {
    const reservationId = String(reservation._id);

    try {
      if (!ACTIVE_LOCK_CANCEL_STATUSES.includes(Number(reservation.status))) {
        continue;
      }

      await releaseVariantInventory(reservation);
      await refundDepositIfHeld(reservation);
      await closePendingReservationReports(
        reservation._id,
        "shop_lock",
        "Đơn hủy do gian hàng bị khóa bởi quản trị viên.",
        now
      );

      reservation.status = RESERVATION_STATUS.CANCELLED;
      reservation.cancelledAt = now;
      reservation.cancelledBy = "admin";
      reservation.cancelReason = RESERVATION_CANCEL_REASON.SELLER_SHOP_LOCKED;
      reservation.cancelNote = "Shop bị khóa bởi quản trị viên.";
      reservation.UpdatedAt = now;
      await reservation.save();
      cancelledCount += 1;

      const product = reservation.productId
        ? await Product.findById(reservation.productId).select("ProductName").lean()
        : null;
      const productName = product?.ProductName || "sản phẩm";

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã hủy",
          content: `Gian hàng bị khóa. Đơn giữ ${productName} đã hủy và cọc đã hoàn về ví (nếu có).`,
          audience: NOTIFICATION_AUDIENCE.BUYER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }

      if (shop.userId) {
        await createNotification(shop.userId, {
          title: "Đơn giữ hàng đã hủy",
          content: `Gian hàng bị khóa. Đơn giữ ${productName} đã hủy và cọc hoàn cho người mua.`,
          audience: NOTIFICATION_AUDIENCE.SELLER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }
    } catch (error) {
      console.error(
        "cancelActiveReservationsForShopLock failed:",
        reservationId,
        error.message
      );
    }
  }

  return { cancelledCount, checkedAt: now };
}

function assertReservationDeliverable(reservation) {
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  if (Number(reservation.status) !== RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError("Chỉ quét QR khi đơn đang chờ giao hàng.", 403);
  }
}

/** Seller quét QR buyer — xem trước thông tin đơn. */
async function validateSellerPickupQr(user, rawPayload) {
  await processReservationLifecycle();
  const parsed = parsePickupQrPayload(rawPayload);
  if (!parsed?.reservationId) {
    throw createServiceError("Mã QR không hợp lệ.", 400);
  }

  const { shop, reservation } = await getOwnedReservation(user, parsed.reservationId);
  assertReservationDeliverable(reservation);

  if (
    parsed.buyerId &&
    String(reservation.userId || "") !== String(parsed.buyerId)
  ) {
    throw createServiceError("Mã QR không khớp người mua.", 400);
  }

  const buyer = reservation.userId
    ? await User.findById(reservation.userId).select("FullName UserName Avatar Phone")
    : null;
  const product = reservation.productId
    ? await Product.findById(reservation.productId).select("ProductName").lean()
    : null;

  return {
    reservation: await toPublicReservation(reservation, {
      adjustments: await require("./reservationAdjustmentService").loadAdjustmentsForReservation(
        reservation._id,
        { productName: product?.ProductName || "" }
      ),
    }),
    preview: {
      orderCode: parsed.orderCode || buildOrderCode(reservation._id),
      buyerName: buyer?.FullName || buyer?.UserName || "Khách hàng",
      productName: product?.ProductName || "Sản phẩm",
      quantity: Number(reservation.quantity) || 1,
      totalAmount: computeTotal(reservation),
      shopName: shop?.shopName || "",
    },
  };
}

/** Seller xác nhận giao hàng sau khi quét QR — bắt đầu escrow. */
async function confirmDeliveredBySeller(user, reservationId) {
  await processReservationLifecycle();
  const { shop, reservation } = await getOwnedReservation(user, reservationId);
  assertReservationDeliverable(reservation);

  const buyer = reservation.userId ? await User.findById(reservation.userId) : null;
  const product = reservation.productId
    ? await Product.findById(reservation.productId).select("ProductName").lean()
    : null;
  const productName = product?.ProductName || "sản phẩm";
  const buyerName = buyer?.FullName || buyer?.UserName || "Khách hàng";

  const now = new Date();
  const result = await finalizeReceivedBySeller(reservation, shop, { now });
  const escrowLabel = formatEscrowProtectionLabel(
    reservation.escrowProtectionDays ?? 7
  );

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Đơn đã hoàn thành",
      content: `Shop đã xác nhận giao ${productName}. Đơn đã hoàn tất — bạn có ${escrowLabel} để khiếu nại hoặc đánh giá.`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }
  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Đã giao hàng",
      content: `Bạn đã xác nhận giao hàng cho ${buyerName}. Cọc sẽ chuyển sau ${escrowLabel} nếu không có tranh chấp.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  return result;
}

module.exports = {
  listSellerReservations,
  getSellerReservationDetail,
  confirmReservation,
  rejectReservation,
  cancelAcceptedReservationBySeller,
  cancelReservationBySeller,
  refundDisputeDepositBySeller,
  completeReservation,
  toPublicReservation,
  computeTotal,
  computeReviewDeadline,
  computeAutoReleaseAt,
  buildActionFlags,
  getDepositDecisionDeadline,
  isWithinDepositDecisionWindow,
  isBeforePickupTime,
  isPastPickupTime,
  reserveVariantInventory,
  releaseVariantInventory,
  markReservationSold,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  isDepositSettled,
  isDepositHeld,
  resolveDepositSettleTo,
  resolveDepositSettledAt,
  finalizeCompleted,
  finalizeBuyerForfeit,
  processReservationLifecycle,
  expireOverdueReservations,
  sendPickupReminders,
  cancelActiveReservationsForAccountLock,
  cancelActiveReservationsForShopLock,
  assertNoActiveReservationsForProduct,
  validateSellerPickupQr,
  confirmDeliveredBySeller,
  getOwnedReservation,
  SHOP_CANCEL_REASON,
  BUYER_CANCEL_REASON,
  SHOP_REJECT_REASON,
  SHOP_UNCONFIRMED_CANCEL_REASON,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
};
