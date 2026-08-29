const {
  RESERVATION_DISPUTE_WINDOW_HOURS,
  DISPUTE_HISTORY_RETENTION_HOURS,
  RESERVATION_STATUS,
} = require("../constants");
const { normalizeReservationStatus, isDepositSettled } = require("./reservationStatus");
const {
  escrowProtectionMs,
  normalizeEscrowProtectionDays,
} = require("./escrowProtectionDays");

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function pickDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function computeDisputeReportDeadline(pickupTime, fromDate = new Date()) {
  const pickup = pickDate(pickupTime);
  const base = pickup || fromDate;
  return new Date(base.getTime() + RESERVATION_DISPUTE_WINDOW_HOURS * MS_HOUR);
}

function computeDisputeHistoryVisibleUntil(tgGiaiCoc) {
  const settled = pickDate(tgGiaiCoc);
  if (!settled) {
    return null;
  }
  return new Date(settled.getTime() + DISPUTE_HISTORY_RETENTION_HOURS * MS_HOUR);
}

function isPostDeliveryEscrowStatus(reservation) {
  const status = normalizeReservationStatus(reservation?.status, reservation);
  return (
    status === RESERVATION_STATUS.PICKUP_CONFIRMED ||
    status === RESERVATION_STATUS.COMPLETED
  );
}

/** Hạn giữ cọc sau xác nhận giao hàng — tgNhanHang + disputeDays (snapshot soNgayKN). */
function resolveEscrowProtectionDeadline(reservation) {
  if (!reservation || !isPostDeliveryEscrowStatus(reservation) || isDepositSettled(reservation)) {
    return null;
  }

  const confirmed = pickDate(
    reservation?.tgNhanHang || reservation?.completedAt || reservation?.deliveredAt
  );
  const days = reservation?.soNgayKN;
  if (confirmed && days != null) {
    return new Date(
      confirmed.getTime() + escrowProtectionMs(normalizeEscrowProtectionDays(days))
    );
  }

  return pickDate(reservation?.hanGiaiCoc);
}

function isWithinEscrowProtectionWindow(reservation, now = new Date()) {
  const deadline = resolveEscrowProtectionDeadline(reservation);
  if (!deadline) {
    return false;
  }
  return now.getTime() < deadline.getTime();
}

function resolveDisputeReportDeadline(reservation) {
  if (!reservation) {
    return null;
  }
  const pickupBased = reservation.pickupTime
    ? computeDisputeReportDeadline(reservation.pickupTime)
    : null;
  const fromApi = [
    reservation.depositDecisionDeadline,
    reservation.disputeReportDeadlineAt,
  ]
    .map(pickDate)
    .filter(Boolean)[0];

  if (fromApi && pickupBased) {
    if (Math.abs(fromApi.getTime() - pickupBased.getTime()) <= MS_HOUR) {
      return fromApi;
    }
    if (fromApi.getTime() > pickupBased.getTime() + MS_DAY) {
      return pickupBased;
    }
    return fromApi;
  }
  return pickupBased || fromApi || null;
}

function resolveActiveDisputeResponseDeadline(reservation, nowMs = Date.now()) {
  if (!reservation) {
    return null;
  }
  const status = normalizeReservationStatus(reservation?.status, reservation);
  if (status !== RESERVATION_STATUS.DISPUTED || isDisputeResolvedReservation(reservation)) {
    return null;
  }

  const postDelivery = Boolean(reservation.isPostDeliveryDispute);
  const disputeByBuyer = Boolean(reservation.disputeByBuyer);
  const disputeBySeller = Boolean(reservation.disputeBySeller);
  const sellerResponded = Boolean(
    reservation.sellerResponse?.content ||
      reservation.sellerResponse?.respondedAt ||
      reservation.tgPhShop
  );

  if (postDelivery) {
    if (sellerResponded || !disputeByBuyer) {
      return null;
    }
    return pickDate(reservation.hanPhShop);
  }

  if (disputeByBuyer && disputeBySeller) {
    return null;
  }
  if (!disputeByBuyer && !disputeBySeller) {
    return null;
  }
  return resolveDisputeReportDeadline(reservation);
}

function isDisputeResolvedReservation(reservation) {
  const status = normalizeReservationStatus(reservation?.status, reservation);
  return status === RESERVATION_STATUS.DISPUTED && isDepositSettled(reservation);
}

