/**
 * FastMark — Enum & nhãn lý do đơn giữ hàng (mirror backend).
 */

export const RESERVATION_CANCEL_REASON = {
  SELLER_REJECTED: 'seller_rejected',
  BUYER_CANCEL_PENDING: 'buyer_cancel_pending',
  CONFIRM_TIMEOUT: 'confirm_timeout',
  BUYER_RECEIVED: 'buyer_received',
  SELLER_CANCEL_HOLDING: 'seller_cancel_holding',
  BUYER_CANCEL_HOLDING: 'buyer_cancel_holding',
  BUYER_REPORT_SELLER_ABSENT: 'buyer_report_seller_absent',
  SELLER_REPORT_BUYER_NO_SHOW: 'seller_report_buyer_no_show',
  DISPUTE_BOTH_REPORTED: 'dispute_both_reported',
  PICKUP_TIMEOUT: 'pickup_timeout',
  ADMIN_BUYER_WIN: 'admin_buyer_win',
  ADMIN_SELLER_WIN: 'admin_seller_win',
  ADMIN_COMPLETED: 'admin_completed',
  SELLER_ACCOUNT_LOCKED: 'seller_account_locked',
  SELLER_SHOP_LOCKED: 'seller_shop_locked',
  BUYER_ACCOUNT_LOCKED: 'buyer_account_locked',
  AUTO_BUYER_WIN: 'auto_buyer_win',
  AUTO_SELLER_WIN: 'auto_seller_win',
  BUYER_FORFEIT: 'buyer_forfeit',
  SELLER_REFUND_AFTER_PICKUP: 'seller_refund_after_pickup',
};

export const VIEWER_ROLE = {
  BUYER: 'buyer',
  SELLER: 'seller',
};

const CANCEL_REASON_VIEW_LABELS = {
  [RESERVATION_CANCEL_REASON.SELLER_REJECTED]: {
    buyer: 'Người bán đã từ chối giữ hàng.',
    seller: 'Bạn đã từ chối giữ hàng.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING]: {
    buyer: 'Bạn đã hủy đơn.',
    seller: 'Người mua đã hủy đơn.',
  },
  [RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT]: {
    buyer: 'Đơn đã bị hủy do người bán chưa xác nhận giữ hàng.',
    seller: 'Đơn đã bị hủy do bạn chưa xác nhận giữ hàng.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_RECEIVED]: {
    buyer: 'Đã nhận hàng',
    seller: 'Đã giao hàng',
  },
  [RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING]: {
    buyer: 'Người bán đã hủy đơn. Tiền cọc đã được hoàn lại cho bạn.',
    seller: 'Bạn đã hủy đơn. Tiền cọc đã được hoàn lại cho người mua.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING]: {
    buyer: 'Bạn đã hủy đơn. Tiền cọc đã được chuyển cho người bán.',
    seller: 'Người mua đã hủy đơn. Tiền cọc đã được chuyển cho bạn.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT]: {
    buyer: 'Người bán không có mặt',
    seller: 'Bạn không có mặt',
  },
  [RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW]: {
    buyer: 'Bạn không đến nhận',
    seller: 'Người mua không đến nhận',
  },
  [RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED]: {
    buyer: 'Đang tranh chấp',
    seller: 'Đang tranh chấp',
  },
  [RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT]: {
    buyer:
      'Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên. Tiền cọc đã được chuyển cho người bán.',
    seller:
      'Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên. Tiền cọc đã được chuyển cho bạn.',
  },
  [RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN]: {
    buyer: 'Người bán vắng mặt',
    seller: 'Không có mặt',
  },
  [RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN]: {
    buyer: 'Bạn không đến nhận',
    seller: 'Người mua không đến nhận',
  },
  [RESERVATION_CANCEL_REASON.ADMIN_COMPLETED]: {
    buyer: 'Đã nhận hàng',
    seller: 'Đã giao hàng',
  },
  [RESERVATION_CANCEL_REASON.SELLER_ACCOUNT_LOCKED]: {
    buyer: 'Người bán bị khóa',
    seller: 'Tài khoản bị khóa',
  },
  [RESERVATION_CANCEL_REASON.SELLER_SHOP_LOCKED]: {
    buyer: 'Gian hàng bị khóa',
    seller: 'Gian hàng bị khóa',
  },
  [RESERVATION_CANCEL_REASON.BUYER_ACCOUNT_LOCKED]: {
    buyer: 'Tài khoản bị khóa',
    seller: 'Người mua bị khóa',
  },
  [RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN]: {
    buyer: 'Người bán không phản hồi',
    seller: 'Không phản hồi báo cáo',
  },
  [RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN]: {
    buyer: 'Bạn không phản hồi báo cáo',
    seller: 'Người mua không phản hồi',
  },
  [RESERVATION_CANCEL_REASON.BUYER_FORFEIT]: {
    buyer:
      'Quá giờ nhận hàng, bạn đã đồng ý mất cọc. Tiền cọc đã được chuyển cho người bán.',
    seller:
      'Quá giờ nhận hàng, người mua đã đồng ý mất cọc. Tiền cọc đã được chuyển cho bạn.',
  },
  [RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP]: {
    buyer:
      'Quá giờ nhận hàng, người bán đã hoàn cọc cho bạn. Tiền cọc đã được hoàn lại vào ví của bạn.',
    seller:
      'Quá giờ nhận hàng, bạn đã hoàn cọc cho người mua. Tiền cọc đã được hoàn lại cho người mua.',
  },
};

