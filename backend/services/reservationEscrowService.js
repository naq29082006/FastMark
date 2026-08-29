const Reservation = require("../models/Reservation");
const ReservationDispute = require("../models/ReservationDispute");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const {
  RESERVATION_STATUS,
  DISPUTE_STATUS,
  RESERVATION_DISPUTE_STATUS,
  RESERVATION_DISPUTE_WINNER,
  DEPOSIT_SETTLE_TO,
  RESERVATION_CANCEL_REASON,
  DISPUTE_CREATED_BY,
} = require("../constants");
const {
  computeEscrowReleaseAt,
  normalizeEscrowProtectionDays,
  resolveEscrowProtectionDaysForProduct,
} = require("../utils/escrowProtection");
const { createNotification, NOTIFICATION_INDEX } = require("./notificationService");
const { NOTIFICATION_AUDIENCE } = require("../constants");
const { notifySellerDepositReleased } = require("./orderNotificationHelper");
const { emitOrderUpdated } = require("./orderRealtimeService");
const {
  getReservationBuyerId,
  noDisputeFilter,
} = require("../utils/reservationCompat");
const {
  disputeReasonTypeLabel,
  disputeReasonLegacyString,
} = require("../utils/disputeReasonType");
const { disputeCreatedByLabel } = require("../utils/reservationCompat");
const { buildOrderCode } = require("../utils/pickupQr");

function reservationHelpers() {
  return require("./reservationService");
}

async function finalizeReceivedBySeller(reservation, shop, { now = new Date() } = {}) {
  const escrowDays = await resolveEscrowProtectionDaysForProduct(reservation.productId);

  reservation.status = RESERVATION_STATUS.PICKUP_CONFIRMED;
  reservation.tgNhanHang = now;
  reservation.cocChuyenDen = DEPOSIT_SETTLE_TO.NONE;
  reservation.soNgayKN = escrowDays;
  reservation.hanGiaiCoc = computeEscrowReleaseAt(now, escrowDays);
  reservation.cancelType = RESERVATION_CANCEL_REASON.BUYER_RECEIVED;
  reservation.updatedAt = now;

  const soldQuantity = Number(reservation.quantity) || 1;
  shop.soldCount = (shop.soldCount || 0) + soldQuantity;
  shop.UpdatedAt = now;
  await shop.save();
  await reservationHelpers().markReservationSold(reservation);
  await reservation.save();
  await emitOrderUpdated(reservation, { action: "completed" });
  return reservationHelpers().toPublicReservation(reservation);
}

async function releaseEscrowToSeller(
  reservation,
  shop,
  { now = new Date(), notifySellerOnRelease = true } = {}
) {
  const releaseResult = await reservationHelpers().releaseDepositIfHeld(reservation, shop);
  reservation.status = RESERVATION_STATUS.COMPLETED;
  reservation.cocChuyenDen = DEPOSIT_SETTLE_TO.SELLER;
  reservation.tgGiaiCoc = reservation.tgGiaiCoc || now;
  reservation.updatedAt = now;
  await reservation.save();
  await emitOrderUpdated(reservation, { action: "escrow_released" });

  if (notifySellerOnRelease && releaseResult) {
    await notifySellerDepositReleased(reservation, shop);
  }

  return reservation;
}

async function refundEscrowToBuyer(reservation, { now = new Date(), cancelNote, cancelType } = {}) {
  await reservationHelpers().refundDepositIfHeld(reservation);
  reservationHelpers().applyDisputeResolution(reservation, {
    cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
    cancelType: cancelType || RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN,
    cancelNote: cancelNote || undefined,
    at: now,
  });
  await reservation.save();
  await emitOrderUpdated(reservation, { action: "escrow_refunded" });
  return reservation;
}

async function processEscrowAutoReleases() {
  const now = new Date();
  let releasedCount = 0;

  const due = await Reservation.find({
    status: RESERVATION_STATUS.PICKUP_CONFIRMED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.NONE,
    depositAmount: { $gt: 0 },
    ...noDisputeFilter(),
    hanGiaiCoc: { $ne: null, $lte: now },
  }).limit(200);

  for (const reservation of due) {
    try {
      const shop = reservation.shopId
        ? await ShopProfile.findById(reservation.shopId)
        : null;
      if (!shop?.userId) {
        continue;
      }

      await releaseEscrowToSeller(reservation, shop, { now });
      releasedCount += 1;

      const product = reservation.productId
        ? await Product.findById(reservation.productId).select("ProductName").lean()
        : null;
      const productName = product?.ProductName || "sản phẩm";
      const buyerId = getReservationBuyerId(reservation);

      if (buyerId) {
        await createNotification(buyerId, {
          title: "Đơn giữ hàng đã hoàn tất",
          content: `Đơn giữ ${productName} đã hoàn tất sau thời gian bảo vệ.`,
          audience: NOTIFICATION_AUDIENCE.BUYER,
          index: NOTIFICATION_INDEX.ORDER,
        });
      }
      // Thông báo seller: notifySellerDepositReleased trong releaseEscrowToSeller.
    } catch (error) {
      console.error("[escrow-auto-release] failed:", reservation._id, error.message);
    }
  }

  return { releasedCount, checkedAt: now };
}