function resolveDisputeHistoryVisibleUntil(reservation) {
  if (!isDisputeResolvedReservation(reservation)) {
    return null;
  }
  const fromApi = pickDate(reservation?.disputeHistoryVisibleUntil);
  if (fromApi) {
    return fromApi;
  }
  return computeDisputeHistoryVisibleUntil(
    reservation?.tgGiaiCoc ||
      reservation?.depositRefundedAt ||
      reservation?.depositReleasedAt
  );
}

/** Escrow protection sau nhận hàng — ngày / giờ / phút. */
function formatEscrowProtectionRemaining(deadlineAt, now = Date.now()) {
  const deadline = pickDate(deadlineAt);
  if (!deadline) {
    return "";
  }
  const diff = deadline.getTime() - now;
  if (diff <= 0) {
    return "";
  }
  const days = Math.floor(diff / MS_DAY);
  if (days >= 1) {
    return `${days} ngày`;
  }
  const hours = Math.floor(diff / MS_HOUR);
  if (hours >= 1) {
    return `${hours} giờ`;
  }
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} phút`;
}

/** Tranh chấp pickup — chỉ giờ / phút (không ngày). */
function formatDisputeWindowRemaining(deadlineAt, now = Date.now()) {
  const deadline = pickDate(deadlineAt);
  if (!deadline) {
    return "";
  }
  const diff = deadline.getTime() - now;
  if (diff <= 0) {
    return "";
  }
  const hours = Math.floor(diff / MS_HOUR);
  if (hours >= 1) {
    return `${hours} giờ`;
  }
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} phút`;
}

function buildCountdownPayload(reservation, now = new Date()) {
  const nowMs = now.getTime();
  const status = normalizeReservationStatus(reservation?.status, reservation);
  const disputeReportDeadline = resolveDisputeReportDeadline(reservation);
  const disputeResponseDeadline = resolveActiveDisputeResponseDeadline(reservation, nowMs);
  const disputeHistoryVisibleUntil = resolveDisputeHistoryVisibleUntil(reservation);
  const escrowDeadline = resolveEscrowProtectionDeadline(reservation);
  const pickup = pickDate(reservation?.pickupTime);
  const pastPickup = Boolean(pickup && nowMs >= pickup.getTime());
  const disputeResolved = isDisputeResolvedReservation(reservation);
  const postDeliveryEscrow = isPostDeliveryEscrowStatus(reservation);

  const reportRemain =
    status === RESERVATION_STATUS.WAITING_PICKUP &&
    pastPickup &&
    !disputeResolved &&
    !isDepositSettled(reservation)
      ? formatDisputeWindowRemaining(disputeReportDeadline, nowMs)
      : "";
  const responseRemain = disputeResponseDeadline
    ? formatDisputeWindowRemaining(disputeResponseDeadline, nowMs)
    : "";
  const escrowRemain =
    postDeliveryEscrow && !isDepositSettled(reservation)
      ? formatEscrowProtectionRemaining(escrowDeadline, nowMs)
      : "";
  const historyRemain = disputeResolved
    ? formatDisputeWindowRemaining(disputeHistoryVisibleUntil, nowMs)
    : "";

  return {
    disputeReportDeadlineAt: disputeReportDeadline,
    disputeResponseDeadlineAt: disputeResponseDeadline || disputeReportDeadline,
    disputeHistoryVisibleUntil,
    escrowProtectionDeadlineAt: escrowDeadline,
    withinDisputeReportWindow: Boolean(
      disputeReportDeadline && nowMs < disputeReportDeadline.getTime()
    ),
    disputeReportCountdownLabel: reportRemain ? `Còn ${reportRemain}` : "",
    disputeResponseCountdownLabel: responseRemain ? `Còn ${responseRemain} để phản hồi` : "",
    escrowProtectionCountdownLabel: escrowRemain ? `Còn ${escrowRemain}` : "",
    disputeHistoryCountdownLabel: historyRemain
      ? `Kết quả tranh chấp sẽ lưu thêm ${historyRemain}`
      : "",
  };
}

module.exports = {
  MS_HOUR,
  MS_DAY,
  computeDisputeReportDeadline,
  computeDisputeHistoryVisibleUntil,
  resolveDisputeReportDeadline,
  resolveEscrowProtectionDeadline,
  isWithinEscrowProtectionWindow,
  isPostDeliveryEscrowStatus,
  resolveDisputeHistoryVisibleUntil,
  isDisputeResolvedReservation,
  formatEscrowProtectionRemaining,
  formatDisputeWindowRemaining,
  buildCountdownPayload,
};
