import {
  RESERVATION_CANCEL_REASON,
  inferCancelReasonCode,
  isPostDeliveryDisputeReservation,
} from '../../constants/reservationOrderFlow';
import {
  getPickupConfirmedAt,
  getReservationCancelNote,
  isCancelledBySellerAfterAccept,
} from './reservationEntity';

const R = RESERVATION_CANCEL_REASON;

const STEP_DEFS = {
  created: { key: 'created', label: 'Tạo đơn', tone: 'neutral' },
  pending_confirm: { key: 'pending_confirm', label: 'Chờ xác nhận', tone: 'orange' },
  confirmed: { key: 'confirmed', label: 'Xác nhận', tone: 'green' },
  holding: { key: 'holding', label: 'Giữ hàng', tone: 'green' },
  received: { key: 'received', label: 'Đã nhận hàng', tone: 'green' },
  completed: { key: 'completed', label: 'Hoàn thành', tone: 'green' },
  pickup_overdue: { key: 'pickup_overdue', label: 'Quá giờ nhận hàng', tone: 'orange' },
  dispute: { key: 'dispute', label: 'Tranh chấp', tone: 'purple' },
  cancelled: { key: 'cancelled', label: 'Đã hủy', tone: 'red' },
};

const TERMINAL_KEYS_BY_REASON = {
  [R.CONFIRM_TIMEOUT]: ['created', 'pending_confirm', 'cancelled'],
  [R.SELLER_REJECTED]: ['created', 'cancelled'],
  [R.BUYER_CANCEL_PENDING]: ['created', 'cancelled'],
  [R.BUYER_CANCEL_HOLDING]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.SELLER_CANCEL_HOLDING]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.SELLER_REFUND_AFTER_PICKUP]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'cancelled'],
  [R.BUYER_RECEIVED]: ['created', 'confirmed', 'holding', 'received', 'completed'],
  [R.BUYER_REPORT_SELLER_ABSENT]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.SELLER_REPORT_BUYER_NO_SHOW]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.DISPUTE_BOTH_REPORTED]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.BUYER_POST_DELIVERY_COMPLAINT]: [
    'created',
    'confirmed',
    'holding',
    'received',
    'dispute',
    'cancelled',
  ],
  [R.PICKUP_TIMEOUT]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'cancelled'],
  [R.ADMIN_BUYER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.ADMIN_SELLER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.AUTO_BUYER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.AUTO_SELLER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.BUYER_FORFEIT]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'cancelled'],
  [R.ADMIN_COMPLETED]: ['created', 'confirmed', 'holding', 'completed'],
  [R.SELLER_ACCOUNT_LOCKED]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.SELLER_SHOP_LOCKED]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.BUYER_ACCOUNT_LOCKED]: ['created', 'cancelled'],
};

const OUTCOME_REASON = {
  [R.CONFIRM_TIMEOUT]: 'Người bán không xác nhận giữ hàng trong thời gian quy định.',
  [R.SELLER_REJECTED]: 'Người bán từ chối yêu cầu giữ hàng.',
  [R.BUYER_CANCEL_PENDING]: 'Người mua hủy đơn trước khi người bán xác nhận.',
  [R.BUYER_CANCEL_HOLDING]: 'Người mua hủy đơn sau khi người bán đã xác nhận giữ hàng.',
  [R.SELLER_CANCEL_HOLDING]: 'Người bán chủ động hủy đơn sau khi đã xác nhận giữ hàng.',
  [R.SELLER_REFUND_AFTER_PICKUP]:
    'Quá giờ nhận hàng, người bán đã đồng ý hoàn cọc.',
  [R.BUYER_RECEIVED]: 'Người mua đã xác nhận nhận hàng thành công.',
  [R.BUYER_REPORT_SELLER_ABSENT]: 'Người mua báo cáo người bán không giao hàng đúng hẹn (chưa nhận hàng).',
  [R.SELLER_REPORT_BUYER_NO_SHOW]: 'Người bán báo cáo người mua không đến nhận hàng.',
  [R.DISPUTE_BOTH_REPORTED]: 'Cả người mua và người bán đều gửi báo cáo (chưa hoàn tất nhận hàng).',
  [R.BUYER_POST_DELIVERY_COMPLAINT]:
    'Người mua khiếu nại sau khi shop đã xác nhận giao hàng (hàng hỏng, thiếu, sai mô tả…).',
  [R.PICKUP_TIMEOUT]: 'Quá thời gian nhận hàng và không có phản hồi từ hai bên.',
  [R.ADMIN_BUYER_WIN]: 'Admin xử lý tranh chấp theo hướng hoàn cọc cho người mua.',
  [R.ADMIN_SELLER_WIN]: 'Admin xử lý tranh chấp theo hướng chuyển cọc cho người bán.',
  [R.AUTO_BUYER_WIN]: 'Người bán không phản hồi báo cáo trong thời hạn quy định.',
  [R.AUTO_SELLER_WIN]: 'Người mua không phản hồi báo cáo trong thời hạn quy định.',
  [R.BUYER_FORFEIT]: 'Quá giờ nhận hàng, người mua đã đồng ý mất cọc.',
};

