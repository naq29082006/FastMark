const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

function isDepositSettled(reservation) {
  const code = Number(reservation?.cocChuyenDen);
  if (code === DEPOSIT_SETTLE_TO.BUYER || code === DEPOSIT_SETTLE_TO.SELLER) {
    return true;
  }
  if (reservation?.depositRefundedAt) {
    return true;
  }
  if (reservation?.depositReleasedAt) {
    return true;
  }
  return false;
}

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

/** Meta hiển thị cột trạng thái — admin web. */
export function resolveAdminReservationStatusMeta(reservation) {
  const status = Number(reservation?.status);

  if (status === 5) {
    return { label: 'Đã hủy', tagColor: 'error', className: 'badge badge-danger' };
  }
  if (status === 4) {
    return { label: 'Hoàn thành', tagColor: 'success', className: 'badge badge-success' };
  }
  if (status === 2) {
    return { label: 'Đã nhận hàng', tagColor: 'blue', className: 'badge badge-info' };
  }
  if (status === 3) {
    if (isDepositSettled(reservation)) {
      return {
        label: 'Tranh chấp đã xử lý',
        tagColor: 'success',
        className: 'badge badge-success',
      };
    }
    return { label: 'Tranh chấp', tagColor: 'warning', className: 'badge badge-warning' };
  }
  if (status === 0) {
    return { label: 'Chờ xác nhận', tagColor: 'gold', className: 'badge badge-warning' };
  }
  if (status === 1) {
    if (isPastPickup(reservation)) {
      return { label: 'Quá giờ nhận', tagColor: 'warning', className: 'badge badge-warning' };
    }
    return { label: 'Giữ hàng', tagColor: 'default', className: 'badge badge-warning' };
  }
  return { label: 'Không rõ', tagColor: 'default', className: 'badge badge-secondary' };
}

/** @deprecated — dùng resolveAdminReservationStatusMeta */
export function resolveAdminListStatusMeta(reservation) {
  return resolveAdminReservationStatusMeta(reservation);
}
