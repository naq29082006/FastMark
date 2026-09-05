import {
  RESERVATION_CANCEL_REASON,
  VIEWER_ROLE,
  getReservationReasonLabel,
  inferCancelReasonCode,
} from './reservationOrderFlow';

export const RESERVATION_STATUS = {
  PENDING: 0,
  WAITING_PICKUP: 1,
  PICKUP_CONFIRMED: 2,
  DISPUTED: 3,
  COMPLETED: 4,
  CANCELLED: 5,
  /** @deprecated aliases */
  PENDING_SELLER_CONFIRMATION: 0,
  REJECTED: 5,
  RECEIVED: 2,
  DELIVERED_PENDING_DISPUTE: 2,
  AUTO_COMPLETED: 4,
  REFUNDED: 5,
  /** @deprecated — dùng DISPUTED (3) + cocChuyenDen */
  DISPUTE_RESOLVED: 3,
};

export const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: 'Chờ xác nhận',
  [RESERVATION_STATUS.WAITING_PICKUP]: 'Giữ hàng',
  [RESERVATION_STATUS.PICKUP_CONFIRMED]: 'Đã nhận hàng',
  [RESERVATION_STATUS.DISPUTED]: 'Tranh chấp',
  [RESERVATION_STATUS.COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.CANCELLED]: 'Đã hủy',
};

export const DISPUTE_RESOLVED_STATUS_LABEL = 'Tranh chấp đã xử lý';

export const RESERVATION_TAB = {
  ALL: 'all',
  PENDING: 'pending',
  HOLDING: 'holding',
  DISPUTE: 'dispute',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/** Sub-tab trong mục Tranh chấp. */
export const DISPUTE_SUB_TAB = {
  ACTIVE: 'dispute_active',
  HISTORY: 'dispute_history',
};

export const DISPUTE_SUB_TAB_LABELS = {
  [DISPUTE_SUB_TAB.ACTIVE]: 'Đang tranh chấp',
  [DISPUTE_SUB_TAB.HISTORY]: 'Lịch sử tranh chấp',
};

export const DISPUTE_SUB_TABS = [
  { key: DISPUTE_SUB_TAB.ACTIVE, label: DISPUTE_SUB_TAB_LABELS[DISPUTE_SUB_TAB.ACTIVE] },
  { key: DISPUTE_SUB_TAB.HISTORY, label: DISPUTE_SUB_TAB_LABELS[DISPUTE_SUB_TAB.HISTORY] },
];

export const DISPUTE_SUB_TAB_EMPTY_MESSAGE = {
  [DISPUTE_SUB_TAB.ACTIVE]: 'Chưa có đơn đang tranh chấp',
  [DISPUTE_SUB_TAB.HISTORY]: 'Chưa có lịch sử tranh chấp',
};

/** Sub-filter trong tab Hoàn thành. */
export const COMPLETED_SUB_TAB = {
  ALL: 'completed',
  PICKUP: 'completed_pickup',
  DONE: 'completed_done',
};

export const COMPLETED_SUB_TAB_LABELS = {
  [COMPLETED_SUB_TAB.ALL]: 'Tất cả',
  [COMPLETED_SUB_TAB.PICKUP]: 'Đã nhận hàng',
  [COMPLETED_SUB_TAB.DONE]: 'Hoàn thành',
};

export const COMPLETED_SUB_TABS = [
  { key: COMPLETED_SUB_TAB.ALL, label: COMPLETED_SUB_TAB_LABELS[COMPLETED_SUB_TAB.ALL] },
  { key: COMPLETED_SUB_TAB.PICKUP, label: COMPLETED_SUB_TAB_LABELS[COMPLETED_SUB_TAB.PICKUP] },
  { key: COMPLETED_SUB_TAB.DONE, label: COMPLETED_SUB_TAB_LABELS[COMPLETED_SUB_TAB.DONE] },
];

export const COMPLETED_SUB_TAB_EMPTY_MESSAGE = {
  [COMPLETED_SUB_TAB.ALL]: 'Chưa có đơn trong mục này',
  [COMPLETED_SUB_TAB.PICKUP]: 'Chưa có đơn đã nhận hàng',
  [COMPLETED_SUB_TAB.DONE]: 'Chưa có đơn hoàn thành',
};

export const RESERVATION_TAB_LABELS = {
  all: 'Tất cả',
  pending: 'Chờ xác nhận',
  holding: 'Giữ hàng',
  dispute: 'Tranh chấp',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const ORDER_STATUS_TABS = [
  { key: RESERVATION_TAB.PENDING, label: RESERVATION_TAB_LABELS.pending },
  { key: RESERVATION_TAB.HOLDING, label: RESERVATION_TAB_LABELS.holding },
  { key: RESERVATION_TAB.DISPUTE, label: RESERVATION_TAB_LABELS.dispute },
  { key: RESERVATION_TAB.COMPLETED, label: RESERVATION_TAB_LABELS.completed },
  { key: RESERVATION_TAB.CANCELLED, label: RESERVATION_TAB_LABELS.cancelled },
];

export { RESERVATION_CANCEL_REASON, VIEWER_ROLE, getReservationReasonLabel, inferCancelReasonCode };

export const RESERVATION_DISPUTE_REASON = {
  SELLER_ABSENT: 'seller_absent',
  SHOP_CLOSED: 'shop_closed',
  SELLER_NO_DELIVERY: 'seller_no_delivery',
  SHOP_NO_DELIVERY: 'shop_no_delivery',
  SHOP_OUT_OF_STOCK: 'shop_out_of_stock',
  OTHER: 'other',
  BUYER_NO_SHOW: 'buyer_no_show',
  DAMAGED_ITEM: 'damaged_item',
  MISSING_ITEM: 'missing_item',
  WRONG_ITEM: 'wrong_item',
  NOT_AS_DESCRIBED: 'not_as_described',
  EXPIRED: 'expired',
};

export const RESERVATION_DISPUTE_REASON_LABELS = {
  [RESERVATION_DISPUTE_REASON.SELLER_ABSENT]: 'Người bán không có mặt',
  [RESERVATION_DISPUTE_REASON.SHOP_CLOSED]: 'Shop đóng cửa',
  [RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY]: 'Người bán không giao hàng',
  [RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY]: 'Người bán không giao hàng',
  [RESERVATION_DISPUTE_REASON.SHOP_OUT_OF_STOCK]: 'Shop hết hàng',
  [RESERVATION_DISPUTE_REASON.OTHER]: 'Khác',
  [RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW]: 'Người mua không đến nhận hàng',
  [RESERVATION_DISPUTE_REASON.DAMAGED_ITEM]: 'Hàng hỏng',
  [RESERVATION_DISPUTE_REASON.MISSING_ITEM]: 'Thiếu hàng',
  [RESERVATION_DISPUTE_REASON.WRONG_ITEM]: 'Giao sai hàng',
  [RESERVATION_DISPUTE_REASON.NOT_AS_DESCRIBED]: 'Không như quảng cáo',
  [RESERVATION_DISPUTE_REASON.EXPIRED]: 'Hết hạn',
};

export const BUYER_DISPUTE_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.SELLER_ABSENT,
  RESERVATION_DISPUTE_REASON.SHOP_CLOSED,
  RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY,
  RESERVATION_DISPUTE_REASON.OTHER,
];

/** Khiếu nại sau khi đã nhận hàng / hoàn thành (khác lý do quá giờ nhận). */
export const BUYER_POST_DELIVERY_COMPLAINT_OPTIONS = [
  RESERVATION_DISPUTE_REASON.DAMAGED_ITEM,
  RESERVATION_DISPUTE_REASON.MISSING_ITEM,
  RESERVATION_DISPUTE_REASON.NOT_AS_DESCRIBED,
  RESERVATION_DISPUTE_REASON.OTHER,
];

/** Seller báo cáo người mua quá giờ nhận — chọn lý do trước khi gửi. */
export const SELLER_DISPUTE_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW,
  RESERVATION_DISPUTE_REASON.OTHER,
];