const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

function isPastPickup(reservation) {
  if (reservation?.isPastPickup) return true;
  if (!reservation?.pickupTime) return false;
  const pickup = new Date(reservation.pickupTime);
  return Number.isFinite(pickup.getTime()) && pickup.getTime() <= Date.now();
}

const PICKUP_DISPUTE_TERMINAL_REASONS = new Set([
  R.BUYER_REPORT_SELLER_ABSENT,
  R.SELLER_REPORT_BUYER_NO_SHOW,
  R.DISPUTE_BOTH_REPORTED,
  R.PICKUP_TIMEOUT,
  R.ADMIN_BUYER_WIN,
  R.ADMIN_SELLER_WIN,
  R.AUTO_BUYER_WIN,
  R.AUTO_SELLER_WIN,
  R.BUYER_FORFEIT,
]);

function isPostDeliveryTimeline(reservation, reasonCode) {
  if (reasonCode === R.BUYER_POST_DELIVERY_COMPLAINT) {
    return true;
  }
  if (!isPostDeliveryDisputeReservation(reservation)) {
    return false;
  }
  if (Number(reservation?.status) === 2 || Number(reservation?.status) === 3) {
    return true;
  }
  return (
    reasonCode === R.ADMIN_BUYER_WIN ||
    reasonCode === R.ADMIN_SELLER_WIN ||
    reasonCode === R.AUTO_BUYER_WIN ||
    reasonCode === R.AUTO_SELLER_WIN
  );
}

function buildPostDeliveryDisputeTerminalKeys(basePrefix = ['created', 'confirmed', 'holding']) {
  return [...basePrefix, 'received', 'dispute', 'cancelled'];
}

function buildPostDeliveryDisputeResolvedKeys(basePrefix = ['created', 'confirmed', 'holding']) {
  return [...basePrefix, 'received', 'dispute', 'completed'];
}

function buildPickupDisputeTerminalKeys(basePrefix = ['created', 'confirmed', 'holding']) {
  return [...basePrefix, 'pickup_overdue', 'dispute', 'cancelled'];
}

function resolveStepAt(reservation, stepKey) {
  switch (stepKey) {
    case 'created':
      return reservation.createdAt;
    case 'pending_confirm':
      return reservation.createdAt;
    case 'confirmed':
      return reservation.tgShopXN || reservation.confirmedAt;
    case 'holding':
      return reservation.createdAt || reservation.tgShopXN || reservation.confirmedAt;
    case 'received':
      return getPickupConfirmedAt(reservation);
    case 'completed':
      return getPickupConfirmedAt(reservation);
    case 'pickup_overdue':
      return reservation.pickupTime;
    case 'dispute':
      return (
        reservation.disputedAt ||
        reservation.buyerDisputedAt ||
        reservation.sellerDisputedAt
      );
    case 'cancelled':
      return reservation.cancelledAt || reservation.updatedAt;
    default:
      return null;
  }
}

function isDepositSettled(reservation) {
  const code = Number(reservation?.cocChuyenDen);
  return code === DEPOSIT_SETTLE_TO.BUYER || code === DEPOSIT_SETTLE_TO.SELLER;
}

