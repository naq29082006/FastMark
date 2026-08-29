const { DISPUTE_CREATED_BY, RESERVATION_STATUS } = require("../constants");
const { normalizeReservationStatus } = require("./reservationStatus");

const LEGACY_ACTOR_CANCEL_TYPES = new Set([
  "buyer",
  "seller",
  "seller_reject",
  "seller_after_accept",
  "system",
  "admin",
]);

function pickString(value) {
  return String(value || "").trim();
}

function getReservationBuyerId(reservation) {
  return reservation?.userId || null;
}

function getReservationSellerId(_reservation) {
  return null;
}

/** Thời điểm buyer xác nhận nhận hàng (đọc DB cũ completedAt). */
function getPickupConfirmedAt(reservation) {
  if (!reservation) {
    return null;
  }
  return reservation.tgNhanHang ?? reservation.pickupConfirmedAt ?? reservation.completedAt ?? null;
}

function reservationHasDispute(reservation) {
  return (
    normalizeReservationStatus(reservation?.status, reservation) ===
    RESERVATION_STATUS.DISPUTED
  );
}

function isDisputeResolved(reservation) {
  const { isDisputeResolved: resolved } = require("./reservationStatus");
  return resolved(reservation);
}

function isActiveDispute(reservation) {
  const { isActiveDispute: active } = require("./reservationStatus");
  return active(reservation);
}

function activeDisputeFilter() {
  return { status: RESERVATION_STATUS.DISPUTED, cocChuyenDen: 0 };
}

function resolvedDisputeFilter() {
  return {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: { $in: [1, 2] },
  };
}

function reservationHasReview(reservation) {
  if (reservation?.hasReview === true || reservation?.hasReviewed === true) {
    return true;
  }
  return Number(reservation?.hasReview) === 1 || Number(reservation?.hasReviewed) === 1;
}

function getReservationCreatedAt(reservation) {
  return reservation?.createdAt || reservation?.CreatedAt || null;
}

function getReservationUpdatedAt(reservation) {
  return reservation?.updatedAt || reservation?.UpdatedAt || null;
}

function buyerIdFilter(userId) {
  const id = pickString(userId);
  if (!id) {
    return {};
  }
  return { userId: id };
}

function hasDisputeFilter() {
  return { status: RESERVATION_STATUS.DISPUTED };
}

function noDisputeFilter() {
  return { status: { $ne: RESERVATION_STATUS.DISPUTED } };
}

function normalizeDisputeCreatedBy(value) {
  const raw = pickString(value).toLowerCase();
  if (raw === "buyer" || Number(value) === DISPUTE_CREATED_BY.BUYER) {
    return DISPUTE_CREATED_BY.BUYER;
  }
  if (raw === "seller" || Number(value) === DISPUTE_CREATED_BY.SELLER) {
    return DISPUTE_CREATED_BY.SELLER;
  }
  return null;
}

function disputeCreatedByLabel(createdBy) {
  const code = Number(createdBy);
  if (code === DISPUTE_CREATED_BY.BUYER) {
    return "buyer";
  }
  if (code === DISPUTE_CREATED_BY.SELLER) {
    return "seller";
  }
  return "";
}

function generatePickupCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function reservationHasEscrowDeposit(reservation) {
  return Number(reservation?.depositAmount) > 0;
}

function isStoredCancelReasonCode(value) {
  const raw = pickString(value);
  if (!raw) {
    return false;
  }
  return /^[a-z0-9_]+$/i.test(raw) && raw.includes("_");
}

/** Mã ngữ cảnh hủy đơn (RESERVATION_CANCEL_REASON) — field cancelType. */
function getReservationCancelType(reservation) {
  return pickString(reservation?.cancelType ?? reservation?.cancelledBy);
}

/** Giá trị thô cancelNote trong DB (có thể còn mã legacy trước migrate). */
function getReservationCancelNoteRaw(reservation) {
  return pickString(reservation?.cancelNote ?? reservation?.cancelReason);
}

/** API / UI: text shop/admin nhập — không trả mã snake_case. */
function getReservationCancelNote(reservation) {
  const raw = getReservationCancelNoteRaw(reservation);
  if (!raw) {
    return "";
  }
  if (isStoredCancelReasonCode(raw)) {
    return "";
  }
  return raw;
}

function isCancelledBySellerAfterAccept(reservation) {
  const code = pickString(getReservationCancelType(reservation)).toLowerCase();
  if (code === "seller_cancel_holding" || code === "seller_refund_after_pickup") {
    return true;
  }
  if (getReservationCancelType(reservation) === "seller_after_accept") {
    return true;
  }
  const legacyNote = pickString(getReservationCancelNoteRaw(reservation)).toLowerCase();
  return legacyNote === "seller_cancel_holding" || legacyNote === "seller_refund_after_pickup";
}

/** Mongo: đơn tạo trong kỳ — createdAt (V2) hoặc CreatedAt (legacy). */
function reservationCreatedInRange(from, to) {
  return {
    $or: [
      { createdAt: { $gte: from, $lte: to } },
      { CreatedAt: { $gte: from, $lte: to } },
    ],
  };
}

/** Mongo: tgNhanHang in range (fallback completedAt trước migrate). */
function reservationPickupConfirmedRangeFilter(from, to) {
  return {
    $or: [
      { tgNhanHang: { $gte: from, $lte: to } },
      { tgNhanHang: null, completedAt: { $gte: from, $lte: to } },
    ],
  };
}

/** GMV / dashboard: pickup time hoặc updatedAt khi chưa có mốc nhận hàng. */
function reservationCompletedWindowMatch(from, to) {
  return {
    $or: [
      { tgNhanHang: { $gte: from, $lte: to } },
      { tgNhanHang: null, completedAt: { $gte: from, $lte: to } },
      {
        tgNhanHang: null,
        completedAt: null,
        updatedAt: { $gte: from, $lte: to },
      },
    ],
  };
}

module.exports = {
  getReservationBuyerId,
  getReservationSellerId,
  getPickupConfirmedAt,
  reservationHasDispute,
  isDisputeResolved,
  isActiveDispute,
  activeDisputeFilter,
  resolvedDisputeFilter,
  reservationHasReview,
  getReservationCreatedAt,
  getReservationUpdatedAt,
  buyerIdFilter,
  hasDisputeFilter,
  noDisputeFilter,
  normalizeDisputeCreatedBy,
  disputeCreatedByLabel,
  generatePickupCode,
  reservationHasEscrowDeposit,
  getReservationCancelType,
  getReservationCancelNoteRaw,
  getReservationCancelNote,
  isCancelledBySellerAfterAccept,
  isStoredCancelReasonCode,
  LEGACY_ACTOR_CANCEL_TYPES,
  reservationCreatedInRange,
  reservationPickupConfirmedRangeFilter,
  reservationCompletedWindowMatch,
};