export function getSellerDisputeReasonPickerLabel(reason) {
  if (reason === RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW) {
    return 'Người mua không đến';
  }
  if (reason === RESERVATION_DISPUTE_REASON.OTHER) {
    return 'Lý do khác';
  }
  return RESERVATION_DISPUTE_REASON_LABELS[reason] || 'Lý do khác';
}

/** Dòng tóm tắt khiếu nại / báo cáo / phản hồi theo bên và góc nhìn. */
export function buildDisputeSideSummaryLine(
  side,
  viewerRole,
  reasonLabel,
  { isResponse = false, omitReason = false } = {}
) {
  const reason = String(reasonLabel || '').trim() || '—';
  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
  const withReason = (label) => (omitReason ? label : `${label}: ${reason}`);

  if (isResponse) {
    if (side === 'buyer') {
      return isViewerBuyer
        ? withReason('Người mua đã phản hồi')
        : withReason('Người mua đã phản hồi');
    }
    return isViewerBuyer
      ? withReason('Người bán đã phản hồi')
      : withReason('Người bán đã phản hồi');
  }

  if (side === 'buyer') {
    return isViewerBuyer
      ? withReason('Người mua đã khiếu nại')
      : withReason('Người mua đã khiếu nại');
  }

  return isViewerBuyer
    ? withReason('Người bán đã báo cáo')
    : withReason('Người bán đã báo cáo');
}

export const BUYER_COMPLAINT_REASON_OPTIONS = BUYER_POST_DELIVERY_COMPLAINT_OPTIONS;

export const BUYER_COMPLAINT_REASON_LABELS = {
  damaged_item: RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.DAMAGED_ITEM],
  missing_item: RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.MISSING_ITEM],
  wrong_item: RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.WRONG_ITEM],
  not_as_described: RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.NOT_AS_DESCRIBED],
  expired: RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.EXPIRED],
  other: RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.OTHER],
};

export const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

const CANCELLED_RESERVATION_STATUSES = new Set([
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.REFUNDED,
  RESERVATION_STATUS.CANCELLED,
]);