function resolveTimelineKeys(reservation, reasonCode) {
  const status = Number(reservation?.status);
  const postDelivery = isPostDeliveryTimeline(reservation, reasonCode);

  if (status === 0) {
    return ['created', 'pending_confirm'];
  }
  if (status === 1) {
    const keys = ['created', 'confirmed', 'holding'];
    if (isPastPickup(reservation)) {
      keys.push('pickup_overdue');
    }
    return keys;
  }
  if (status === 2) {
    return ['created', 'confirmed', 'holding', 'received'];
  }
  if (status === 3) {
    if (isDepositSettled(reservation)) {
      if (postDelivery) {
        if (Number(reservation.cocChuyenDen) === DEPOSIT_SETTLE_TO.BUYER) {
          return buildPostDeliveryDisputeTerminalKeys();
        }
        return buildPostDeliveryDisputeResolvedKeys();
      }
      if (Number(reservation.cocChuyenDen) === DEPOSIT_SETTLE_TO.SELLER) {
        return ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'completed'];
      }
      return ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'];
    }
    if (postDelivery) {
      return ['created', 'confirmed', 'holding', 'received', 'dispute'];
    }
    const keys = ['created', 'confirmed', 'holding'];
    if (isPastPickup(reservation)) {
      keys.push('pickup_overdue');
    }
    keys.push('dispute');
    return keys;
  }

  const terminal = TERMINAL_KEYS_BY_REASON[reasonCode];
  if (terminal) {
    if (postDelivery && PICKUP_DISPUTE_TERMINAL_REASONS.has(reasonCode)) {
      return buildPostDeliveryDisputeTerminalKeys();
    }
    if (postDelivery && reasonCode === R.ADMIN_SELLER_WIN) {
      return buildPostDeliveryDisputeResolvedKeys();
    }
    return terminal;
  }
  return ['created', 'cancelled'];
}

function isTerminalStatus(status, reservation) {
  const code = Number(status);
  if (code === 4 || code === 5) {
    return true;
  }
  if (code === 3 && isDepositSettled(reservation)) {
    return true;
  }
  return false;
}

function buildSteps(reservation, reasonCode) {
  const status = Number(reservation?.status);
  const keys = resolveTimelineKeys(reservation, reasonCode);
  const isActive = !isTerminalStatus(status, reservation);

  return keys.map((key, index) => {
    const def = { ...STEP_DEFS[key] };
    const isLast = index === keys.length - 1;
    return {
      ...def,
      at: resolveStepAt(reservation, key),
      state: isActive && isLast ? 'current' : 'done',
    };
  });
}

function resolveFinalStatusLabel(reservation) {
  const status = Number(reservation?.status);
  if (status === 4) return 'Hoàn thành';
  if (status === 3 && isDepositSettled(reservation)) return 'Hoàn tất tranh chấp';
  if (status === 5) return 'Đã hủy';
  if (status === 3) return 'Tranh chấp';
  if (status === 2) return 'Đã nhận hàng';
  if (status === 1) {
    return isPastPickup(reservation) ? 'Quá giờ nhận' : 'Giữ hàng';
  }
  if (status === 0) return 'Chờ xác nhận';
  return 'Không rõ';
}

export function resolveAdminListStatusMeta(reservation) {
  const status = Number(reservation?.status);
  if (status === 4) {
    return { label: 'Hoàn thành', className: 'badge badge-success' };
  }
  if (status === 3 && isDepositSettled(reservation)) {
    return { label: 'Hoàn tất tranh chấp', className: 'badge badge-success' };
  }
  if (status === 5) {
    return { label: 'Đã hủy', className: 'badge badge-danger' };
  }
  if (status === 3) {
    return { label: 'Tranh chấp', className: 'badge badge-warning' };
  }
  if (status === 2) {
    return { label: 'Đã nhận hàng', className: 'badge badge-info' };
  }
  if (status === 0) {
    return { label: 'Chờ xác nhận', className: 'badge badge-warning' };
  }
  if (status === 1) {
    if (isPastPickup(reservation)) {
      return { label: 'Quá giờ nhận', className: 'badge badge-warning' };
    }
    return { label: 'Giữ hàng', className: 'badge badge-warning' };
  }
  return { label: 'Không rõ', className: 'badge badge-secondary' };
}

