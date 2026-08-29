/** cocChuyenDen — mirror backend reservationStatus.js */
const SETTLE_BUYER = 1;
const SETTLE_SELLER = 2;

export function isDepositSettled(reservation) {
  const code = Number(reservation?.cocChuyenDen);
  return code === SETTLE_BUYER || code === SETTLE_SELLER;
}

/** Tranh chấp đang mở: status = 3 và cọc chưa giải ngân. */
export function isActiveDisputeReservation(reservation) {
  return Number(reservation?.status) === 3 && !isDepositSettled(reservation);
}

/** Admin được xử lý: tranh chấp mở + (cả hai báo cáo hoặc khiếu nại sau nhận đủ điều kiện). */
export function canAdminProcessReservationDispute(reservation) {
  if (!isActiveDisputeReservation(reservation)) {
    return false;
  }
  const bothReported =
    Boolean(reservation?.disputeByBuyer) && Boolean(reservation?.disputeBySeller);
  const postDeliveryReady =
    Boolean(reservation?.isPostDeliveryDispute) &&
    Boolean(reservation?.awaitingAdminDisputeReview);
  return bothReported || postDeliveryReady;
}