const COMPLETED_RESERVATION_STATUSES = new Set([
  RESERVATION_STATUS.PICKUP_CONFIRMED,
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.AUTO_COMPLETED,
  RESERVATION_STATUS.RECEIVED,
]);

const DISPUTE_RELATED_CANCEL_REASONS = new Set([
  RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT,
  RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW,
  RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED,
  RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN,
  RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN,
  RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN,
  RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN,
]);

export function isDisputeRelatedCancellation(item) {
  if (!item) {
    return false;
  }
  return DISPUTE_RELATED_CANCEL_REASONS.has(inferCancelReasonCode(item));
}

/** Shop hủy đơn sau khi đã xác nhận giữ hàng. */
export function isSellerCancelAfterAcceptOrder(item) {
  if (!item) {
    return false;
  }
  if (item.cancelledBySellerAfterAccept === true) {
    return true;
  }
  const cancelType = String(item.cancelType || '').trim();
  const cancelledBy = String(item.cancelledBy || '').trim();
  if (
    cancelledBy === 'seller_after_accept' ||
    cancelType === 'seller_after_accept' ||
    cancelType === RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING ||
    cancelType === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
  ) {
    return true;
  }
  const code = inferCancelReasonCode(item);
  return (
    code === RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING ||
    code === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
  );
}

/** Lý do cụ thể shop/admin nhập khi hủy đơn đã xác nhận (kèm ảnh chứng minh). */
export function getSellerCancelNote(item) {
  if (!item) {
    return '';
  }
  if (!isSellerCancelAfterAcceptOrder(item)) {
    return '';
  }
  const raw = String(item.cancelNote || '').trim();
  if (!raw) {
    return '';
  }
  if (/^[a-z0-9_]+$/i.test(raw) && raw.includes('_')) {
    return '';
  }
  return raw;
}

function getBuyerDisputeReasonLabel(item) {
  const code = item?.buyerDisputeReason || (item?.disputeByBuyer ? item?.disputeReason : '');
  return (
    String(item?.buyerDisputeReasonLabel || '').trim() ||
    RESERVATION_DISPUTE_REASON_LABELS[code] ||
    String(item?.disputeReasonLabel || '').trim() ||
    RESERVATION_DISPUTE_REASON_LABELS[item?.disputeReason] ||
    ''
  );
}

function getSellerDisputeReasonLabel(item) {
  const code =
    item?.sellerDisputeReason ||
    (item?.disputeBySeller && !item?.disputeByBuyer ? item?.disputeReason : '');
  if (code) {
    return (
      getSellerDisputeReasonPickerLabel(code) ||
      RESERVATION_DISPUTE_REASON_LABELS[code] ||
      ''
    );
  }
  return (
    String(item?.sellerDisputeReasonLabel || '').trim() ||
    getSellerDisputeReasonPickerLabel(RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW)
  );
}

export function canSellerRefundDisputeDeposit(item) {
  if (!item || item.disputeBySeller) {
    return false;
  }
  if (hasSellerPostDeliveryResponse(item)) {
    return false;
  }
  return (
    item.canRefundDisputeDeposit === true ||
    (Number(item.status) === RESERVATION_STATUS.DISPUTED &&
      Number(item.cocChuyenDen || 0) === DEPOSIT_SETTLE_TO.NONE &&
      !item.tgGiaiCoc &&
      !item.depositReleasedAt &&
      !item.depositRefundedAt)
  );
}

export function canSellerRefundDepositOnHolding(item) {
  if (!item || item.disputeBySeller) {
    return false;
  }
  const holdingAccepted =
    Number(item.status) === RESERVATION_STATUS.WAITING_PICKUP &&
    !item.disputeByBuyer &&
    !item.disputeBySeller;
  return item.canCancelAccepted === true || holdingAccepted;
}

function resolveDisputeSideSortAt(item, side) {
  const direct = side === 'buyer' ? item?.buyerDisputedAt : item?.sellerDisputedAt;
  if (direct) {
    return direct;
  }
  const firstBy = String(item?.disputeFirstBy || '').trim();
  if (firstBy === side && item?.disputedAt) {
    return item.disputedAt;
  }
  return null;
}