function resolveActorLabel(reservation, reasonCode) {
  const cancelledBy = String(reservation?.cancelType || '').trim();
  const status = Number(reservation?.status);

  if (reasonCode === R.CONFIRM_TIMEOUT || reasonCode === R.PICKUP_TIMEOUT) {
    return 'Hệ thống';
  }
  if (cancelledBy === 'buyer') return 'Người mua';
  if (cancelledBy === 'seller' || cancelledBy === 'seller_reject' || cancelledBy === 'seller_after_accept') {
    return 'Người bán';
  }
  if (cancelledBy === 'admin') return 'Admin';
  if (cancelledBy === 'system') return 'Hệ thống';
  if (status === 3) {
    if (reservation.disputeByBuyer && reservation.disputeBySeller) return 'Người mua & Người bán';
    if (reservation.disputeByBuyer) return 'Người mua';
    if (reservation.disputeBySeller) return 'Người bán';
  }
  if (status === 4) return 'Người mua';
  return '—';
}

function resolveDepositResult(reservation, reasonCode) {
  const status = Number(reservation?.status);
  const settleTo = Number(reservation?.cocChuyenDen);
  const label = String(reservation?.cocChuyenDenLabel || '').trim();

  if (
    status === 3 &&
    !isDepositSettled(reservation) &&
    reasonCode === R.DISPUTE_BOTH_REPORTED
  ) {
    return {
      recipient: '—',
      text: 'Đang chờ Admin quyết định phân bổ tiền cọc.',
    };
  }

  if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
    return {
      recipient: 'Người mua',
      text: 'Tiền cọc đã được hoàn cho người mua.',
    };
  }
  if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
    return {
      recipient: 'Người bán',
      text: 'Tiền cọc đã được chuyển cho người bán.',
    };
  }
  if (settleTo === DEPOSIT_SETTLE_TO.NONE) {
    return {
      recipient: '—',
      text: label || 'Tiền cọc đang được giữ (escrow).',
    };
  }
  return {
    recipient: '—',
    text: label || 'Chưa xác định kết quả cọc.',
  };
}

function resolveOutcomeReason(reservation, reasonCode) {
  if (OUTCOME_REASON[reasonCode]) {
    return OUTCOME_REASON[reasonCode];
  }
  const human = String(reservation?.reasonLabelBuyer || '').trim();
  if (human && !/^[a-z0-9_]+$/i.test(human)) {
    return human;
  }
  const note = getReservationCancelNote(reservation);
  if (note) return note;
  return '—';
}

function resolveProcessedAt(reservation) {
  return (
    reservation.tgGiaiCoc ||
    reservation.cancelledAt ||
    getPickupConfirmedAt(reservation) ||
    reservation.updatedAt ||
    null
  );
}

function shouldShowSellerEvidence(reservation, reasonCode) {
  return (
    reasonCode === R.SELLER_CANCEL_HOLDING ||
    isCancelledBySellerAfterAccept(reservation)
  );
}

export function buildReservationOrderTimeline(reservation) {
  if (!reservation) {
    return { steps: [], outcome: null };
  }

  const reasonCode = inferCancelReasonCode(reservation);
  const postDelivery = isPostDeliveryTimeline(reservation, reasonCode);
  const steps = buildSteps(reservation, reasonCode);
  const deposit = resolveDepositResult(reservation, reasonCode);
  const showSellerEvidence = shouldShowSellerEvidence(reservation, reasonCode);
  const showOutcome = isTerminalStatus(reservation.status, reservation);

  const outcome = showOutcome
    ? {
        statusLabel: resolveFinalStatusLabel(reservation),
        reason: resolveOutcomeReason(reservation, reasonCode),
        actor: resolveActorLabel(reservation, reasonCode),
        tgXuLy: resolveProcessedAt(reservation),
        depositAmount: Number(reservation.depositAmount) || 0,
        depositRecipient: deposit.recipient,
        depositResult: deposit.text,
        sellerCancelNote: showSellerEvidence ? getReservationCancelNote(reservation) : '',
        anhHuyShop: showSellerEvidence
          ? (Array.isArray(reservation.anhHuyShop)
              ? reservation.anhHuyShop.filter(Boolean)
              : [])
          : [],
      }
    : null;

  return { steps, outcome, reasonCode, showOutcome, postDelivery };
}