async function resolveDisputeBuyerWin(reservation, dispute, { note, now = new Date() } = {}) {
  await refundEscrowToBuyer(reservation, {
    now,
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN,
    cancelNote: note || undefined,
  });

  dispute.status = DISPUTE_STATUS.ACCEPT_BUYER;
  dispute.adminNote = note || dispute.adminNote || "";
  dispute.resolvedAt = now;
  await dispute.save();

  const buyerId = getReservationBuyerId(reservation);
  if (buyerId) {
    await createNotification(buyerId, {
      title: "Admin đã xử lý tranh chấp",
      content: "Bạn thắng tranh chấp. Tiền cọc đã được hoàn về ví.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  return { reservation, dispute };
}

async function resolveDisputeSellerWin(reservation, shop, dispute, { note, now = new Date() } = {}) {
  await reservationHelpers().releaseDepositIfHeld(reservation, shop);
  await reservationHelpers().releaseVariantInventory(reservation);
  reservationHelpers().applyDisputeResolution(reservation, {
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN,
    cancelNote: note || undefined,
    at: now,
  });
  await reservation.save();

  dispute.status = DISPUTE_STATUS.ACCEPT_SELLER;
  dispute.adminNote = note || dispute.adminNote || "";
  dispute.resolvedAt = now;
  await dispute.save();

  if (shop?.userId) {
    const product = reservation.productId
      ? await Product.findById(reservation.productId).select("ProductName").lean()
      : null;
    const productName = product?.ProductName || "sản phẩm";
    const orderCode = buildOrderCode(reservation._id);
    const amount = Math.max(0, Math.round(Number(reservation.depositAmount) || 0));
    const amountLabel = amount > 0 ? `${amount.toLocaleString("vi-VN")}đ` : "Tiền cọc";
    await notifySellerDepositReleased(reservation, shop, {
      title: "Admin đã xử lý tranh chấp",
      content: `Bạn thắng tranh chấp. ${amountLabel} của đơn ${orderCode || "giữ hàng"} (${productName}) đã vào ví gian hàng.`,
    });
  }

  return { reservation, dispute };
}

function toPublicReservationDispute(doc) {
  if (!doc) {
    return null;
  }
  const { getPartyComplaint } = require("../utils/reservationDisputeView");
  const status = Number(doc.status);
  let winner = RESERVATION_DISPUTE_WINNER.NONE;
  if (status === DISPUTE_STATUS.ACCEPT_BUYER) {
    winner = RESERVATION_DISPUTE_WINNER.BUYER;
  } else if (status === DISPUTE_STATUS.ACCEPT_SELLER) {
    winner = RESERVATION_DISPUTE_WINNER.SELLER;
  }

  const buyerComplaint = getPartyComplaint(doc, "buyer");
  const sellerComplaint = getPartyComplaint(doc, "seller");

  return {
    id: String(doc._id),
    reservationId: doc.reservationId ? String(doc.reservationId) : "",
    buyerComplaint,
    sellerComplaint,
    status,
    winner,
    adminNote: doc.adminNote || "",
    resolvedAt: doc.resolvedAt || null,
    createdAt: doc.createdAt || doc.CreatedAt || null,
    auditLogs: (doc.auditLogs || []).map((log, index) => ({
      id: String(log._id || index),
      adminId: log.adminId ? String(log.adminId) : "",
      action: log.action || "",
      decision: log.decision || "",
      note: log.note || "",
      createdAt: log.createdAt || log.CreatedAt || null,
    })),
  };
}

module.exports = {
  finalizeReceivedBySeller,
  releaseEscrowToSeller,
  refundEscrowToBuyer,
  processEscrowAutoReleases,
  resolveDisputeBuyerWin,
  resolveDisputeSellerWin,
  toPublicReservationDispute,
};