export function buildDisputeReportOrder(item) {
  const entries = [];
  if (item?.disputeByBuyer) {
    entries.push({
      side: 'buyer',
      sortAt: resolveDisputeSideSortAt(item, 'buyer'),
    });
  }
  if (item?.disputeBySeller) {
    entries.push({
      side: 'seller',
      sortAt: resolveDisputeSideSortAt(item, 'seller'),
    });
  }

  if (entries.length <= 1) {
    return entries;
  }

  return entries.sort((left, right) => {
    const leftTime = left.sortAt ? new Date(left.sortAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.sortAt ? new Date(right.sortAt).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    const firstBy = String(item?.disputeFirstBy || '').trim();
    if (firstBy === 'seller') {
      return left.side === 'seller' ? -1 : 1;
    }
    if (firstBy === 'buyer') {
      return left.side === 'buyer' ? -1 : 1;
    }
    return left.side === 'buyer' ? -1 : 1;
  });
}

export function isActiveDisputeOrder(item) {
  const settleTo = Number(item?.cocChuyenDen ?? DEPOSIT_SETTLE_TO.NONE);
  return (
    Number(item?.status) === RESERVATION_STATUS.DISPUTED &&
    settleTo === DEPOSIT_SETTLE_TO.NONE
  );
}

export function isDisputeResolvedOrder(item) {
  const status = Number(item?.status);
  const settleTo = Number(item?.cocChuyenDen);
  return (
    status === RESERVATION_STATUS.DISPUTED &&
    (settleTo === DEPOSIT_SETTLE_TO.BUYER || settleTo === DEPOSIT_SETTLE_TO.SELLER)
  );
}

/** Tranh chấp đã xử lý — chỉ xem lịch sử, không báo cáo / khiếu nại / hoàn cọc thêm. */
export function isDisputeHistoryReadOnlyOrder(item) {
  return isDisputeResolvedOrder(item);
}

function pickDisputeHistoryUntil(item) {
  const fromApi = item?.disputeHistoryVisibleUntil;
  if (fromApi) {
    const parsed = new Date(fromApi);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }
  const settledRaw =
    item?.tgGiaiCoc || item?.depositReleasedAt || item?.depositRefundedAt || null;
  if (!settledRaw) {
    return null;
  }
  const settled = new Date(settledRaw);
  if (!Number.isFinite(settled.getTime())) {
    return null;
  }
  return new Date(settled.getTime() + DISPUTE_HISTORY_RETENTION_HOURS * 60 * 60 * 1000);
}

/** Tranh chấp đã xử lý còn trong thời gian giữ lịch sử (48h). */
export function isDisputeHistoryVisible(item, now = Date.now()) {
  if (!isDisputeResolvedOrder(item) || !shouldShowDisputeListHints(item)) {
    return false;
  }
  const until = pickDisputeHistoryUntil(item);
  return Boolean(until && now < until.getTime());
}

export function matchesDisputeSubTab(item, subTab, now = Date.now()) {
  if (subTab === DISPUTE_SUB_TAB.HISTORY) {
    return isDisputeHistoryVisible(item, now);
  }
  return isActiveDisputeOrder(item);
}

export function resolveOrdersApiTab(activeTab, disputeSubTab, completedSubTab) {
  if (activeTab === RESERVATION_TAB.DISPUTE) {
    return disputeSubTab === DISPUTE_SUB_TAB.HISTORY
      ? DISPUTE_SUB_TAB.HISTORY
      : DISPUTE_SUB_TAB.ACTIVE;
  }
  if (activeTab === RESERVATION_TAB.COMPLETED) {
    if (completedSubTab === COMPLETED_SUB_TAB.PICKUP) {
      return COMPLETED_SUB_TAB.PICKUP;
    }
    if (completedSubTab === COMPLETED_SUB_TAB.DONE) {
      return COMPLETED_SUB_TAB.DONE;
    }
    return COMPLETED_SUB_TAB.ALL;
  }
  return activeTab;
}

export function matchesCompletedSubTab(item, subTab) {
  const status = Number(item?.status);
  if (subTab === COMPLETED_SUB_TAB.PICKUP) {
    return (
      status === RESERVATION_STATUS.PICKUP_CONFIRMED || status === RESERVATION_STATUS.RECEIVED
    );
  }
  if (subTab === COMPLETED_SUB_TAB.DONE) {
    return (
      status === RESERVATION_STATUS.COMPLETED || status === RESERVATION_STATUS.AUTO_COMPLETED
    );
  }
  return isCompletedReservationStatus(status);
}

export function hasDisputeReportHistory(item) {
  if (!item) {
    return false;
  }
  return (
    Boolean(item.disputeByBuyer) ||
    Boolean(item.disputeBySeller) ||
    Boolean(item.disputedAt) ||
    Boolean(item.disputeReason)
  );
}

export function shouldShowDisputeListHints(item) {
  return isActiveDisputeOrder(item) || isDisputeResolvedOrder(item);
}

/** Hai bên tự thỏa thuận hoàn/mất cọc — không dùng ngôn ngữ thắng/thua. */
export function getSelfSettledDisputeOutcomeLine(item) {
  if (!item || !isDisputeResolvedOrder(item) || !hasDisputeReportHistory(item)) {
    return '';
  }
  if (hasAdminDisputeResolution(item, [])) {
    return '';
  }

  const code = inferCancelReasonCode(item);
  const settleTo = Number(item?.cocChuyenDen);
  const isBuyerForfeit =
    code === RESERVATION_CANCEL_REASON.BUYER_FORFEIT ||
    (isSelfSettledDispute(item) && settleTo === DEPOSIT_SETTLE_TO.SELLER);
  const isSellerRefund =
    code === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
    (isSelfSettledDispute(item) && settleTo === DEPOSIT_SETTLE_TO.BUYER);

  if (isBuyerForfeit && item.disputeBySeller) {
    return 'Người bán báo cáo, người mua đồng ý mất cọc.';
  }
  if (isSellerRefund && item.disputeByBuyer) {
    return 'Người mua khiếu nại, người bán đồng ý hoàn cọc.';
  }

  return '';
}

/** Nhãn ngắn kết quả tranh chấp đã xử lý (admin / auto). */
const DISPUTE_SETTLED_OUTCOME_LABELS = {
  [RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN]: {
    buyer: 'Admin quyết định hoàn cọc cho người mua',
    seller: 'Admin quyết định hoàn cọc cho người mua',
  },
  [RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN]: {
    buyer: 'Admin quyết định chuyển cọc cho người bán',
    seller: 'Admin quyết định chuyển cọc cho người bán',
  },
  [RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN]: {
    buyer: 'Admin xác nhận người mua đúng',
    seller: 'Admin xác nhận người mua đúng',
  },
  [RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN]: {
    buyer: 'Admin xác nhận người bán đúng',
    seller: 'Admin xác nhận người bán đúng',
  },
};

function normalizeDisputeViewerRole(viewerRole) {
  return viewerRole === VIEWER_ROLE.SELLER ? VIEWER_ROLE.SELLER : VIEWER_ROLE.BUYER;
}

function resolveDisputeSettledOutcomeText(item, viewerRole = VIEWER_ROLE.BUYER) {
  const selfLine = getSelfSettledDisputeOutcomeLine(item);
  if (selfLine) {
    return selfLine;
  }

  const role = normalizeDisputeViewerRole(viewerRole);
  const code = inferCancelReasonCode(item);
  const mapped = DISPUTE_SETTLED_OUTCOME_LABELS[code];
  if (mapped) {
    return mapped[role] || mapped.buyer || '';
  }

  const settleTo = Number(item?.cocChuyenDen);
  if (settleTo === DEPOSIT_SETTLE_TO.SELLER && hasAdminDisputeResolution(item, [])) {
    return 'Admin xác nhận người bán đúng';
  }
  if (settleTo === DEPOSIT_SETTLE_TO.BUYER && hasAdminDisputeResolution(item, [])) {
    return 'Admin xác nhận người mua đúng';
  }

  return getReservationReasonLabel(item, viewerRole);
}

/** Dòng kết quả trên thẻ đơn (tab lịch sử tranh chấp). */
export function getDisputeSettledListOutcomeLine(item, viewerRole = VIEWER_ROLE.BUYER) {
  void viewerRole;
  return getDisputeHistoryListOutcomeLine(item);
}

/** Nhãn khối KẾT QUẢ TRANH CHẤP trên màn chi tiết. */
export function getDisputeResultDetailLabel(item, viewerRole = VIEWER_ROLE.BUYER) {
  if (!isDisputeResolvedOrder(item)) {
    return '';
  }

  const selfLine = getSelfSettledDisputeOutcomeLine(item);
  if (selfLine) {
    return selfLine;
  }

  const code = inferCancelReasonCode(item);
  if (
    code === RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN ||
    code === RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN
  ) {
    return getReservationReasonLabel(item, viewerRole);
  }

  return resolveDisputeSettledOutcomeText(item, viewerRole);
}

export const DISPUTE_ADMIN_PENDING_FOOTER =
  'Admin sẽ xử lý sau 48 giờ kể từ thời gian nhận hàng.';

export const DISPUTE_ADMIN_PENDING_LIST_LINE = 'Chờ admin xử lý tranh chấp';

export const RESERVATION_DISPUTE_WINDOW_HOURS = 48;
export const DISPUTE_HISTORY_RETENTION_HOURS = 48;

export const DISPUTE_FOOTER_CONTEXT = {
  LIST: 'list',
  DETAIL: 'detail',
};

export const DISPUTE_KIND = {
  PICKUP: 'pickup',
  POST_DELIVERY: 'post_delivery',
};

export function isPostDeliveryDisputeReservation(item) {
  if (!item) {
    return false;
  }
  return (
    Boolean(item.isPostDeliveryDispute) ||
    item.disputeKind === DISPUTE_KIND.POST_DELIVERY
  );
}

export function hasSellerPostDeliveryResponse(item) {
  return Boolean(
    item?.tgPhShop ||
      String(item?.sellerResponse?.content || '').trim()
  );
}

/** Seller có thể bấm Phản hồi trên đơn đang tranh chấp. */
export function canSellerRespondOnDisputeItem(item) {
  if (!isActiveDisputeOrder(item)) {
    return false;
  }
  if (item?.canSellerRespondToComplaint === true) {
    return true;
  }
  if (isPostDeliveryDisputeReservation(item)) {
    return false;
  }
  if (item.disputeByBuyer && item.disputeBySeller) {
    return false;
  }
  return Boolean(item.disputeByBuyer && !item.disputeBySeller);
}

export function isSellerPostDeliveryResponseAction(item) {
  return (
    isActiveDisputeOrder(item) &&
    isPostDeliveryDisputeReservation(item) &&
    Boolean(item?.disputeByBuyer) &&
    !hasSellerPostDeliveryResponse(item)
  );
}

function formatDisputeHoursRemaining(deadlineRaw, now = Date.now()) {
  if (!deadlineRaw) {
    return '';
  }
  const deadline = new Date(deadlineRaw);
  if (!Number.isFinite(deadline.getTime())) {
    return '';
  }
  const diff = deadline.getTime() - now;
  if (diff <= 0) {
    return '';
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) {
    return `${hours} giờ`;
  }
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} phút`;
}

function hasBothPartiesDisputeReported(item) {
  return Boolean(item?.disputeByBuyer && item?.disputeBySeller);
}

export function disputeBothPartiesReported(item) {
  return hasBothPartiesDisputeReported(item);
}

/** Dòng khởi phát tranh chấp trên list — ngắn, không lý do. */
export function getDisputeListInitiatorLine(item) {
  if (!item) {
    return '';
  }
  if (isPostDeliveryDisputeReservation(item) && item.disputeByBuyer) {
    return 'Người mua đã khiếu nại';
  }
  if (item.disputeByBuyer && !item.disputeBySeller) {
    return 'Người mua đã khiếu nại';
  }
  if (item.disputeBySeller && !item.disputeByBuyer) {
    return 'Người bán đã báo cáo';
  }
  return '';
}

/** Kết quả lịch sử tranh chấp trên list. */
export function getDisputeHistoryListOutcomeLine(item) {
  if (!isDisputeResolvedOrder(item)) {
    return '';
  }

  const selfLine = getSelfSettledDisputeOutcomeLine(item);
  if (selfLine) {
    return selfLine;
  }

  const code = inferCancelReasonCode(item);
  const settleTo = Number(item?.cocChuyenDen);
  const adminResolved = hasAdminDisputeResolution(item, []);

  if (
    code === RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN ||
    code === RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN ||
    (adminResolved && settleTo === DEPOSIT_SETTLE_TO.SELLER)
  ) {
    return 'Admin xác nhận người bán đúng';
  }
  if (
    code === RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN ||
    code === RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN ||
    (adminResolved && settleTo === DEPOSIT_SETTLE_TO.BUYER)
  ) {
    return 'Admin xác nhận người mua đúng';
  }

  return '';
}

/** Nhãn badge tab tranh chấp trên list. */
export function getDisputeTabListStatusLabel(item, disputeSubTab = DISPUTE_SUB_TAB.ACTIVE) {
  if (disputeSubTab === DISPUTE_SUB_TAB.HISTORY && isDisputeResolvedOrder(item)) {
    return DISPUTE_RESOLVED_STATUS_LABEL;
  }
  return RESERVATION_STATUS_LABELS[RESERVATION_STATUS.DISPUTED] || 'Tranh chấp';
}

/** Nhãn trạng thái trên màn chi tiết đơn. */
export function getOrderDetailStatusLabel(item) {
  if (isDisputeResolvedOrder(item)) {
    return DISPUTE_RESOLVED_STATUS_LABEL;
  }
  return getSellerCompletedOrderStatusLabel(item?.status);
}

export function isDisputeHistoryListStatus(item, disputeSubTab = DISPUTE_SUB_TAB.ACTIVE) {
  return disputeSubTab === DISPUTE_SUB_TAB.HISTORY && isDisputeResolvedOrder(item);
}

/** Ghi chú cuối khối tranh chấp — khác nhau giữa quá giờ nhận và sau giao hàng. */
export function buildDisputeAdminPendingFooter(
  reservation,
  viewerRole = VIEWER_ROLE.BUYER,
  context = DISPUTE_FOOTER_CONTEXT.DETAIL,
  now = Date.now()
) {
  if (!isActiveDisputeOrder(reservation)) {
    return '';
  }
  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
  const isList = context === DISPUTE_FOOTER_CONTEXT.LIST;

  if (isPostDeliveryDisputeReservation(reservation)) {
    if (hasSellerPostDeliveryResponse(reservation)) {
      if (isList) {
        return DISPUTE_ADMIN_PENDING_LIST_LINE;
      }
      return '';
    }

    const sellerStillCanRespond =
      reservation.canSellerRespondToComplaint === true ||
      (reservation.disputeByBuyer &&
        !hasSellerPostDeliveryResponse(reservation) &&
        reservation.hanPhShop);

    if (sellerStillCanRespond) {
      const suffix = formatDisputeHoursRemaining(
        reservation.hanPhShop,
        now
      );
      if (suffix) {
        return `Người bán có ${suffix} để phản hồi`;
      }
    }

    return '';
  }

  if (hasBothPartiesDisputeReported(reservation)) {
    return isList ? DISPUTE_ADMIN_PENDING_LIST_LINE : '';
  }

  return '';
}

/** Khối thông báo chờ admin trên màn chi tiết đơn tranh chấp. */
export function buildActiveDisputeDetailNotice(
  reservation,
  viewerRole = VIEWER_ROLE.BUYER,
  now = Date.now()
) {
  if (!isActiveDisputeOrder(reservation)) {
    return null;
  }

  if (
    isPostDeliveryDisputeReservation(reservation) &&
    reservation.disputeByBuyer &&
    !hasSellerPostDeliveryResponse(reservation)
  ) {
    return {
      title: 'ĐANG CHỜ XỬ LÝ',
      body: '',
    };
  }

  return {
    title: 'ĐANG CHỜ XỬ LÝ',
    body: DISPUTE_ADMIN_PENDING_FOOTER,
  };
}

/** Dòng hiển thị tranh chấp trên thẻ đơn (danh sách). */
export function buildDisputeOrderListDisplay(item, viewerRole = VIEWER_ROLE.BUYER, now = Date.now()) {
  const { getOrderListDisputeDisplay } = require('../core/utils/orderDisplay');
  const display = getOrderListDisputeDisplay(item, viewerRole, now);
  if (!display) {
    return null;
  }
  return {
    lines: display.eventLines,
    outcomeLine: display.outcomeLine,
    footer: display.pendingLine,
    depositLine: display.depositLine,
  };
}

export function isCancelledReservationStatus(status) {
  return CANCELLED_RESERVATION_STATUSES.has(Number(status));
}

export function isCompletedReservationStatus(status) {
  return COMPLETED_RESERVATION_STATUSES.has(Number(status));
}

/** Shop đã quét QR giao hàng (COMPLETED hoặc RECEIVED data cũ). */
export function isDeliveredReservationStatus(status) {
  const code = Number(status);
  return (
    code === RESERVATION_STATUS.PICKUP_CONFIRMED ||
    code === RESERVATION_STATUS.RECEIVED ||
    isCompletedReservationStatus(code)
  );
}

/** Khiếu nại sau nhận: đã có completedAt (thời điểm xác nhận nhận hàng). */
export function isPostDeliveryComplaintContext(reservation) {
  if (!reservation) {
    return false;
  }
  if (reservation.canComplaint === true) {
    return true;
  }
  if (reservation.completedAt) {
    return true;
  }
  return isDeliveredReservationStatus(reservation.status);
}

/** Nhãn trạng thái tab Hoàn thành — status 2 giữ "Đã nhận hàng". */
export function getSellerCompletedOrderStatusLabel(status) {
  const code = Number(status);
  if (code === RESERVATION_STATUS.PICKUP_CONFIRMED || code === RESERVATION_STATUS.RECEIVED) {
    return RESERVATION_STATUS_LABELS[RESERVATION_STATUS.PICKUP_CONFIRMED];
  }
  if (isCompletedReservationStatus(code)) {
    return RESERVATION_STATUS_LABELS[RESERVATION_STATUS.COMPLETED];
  }
  return RESERVATION_STATUS_LABELS[code] || 'Không rõ';
}

/**
 * Lý do hiển thị theo góc nhìn buyer/seller.
 */
export function getCancelledReservationReason(item, viewerRole = VIEWER_ROLE.BUYER) {
  if (!item) {
    return '';
  }
  const status = Number(item?.status);
  if (status === RESERVATION_STATUS.DISPUTED) {
    return getReservationReasonLabel(item, viewerRole);
  }
  if (isCancelledReservationStatus(status)) {
    if (hasAdminDisputeResolution(item, [])) {
      return getAdminDisputeOutcomeLabel(item, [], viewerRole);
    }
    const label = getReservationReasonLabel(item, viewerRole);
    if (label) {
      return label;
    }
    const apiLabel =
      viewerRole === VIEWER_ROLE.SELLER ? item?.reasonLabelSeller : item?.reasonLabelBuyer;
    return String(apiLabel || '').trim();
  }
  return '';
}

export function reservationHasDisputeContext(
  reservation,
  { buyerReport, sellerReport } = {}
) {
  if (!reservation) {
    return false;
  }
  const status = Number(reservation.status);
  const hasReports = Boolean(buyerReport) || Boolean(sellerReport);
  const hasDisputeFlags =
    Boolean(reservation.disputeByBuyer) ||
    Boolean(reservation.disputeBySeller) ||
    Boolean(reservation.disputedAt) ||
    Boolean(reservation.disputeReason);

  if (status === RESERVATION_STATUS.DISPUTED) {
    return true;
  }

  if (hasReports || hasDisputeFlags) {
    return true;
  }

  if (status === RESERVATION_STATUS.REFUNDED) {
    return isDisputeRelatedCancellation(reservation);
  }

  return false;
}

const ADMIN_DISPUTE_DECISIONS = new Set(['approve_buyer', 'approve_seller']);

const GENERIC_ADMIN_RESOLUTION_NOTES = new Set([
  'Admin hoàn cọc cho người mua.',
  'Admin xử lý tranh chấp: đền cọc cho người bán.',
  'Shop tự hoàn cọc trong tranh chấp.',
  'Shop tự hoàn cọc cho người mua.',
  'Buyer đồng ý mất cọc.',
]);

export function getProcessedAdminDisputeReport(reports = []) {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  return (
    list.find((report) => {
      if (!report?.tgXuLy) {
        return false;
      }
      const decision = String(report.qdAdmin || '').trim();
      return ADMIN_DISPUTE_DECISIONS.has(decision);
    }) || null
  );
}

function isSelfSettledDispute(reservation) {
  if (!reservation) {
    return false;
  }
  const code = inferCancelReasonCode(reservation);
  if (
    code === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
    code === RESERVATION_CANCEL_REASON.BUYER_FORFEIT
  ) {
    return true;
  }
  if (
    String(reservation.cancelType || '').trim() === 'seller_after_accept' ||
    reservation.cancelType === 'seller_after_accept'
  ) {
    return true;
  }
  if (
    String(reservation.cancelType || '').trim() === 'buyer' &&
    Number(reservation.cocChuyenDen) === DEPOSIT_SETTLE_TO.SELLER &&
    hasDisputeReportHistory(reservation)
  ) {
    return true;
  }
  return false;
}

/** Admin đã xử lý tranh chấp (không tính hai bên tự thỏa thuận hoàn/mất cọc). */
export function hasAdminDisputeResolution(reservation, reports = []) {
  if (!reservation || isSelfSettledDispute(reservation)) {
    return false;
  }

  const code = inferCancelReasonCode(reservation);
  if (
    code === RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN ||
    code === RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN
  ) {
    return true;
  }

  if (String(reservation.cancelType || '').trim() === 'admin') {
    return true;
  }

  if (getProcessedAdminDisputeReport(reports)) {
    return true;
  }

  if (!hasDisputeReportHistory(reservation) || isActiveDisputeOrder(reservation)) {
    return false;
  }

  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.REFUNDED &&
    (reservation.disputeByBuyer || reservation.disputeBySeller)
  ) {
    return true;
  }
  if (
    isDisputeResolvedOrder(reservation) &&
    (reservation.disputeByBuyer || reservation.disputeBySeller)
  ) {
    return true;
  }

  return false;
}

export function getAdminDisputeOutcomeLabel(
  reservation,
  reports = [],
  viewerRole = VIEWER_ROLE.BUYER
) {
  if (!hasAdminDisputeResolution(reservation, reports)) {
    return '';
  }
  return getReservationReasonLabel(reservation, viewerRole);
}

export function getAdminDisputeResolutionNote(reservation, reports = []) {
  if (!hasAdminDisputeResolution(reservation, reports)) {
    return '';
  }

  const fromReport = String(getProcessedAdminDisputeReport(reports)?.adminNote || '').trim();
  if (fromReport && !GENERIC_ADMIN_RESOLUTION_NOTES.has(fromReport)) {
    return fromReport;
  }

  const cancelReason = String(reservation?.cancelNote || reservation?.cancelReason || '').trim();
  if (
    cancelReason &&
    !GENERIC_ADMIN_RESOLUTION_NOTES.has(cancelReason) &&
    !(/^[a-z0-9_]+$/i.test(cancelReason) && cancelReason.includes('_'))
  ) {
    return cancelReason;
  }

  return fromReport || cancelReason || '';
}

/** Lý do / ghi chú ngắn cho khối KẾT QUẢ TRANH CHẤP trên chi tiết đơn. */
export function getDisputeResultReasonText(
  reservation,
  reports = [],
  viewerRole = VIEWER_ROLE.BUYER
) {
  if (!isDisputeResolvedOrder(reservation)) {
    return '';
  }

  const adminNote = getAdminDisputeResolutionNote(reservation, reports);
  if (adminNote) {
    return adminNote;
  }

  const selfLine = getSelfSettledDisputeOutcomeLine(reservation);
  if (selfLine) {
    return selfLine;
  }

  const fullLabel = getDisputeResultDetailLabel(reservation, viewerRole);
  const reasonMatch = String(fullLabel || '').match(/Lý do:\s*(.+)$/i);
  if (reasonMatch) {
    return reasonMatch[1].trim();
  }

  return String(fullLabel || '').trim();
}

export function isAdminDisputeResolved(reservation, reports = []) {
  return hasAdminDisputeResolution(reservation, reports);
}

export function getAdminDisputeResolutionLabel(reservation, reports = []) {
  return getAdminDisputeOutcomeLabel(reservation, reports, VIEWER_ROLE.BUYER);
}

export function getReservationTabForStatus(status) {
  const code = Number(status);
  if (isCancelledReservationStatus(code)) {
    return RESERVATION_TAB.CANCELLED;
  }
  if (code === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION) {
    return RESERVATION_TAB.PENDING;
  }
  if (code === RESERVATION_STATUS.WAITING_PICKUP) {
    return RESERVATION_TAB.HOLDING;
  }
  if (code === RESERVATION_STATUS.DISPUTED) {
    return RESERVATION_TAB.DISPUTE;
  }
  if (code === RESERVATION_STATUS.RECEIVED || isCompletedReservationStatus(code)) {
    return RESERVATION_TAB.COMPLETED;
  }
  return RESERVATION_TAB.ALL;
}
