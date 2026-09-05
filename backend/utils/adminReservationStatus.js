const { RESERVATION_STATUS, DEPOSIT_SETTLE_TO } = require("../constants");
const { isDepositSettled } = require("./reservationStatus");

function isPastPickup(reservation) {
  if (reservation?.isPastPickup) {
    return true;
  }
  if (!reservation?.pickupTime) {
    return false;
  }
  const pickup = new Date(reservation.pickupTime);
  return Number.isFinite(pickup.getTime()) && pickup.getTime() <= Date.now();
}

/**
 * Nhãn trạng thái cho danh sách admin.
 * - Đã nhận hàng (2) tách khỏi Hoàn thành (4)
 * - Tranh chấp đã xử lý: status DISPUTED + cọc đã giải ngân (buyer hoặc seller)
 * - Đã hủy: chỉ status CANCELLED (không phải tranh chấp đã xử lý)
 */
function resolveAdminReservationStatusLabel(reservation) {
  const status = Number(reservation?.status);

  if (status === RESERVATION_STATUS.CANCELLED) {
    return "Đã hủy";
  }
  if (status === RESERVATION_STATUS.COMPLETED) {
    return "Hoàn thành";
  }
  if (status === RESERVATION_STATUS.PICKUP_CONFIRMED) {
    return "Đã nhận hàng";
  }
  if (status === RESERVATION_STATUS.DISPUTED) {
    if (isDepositSettled(reservation)) {
      return "Tranh chấp đã xử lý";
    }
    return "Tranh chấp";
  }
  if (status === RESERVATION_STATUS.PENDING) {
    return "Chờ xác nhận";
  }
  if (status === RESERVATION_STATUS.WAITING_PICKUP) {
    return isPastPickup(reservation) ? "Quá giờ nhận" : "Giữ hàng";
  }
  return "Không rõ";
}

function isAdminDisputeResolved(reservation) {
  return (
    Number(reservation?.status) === RESERVATION_STATUS.DISPUTED && isDepositSettled(reservation)
  );
}

function isAdminActiveDispute(reservation) {
  return Number(reservation?.status) === RESERVATION_STATUS.DISPUTED && !isDepositSettled(reservation);
}

function buildActiveDisputeQuery(extra = {}) {
  return {
    status: RESERVATION_STATUS.DISPUTED,
    $or: [
      { cocChuyenDen: { $exists: false } },
      { cocChuyenDen: null },
      { cocChuyenDen: DEPOSIT_SETTLE_TO.NONE },
      { cocChuyenDen: 0 },
    ],
    ...extra,
  };
}

function buildDisputeResolvedQuery(extra = {}) {
  return {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: { $in: [DEPOSIT_SETTLE_TO.BUYER, DEPOSIT_SETTLE_TO.SELLER] },
    ...extra,
  };
}

/** Đơn hủy: chỉ status CANCELLED — tranh chấp đã xử lý (status 3 + cọc settled) thuộc tab dispute_resolved. */
function buildCancelledAdminQuery(extra = {}) {
  return {
    status: RESERVATION_STATUS.CANCELLED,
    ...extra,
  };
}

module.exports = {
  resolveAdminReservationStatusLabel,
  isAdminDisputeResolved,
  isAdminActiveDispute,
  buildActiveDisputeQuery,
  buildDisputeResolvedQuery,
  buildCancelledAdminQuery,
};
