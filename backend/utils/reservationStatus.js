/** cocChuyenDen — tránh circular require với constants/index.js */
const SETTLE_BUYER = 1;
const SETTLE_SELLER = 2;

/** Trạng thái Reservation (v2, 0–5). */
const RESERVATION_STATUS_V2 = {
  PENDING: 0,
  WAITING_PICKUP: 1,
  PICKUP_CONFIRMED: 2,
  DISPUTED: 3,
  COMPLETED: 4,
  CANCELLED: 5,
};

/** Map status cũ (0–7) → v2 khi đọc DB chưa migrate. */
const LEGACY_STATUS_TO_V2 = {
  0: 0,
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 5,
};

function normalizeReservationStatus(rawStatus, reservation = {}) {
  const status = Number(rawStatus);
  // Legacy v2: status 6 = DisputeCompleted → DISPUTED (3).
  if (status === 6) {
    return RESERVATION_STATUS_V2.DISPUTED;
  }
  if (Object.values(RESERVATION_STATUS_V2).includes(status)) {
    return status;
  }
  if (LEGACY_STATUS_TO_V2[status] !== undefined) {
    let mapped = LEGACY_STATUS_TO_V2[status];
    if (status === 6 || status === 7) {
      if (
        Number(reservation?.cocChuyenDen) === SETTLE_SELLER &&
        (reservation?.hasDispute || reservation?.disputed)
      ) {
        mapped = RESERVATION_STATUS_V2.DISPUTED;
      }
    }
    if (status === 5 && Number(reservation?.cocChuyenDen) === SETTLE_SELLER) {
      mapped = RESERVATION_STATUS_V2.COMPLETED;
    }
    return mapped;
  }
  return status;
}

/** Khiếu nại sau nhận hàng: đã có thời điểm xác nhận nhận (tgNhanHang). */
function isPostPickupDisputeContext(reservation) {
  if (!reservation) {
    return false;
  }
  const { getPickupConfirmedAt } = require("./reservationCompat");
  const at = getPickupConfirmedAt(reservation);
  if (!at) {
    return false;
  }
  const t = new Date(at);
  return Number.isFinite(t.getTime());
}

/** Tranh chấp trước nhận hàng. */
function isPrePickupDisputeContext(reservation) {
  return Boolean(reservation) && !isPostPickupDisputeContext(reservation);
}

/** Ai thắng tranh chấp theo giải ngân cọc. */
function resolveDisputeWinnerFromDeposit(settleTo) {
  const code = Number(settleTo);
  if (code === SETTLE_BUYER) {
    return "buyer";
  }
  if (code === SETTLE_SELLER) {
    return "seller";
  }
  return "";
}

function isDepositSettled(reservation) {
  const code = Number(reservation?.cocChuyenDen);
  return code === SETTLE_BUYER || code === SETTLE_SELLER;
}

function isDisputeResolved(reservation) {
  const status = normalizeReservationStatus(reservation?.status, reservation);
  return status === RESERVATION_STATUS_V2.DISPUTED && isDepositSettled(reservation);
}

function isActiveDispute(reservation) {
  const status = normalizeReservationStatus(reservation?.status, reservation);
  return status === RESERVATION_STATUS_V2.DISPUTED && !isDepositSettled(reservation);
}

function isTerminalReservationStatus(status, reservation = {}) {
  const code = normalizeReservationStatus(status, reservation);
  if (code === RESERVATION_STATUS_V2.COMPLETED || code === RESERVATION_STATUS_V2.CANCELLED) {
    return true;
  }
  if (code === RESERVATION_STATUS_V2.DISPUTED && isDepositSettled(reservation)) {
    return true;
  }
  return false;
}

function isDeliveredOrEscrowStatus(status) {
  const code = normalizeReservationStatus(status);
  return (
    code === RESERVATION_STATUS_V2.PICKUP_CONFIRMED || code === RESERVATION_STATUS_V2.COMPLETED
  );
}

module.exports = {
  RESERVATION_STATUS_V2,
  LEGACY_STATUS_TO_V2,
  normalizeReservationStatus,
  isPostPickupDisputeContext,
  isPrePickupDisputeContext,
  resolveDisputeWinnerFromDeposit,
  isDepositSettled,
  isDisputeResolved,
  isActiveDispute,
  isTerminalReservationStatus,
  isDeliveredOrEscrowStatus,
};
