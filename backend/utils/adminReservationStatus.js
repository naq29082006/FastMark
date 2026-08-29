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
 * - Tranh chấp đã xử lý: disputed + cọc đã giải ngân (seller thắng / giao dịch kết thúc)
 * - Hoàn cọc cho buyer (kể cả auto): hiển thị Đã hủy — đơn không hoàn thành
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
      const settleTo = Number(reservation?.cocChuyenDen);
      if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
        return "Đã hủy";
      }
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

/** Đơn hủy: status 5 + tranh chấp đã hoàn cọc cho buyer (hiển thị Đã hủy). */
function buildCancelledAdminQuery(extra = {}) {
  return {
    $or: [
      { status: RESERVATION_STATUS.CANCELLED },
      {
        status: RESERVATION_STATUS.DISPUTED,
        cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
      },
    ],
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
