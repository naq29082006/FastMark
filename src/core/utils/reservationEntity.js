import {
  RESERVATION_CANCEL_REASON,
  inferCancelReasonCode,
} from '../../constants/reservationOrderFlow';

/** Đơn có yêu cầu đặt cọc (shop bật %/số tiền cọc). */
export function reservationRequiresDeposit(reservation) {
  if (!reservation) {
    return false;
  }
  if (reservation.depositRequired === false) {
    return false;
  }
  if (reservation.depositRequired === true) {
    return true;
  }
  const amount = Number(reservation.depositAmount) || 0;
  const percent = Number(reservation.depositPercent) || 0;
  return amount > 0 || percent > 0;
}

export function getReservationCancelType(reservation) {
  return String(reservation?.cancelType ?? reservation?.cancelledBy ?? '').trim();
}

export function getReservationCancelNoteRaw(reservation) {
  return String(reservation?.cancelNote ?? reservation?.cancelReason ?? '').trim();
}

/** Text shop/admin nhập (bỏ qua mã snake_case trong cancelNote). */
export function getReservationCancelNote(reservation) {
  const raw = getReservationCancelNoteRaw(reservation);
  if (!raw) {
    return '';
  }
  if (/^[a-z0-9_]+$/i.test(raw) && raw.includes('_')) {
    return '';
  }
  return raw;
}

export function isCancelledBySellerAfterAccept(reservation) {
  const code = inferCancelReasonCode(reservation || {});
  return (
    code === RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING ||
    code === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
    getReservationCancelType(reservation) === 'seller_after_accept'
  );
}

export function getReservationShopId(reservation) {
  return String(reservation?.shopId || reservation?.shop?.id || '').trim();
}

export function getReservationProductId(reservation) {
  return String(
    reservation?.product?.id ||
      reservation?.product?._id ||
      reservation?.productId ||
      ''
  ).trim();
}

export function getReservationBuyerId(reservation) {
  return String(reservation?.buyer?.id || reservation?.userId || '').trim();
}

/** Thời điểm buyer xác nhận nhận hàng (API vẫn có thể trả completedAt). */
export function getPickupConfirmedAt(reservation) {
  return reservation?.tgNhanHang || reservation?.completedAt || null;
}