/** Map chuỗi lý do cũ (free text / nhãn ngắn) → mã reason. */
const LEGACY_CANCEL_REASON_ALIASES = {
  'Quá hạn xác nhận': RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT,
  'Bạn đã bỏ lỡ xác nhận': RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT,
  'Yêu cầu bị từ chối': RESERVATION_CANCEL_REASON.SELLER_REJECTED,
  'Người bán đã từ chối giữ hàng': RESERVATION_CANCEL_REASON.SELLER_REJECTED,
  'Bạn đã từ chối giữ hàng': RESERVATION_CANCEL_REASON.SELLER_REJECTED,
  'Bạn đã đồng ý mất cọc': RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  'Quá hạn nhận hàng': RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT,
};

function resolveCancelReasonCode(raw) {
  const explicit = String(raw || '').trim();
  if (!explicit) {
    return '';
  }
  if (CANCEL_REASON_VIEW_LABELS[explicit]) {
    return explicit;
  }
  return LEGACY_CANCEL_REASON_ALIASES[explicit] || explicit;
}

function wasCancelledAfterPickup(item) {
  if (!item?.pickupTime) {
    return false;
  }
  const pickup = new Date(item.pickupTime);
  const cancelledAt = new Date(item?.cancelledAt || item?.UpdatedAt);
  if (!Number.isFinite(pickup.getTime()) || !Number.isFinite(cancelledAt.getTime())) {
    return false;
  }
  return cancelledAt.getTime() >= pickup.getTime();
}

function normalizeViewerRole(role) {
  return String(role || '').trim().toLowerCase() === VIEWER_ROLE.SELLER
    ? VIEWER_ROLE.SELLER
    : VIEWER_ROLE.BUYER;
}

export function inferCancelReasonCode(item) {
  const fromReasonCode = resolveCancelReasonCode(item?.reasonCode);
  if (CANCEL_REASON_VIEW_LABELS[fromReasonCode]) {
    return fromReasonCode;
  }

  const fromCancelReason = resolveCancelReasonCode(item?.cancelReason);
  if (CANCEL_REASON_VIEW_LABELS[fromCancelReason]) {
    return fromCancelReason;
  }

  const explicit = fromCancelReason || fromReasonCode;

  const status = Number(item?.status);
  const cancelledBy = String(item?.cancelledBy || '').trim();
  const disputeByBuyer = Boolean(item?.disputeByBuyer);
  const disputeBySeller = Boolean(item?.disputeBySeller);

  if (status === 4) {
    if (disputeByBuyer && disputeBySeller) {
      return RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED;
    }
    if (disputeByBuyer) {
      return RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT;
    }
    if (disputeBySeller) {
      return RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW;
    }
    return RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED;
  }

  if (status === 3 || status === 5) {
    return RESERVATION_CANCEL_REASON.BUYER_RECEIVED;
  }

  if (cancelledBy === 'seller_reject') {
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  if (cancelledBy === 'seller_after_accept' || item?.cancelledBySellerAfterAccept) {
    if (
      explicit === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
      wasCancelledAfterPickup(item)
    ) {
      return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
    }
    return RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  }
  if (cancelledBy === 'buyer') {
    return item?.sellerConfirmedAt
      ? RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING
      : RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (cancelledBy === 'system') {
    return explicit.includes('xác nhận')
      ? RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT
      : RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }
  if (cancelledBy === 'admin') {
    return Number(item?.depositSettleTo) === 2
      ? RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN
      : RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
  }

  if (status === 1) {
    if (cancelledBy === 'system' || explicit.includes('xác nhận')) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  if (status === 6) {
    if (disputeByBuyer || disputeBySeller) {
      return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
    }
    if (cancelledBy === 'seller_after_accept' || item?.cancelledBySellerAfterAccept) {
      return wasCancelledAfterPickup(item)
        ? RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
        : RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
    }
    return RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (status === 7) {
    if (CANCEL_REASON_VIEW_LABELS[explicit]) {
      return explicit;
    }
    if (cancelledBy === 'buyer' && Number(item?.depositSettleTo) === 2) {
      return RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
    }
    return Number(item?.depositSettleTo) === 1
      ? RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN
      : RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }

  return explicit;
}

export function getReservationReasonLabel(item, viewerRole = VIEWER_ROLE.BUYER) {
  const role = normalizeViewerRole(viewerRole);
  const status = Number(item?.status);

  if (status === 0) {
    return '';
  }

  const code = inferCancelReasonCode(item);
  const labels = CANCEL_REASON_VIEW_LABELS[code];
  if (labels) {
    return labels[role] || labels.buyer || '';
  }

  return '';
}
