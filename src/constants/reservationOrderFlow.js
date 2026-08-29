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
  BUYER_POST_DELIVERY_COMPLAINT: 'buyer_post_delivery_complaint',
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
    seller: 'Người bán đã từ chối giữ hàng.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING]: {
    buyer: 'Người mua đã hủy đơn.',
    seller: 'Người mua đã hủy đơn.',
  },
  [RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT]: {
    buyer: 'Đơn đã bị hủy do người bán chưa xác nhận giữ hàng.',
    seller: 'Đơn đã bị hủy do người bán chưa xác nhận giữ hàng.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_RECEIVED]: {
    buyer: 'Đã nhận hàng',
    seller: 'Đã giao hàng',
  },
  [RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING]: {
    buyer: 'Người bán đã hủy đơn.',
    seller: 'Người bán đã hủy đơn.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING]: {
    buyer: 'Người mua đã hủy đơn.',
    seller: 'Người mua đã hủy đơn.',
  },
  [RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT]: {
    buyer: 'Người bán không có mặt',
    seller: 'Người bán không có mặt',
  },
  [RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW]: {
    buyer: 'Người mua không đến nhận',
    seller: 'Người mua không đến nhận',
  },
  [RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED]: {
    buyer: 'Đang tranh chấp',
    seller: 'Đang tranh chấp',
  },
  [RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT]: {
    buyer: 'Khiếu nại sau khi đã nhận hàng',
    seller: 'Khách khiếu nại sau khi đã nhận hàng',
  },
  [RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT]: {
    buyer: 'Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên.',
    seller: 'Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên.',
  },
  [RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN]: {
    buyer: 'Admin xử lý tranh chấp.',
    seller: 'Admin xử lý tranh chấp.',
  },
  [RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN]: {
    buyer: 'Admin xử lý tranh chấp.',
    seller: 'Admin xử lý tranh chấp.',
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
    buyer: 'Người mua thắng tranh chấp do người bán không phản hồi trong 48 giờ',
    seller: 'Người mua thắng tranh chấp do người bán không phản hồi trong 48 giờ',
  },
  [RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN]: {
    buyer: 'Người bán thắng tranh chấp do người mua không phản hồi trong 48 giờ',
    seller: 'Người bán thắng tranh chấp do người mua không phản hồi trong 48 giờ',
  },
  [RESERVATION_CANCEL_REASON.BUYER_FORFEIT]: {
    buyer: 'Quá giờ nhận hàng, người mua đã đồng ý mất cọc.',
    seller: 'Quá giờ nhận hàng, người mua đã đồng ý mất cọc.',
  },
  [RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP]: {
    buyer: 'Quá giờ nhận hàng, người bán đã đồng ý hoàn cọc.',
    seller: 'Quá giờ nhận hàng, người bán đã đồng ý hoàn cọc.',
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
  'Bạn đã đồng ý mất cọc sau quá giờ nhận hàng.': RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  'Người mua đã đồng ý mất cọc sau quá giờ nhận hàng.': RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  'Người bán đã hoàn cọc sau quá giờ nhận hàng.': RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP,
  'Bạn đã hoàn cọc cho người mua sau quá giờ nhận hàng.': RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP,
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

export function isPostDeliveryDisputeReservation(reservation) {
  if (!reservation) {
    return false;
  }
  if (reservation.isPostDeliveryDispute === true) {
    return true;
  }
  const kind = String(reservation.disputeKind || '').trim().toLowerCase();
  if (kind === 'post_delivery') {
    return true;
  }
  const reason = String(reservation.cancelType || reservation.reasonCode || '').trim();
  if (reason === RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT) {
    return true;
  }
  const legacyReason = String(reservation.cancelNote || '').trim();
  if (legacyReason === RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT) {
    return true;
  }
  const pickupAt = reservation.tgNhanHang || reservation.completedAt;
  if (pickupAt && (reservation.disputedAt || reservation.disputeByBuyer)) {
    const completed = new Date(pickupAt);
    const disputed = new Date(
      reservation.disputedAt || reservation.buyerDisputedAt || reservation.updatedAt
    );
    if (
      Number.isFinite(completed.getTime()) &&
      Number.isFinite(disputed.getTime()) &&
      disputed.getTime() >= completed.getTime()
    ) {
      return true;
    }
  }
  return false;
}

function resolveCancelActor(item) {
  const cancelledBy = String(item?.cancelledBy || '').trim();
  if (cancelledBy) {
    return cancelledBy;
  }
  const cancelTypeRaw = String(item?.cancelType || '').trim();
  const legacyActors = new Set([
    'buyer',
    'seller_reject',
    'seller_after_accept',
    'system',
    'admin',
  ]);
  if (legacyActors.has(cancelTypeRaw)) {
    return cancelTypeRaw;
  }
  return '';
}

export function inferCancelReasonCode(item) {
  const fromReasonCode = resolveCancelReasonCode(item?.reasonCode);
  if (CANCEL_REASON_VIEW_LABELS[fromReasonCode]) {
    return fromReasonCode;
  }

  const fromCancelType = resolveCancelReasonCode(item?.cancelType);
  if (CANCEL_REASON_VIEW_LABELS[fromCancelType]) {
    return fromCancelType;
  }

  const fromLegacyCancelReason = resolveCancelReasonCode(item?.cancelReason);
  if (CANCEL_REASON_VIEW_LABELS[fromLegacyCancelReason]) {
    return fromLegacyCancelReason;
  }

  const fromCancelNoteCode = resolveCancelReasonCode(item?.cancelNote);
  if (CANCEL_REASON_VIEW_LABELS[fromCancelNoteCode]) {
    return fromCancelNoteCode;
  }

  const explicit =
    fromCancelNoteCode || fromCancelType || fromLegacyCancelReason || fromReasonCode;
  const status = Number(item?.status);
  const cancelledBy = resolveCancelActor(item);
  const disputeByBuyer = Boolean(item?.disputeByBuyer);
  const disputeBySeller = Boolean(item?.disputeBySeller);

  if (status === 3) {
    const settleTo = Number(item?.cocChuyenDen);
    if (settleTo === 1 || settleTo === 2) {
      const explicitSettled =
        resolveCancelReasonCode(item?.reasonCode) ||
        resolveCancelReasonCode(item?.cancelType) ||
        resolveCancelReasonCode(item?.cancelReason) ||
        resolveCancelReasonCode(item?.cancelNote);
      if (CANCEL_REASON_VIEW_LABELS[explicitSettled]) {
        return explicitSettled;
      }
      if (settleTo === 1) {
        if (cancelledBy === 'system') return RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN;
        if (cancelledBy === 'seller_after_accept' || item?.cancelledBySellerAfterAccept) {
          return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
        }
        return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
      }
      if (settleTo === 2) {
        if (cancelledBy === 'system') return RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN;
        return RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
      }
    }
    if (isPostDeliveryDisputeReservation(item)) {
      return RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT;
    }
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

  if (status === 4) {
    return RESERVATION_CANCEL_REASON.BUYER_RECEIVED;
  }

  if (cancelledBy === 'seller_reject') {
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }

  if (status === 5) {
    if (
      (cancelledBy === 'buyer' || fromCancelType === RESERVATION_CANCEL_REASON.BUYER_FORFEIT) &&
      Number(item?.cocChuyenDen) === 2
    ) {
      return RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
    }
  }

  if (
    cancelledBy === 'seller_after_accept' ||
    item?.cancelledBySellerAfterAccept === true
  ) {
    if (
      explicit === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
      wasCancelledAfterPickup(item)
    ) {
      return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
    }
    return RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  }
  if (cancelledBy === 'buyer') {
    return status === 1 || item?.tgShopXN
      ? RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING
      : RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (cancelledBy === 'system') {
    if (explicit.includes('xác nhận') || explicit.includes('shop chưa')) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }
  if (cancelledBy === 'admin') {
    const settleTo = Number(item?.cocChuyenDen);
    if (settleTo === 2) {
      return RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
    }
    return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
  }

  if (status === 1) {
    if (cancelledBy === 'system' || explicit.includes('xác nhận')) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  return explicit;
}

const GENERIC_ADMIN_RESOLUTION_NOTES = new Set([
  'Admin hoàn cọc cho người mua.',
  'Admin xử lý tranh chấp: đền cọc cho người bán.',
  'Shop tự hoàn cọc trong tranh chấp.',
  'Shop tự hoàn cọc cho người mua.',
  'Buyer đồng ý mất cọc.',
]);

function resolveAdminResolutionNote(item) {
  const note = String(item?.cancelNote || '').trim();
  if (!note || GENERIC_ADMIN_RESOLUTION_NOTES.has(note)) {
    return '';
  }
  if (/^[a-z0-9_]+$/i.test(note) && note.includes('_')) {
    return '';
  }
  return note;
}

function formatDisputeOutcomeLabel(baseLabel, code, item) {
  if (
    code !== RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN &&
    code !== RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN
  ) {
    return baseLabel;
  }
  const note = resolveAdminResolutionNote(item);
  return note ? `${baseLabel}. Lý do: ${note}` : baseLabel;
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
    const base = labels[role] || labels.buyer || '';
    return formatDisputeOutcomeLabel(base, code, item);
  }

  return '';
}
