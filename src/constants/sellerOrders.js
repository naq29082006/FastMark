import {
  RESERVATION_CANCEL_REASON,
  VIEWER_ROLE,
  getReservationReasonLabel,
  inferCancelReasonCode,
} from './reservationOrderFlow';

export const RESERVATION_STATUS = {
  PENDING_SELLER_CONFIRMATION: 0,
  REJECTED: 1,
  WAITING_PICKUP: 2,
  RECEIVED: 3,
  DELIVERED_PENDING_DISPUTE: 3,
  DISPUTED: 4,
  COMPLETED: 5,
  AUTO_COMPLETED: 5,
  REFUNDED: 6,
  /** Đồng bộ backend RESERVATION_STATUS.CANCELLED */
  CANCELLED: 6,
  DISPUTE_RESOLVED: 7,
};

export const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION]: 'Chờ xác nhận',
  [RESERVATION_STATUS.REJECTED]: 'Đã hủy',
  [RESERVATION_STATUS.WAITING_PICKUP]: 'Giữ hàng',
  [RESERVATION_STATUS.RECEIVED]: 'Đã giao',
  [RESERVATION_STATUS.COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.DISPUTED]: 'Tranh chấp',
  [RESERVATION_STATUS.AUTO_COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.REFUNDED]: 'Đã hủy',
  [RESERVATION_STATUS.CANCELLED]: 'Đã hủy',
  [RESERVATION_STATUS.DISPUTE_RESOLVED]: 'Đã hủy',
};

export const RESERVATION_TAB = {
  ALL: 'all',
  PENDING: 'pending',
  HOLDING: 'holding',
  DISPUTE: 'dispute',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
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

export const BUYER_COMPLAINT_REASON_OPTIONS = [
  'damaged_item',
  'missing_item',
  'wrong_item',
  'not_as_described',
  'expired',
  'other',
];

export const BUYER_COMPLAINT_REASON_LABELS = {
  damaged_item: 'Hàng bị hư hỏng',
  missing_item: 'Thiếu hàng',
  wrong_item: 'Giao sai hàng',
  not_as_described: 'Không đúng mô tả',
  expired: 'Hết hạn',
  other: 'Khác',
};

export const RESERVATION_DISPUTE_REASON = {
  SELLER_ABSENT: 'seller_absent',
  SHOP_CLOSED: 'shop_closed',
  SELLER_NO_DELIVERY: 'seller_no_delivery',
  SHOP_NO_DELIVERY: 'shop_no_delivery',
  SHOP_OUT_OF_STOCK: 'shop_out_of_stock',
  OTHER: 'other',
  BUYER_NO_SHOW: 'buyer_no_show',
};

export const RESERVATION_DISPUTE_REASON_LABELS = {
  [RESERVATION_DISPUTE_REASON.SELLER_ABSENT]: 'Người bán không có mặt',
  [RESERVATION_DISPUTE_REASON.SHOP_CLOSED]: 'Shop đóng cửa',
  [RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY]: 'Người bán không giao hàng',
  [RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY]: 'Người bán không giao hàng',
  [RESERVATION_DISPUTE_REASON.SHOP_OUT_OF_STOCK]: 'Shop hết hàng',
  [RESERVATION_DISPUTE_REASON.OTHER]: 'Khác',
  [RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW]: 'Người mua không đến nhận hàng',
};

export const BUYER_DISPUTE_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.SELLER_ABSENT,
  RESERVATION_DISPUTE_REASON.SHOP_CLOSED,
  RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY,
  RESERVATION_DISPUTE_REASON.OTHER,
];

export const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

const CANCELLED_RESERVATION_STATUSES = new Set([
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.REFUNDED,
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.DISPUTE_RESOLVED,
]);

const COMPLETED_RESERVATION_STATUSES = new Set([
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.AUTO_COMPLETED,
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
  if (String(item.cancelledBy || '').trim() === 'seller_after_accept') {
    return true;
  }
  const code = inferCancelReasonCode(item);
  return (
    code === RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING ||
    code === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
  );
}

/** Lý do cụ thể shop nhập khi hủy đơn đã xác nhận (kèm ảnh chứng minh). */
export function getSellerCancelNote(item) {
  if (!item) {
    return '';
  }
  if (!isSellerCancelAfterAcceptOrder(item)) {
    return '';
  }
  return String(item.cancelNote || '').trim();
}

function getBuyerDisputeReasonLabel(item) {
  return (
    String(item?.disputeReasonLabel || '').trim() ||
    RESERVATION_DISPUTE_REASON_LABELS[item?.disputeReason] ||
    ''
  );
}

function getSellerDisputeReasonLabel() {
  return (
    RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW] ||
    'Người mua không đến nhận hàng'
  );
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
  return Number(item?.status) === RESERVATION_STATUS.DISPUTED;
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
  return isActiveDisputeOrder(item);
}

export const DISPUTE_ADMIN_PENDING_FOOTER =
  'Admin sẽ xử lý sau 24 giờ kể từ thời gian nhận hàng.';

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
    item?.sellerRespondedAt ||
      String(item?.sellerResponse?.content || '').trim()
  );
}

/** Ghi chú cuối khối tranh chấp — khác nhau giữa quá giờ nhận và sau giao hàng. */
export function buildDisputeAdminPendingFooter(
  reservation,
  viewerRole = VIEWER_ROLE.BUYER
) {
  if (!isActiveDisputeOrder(reservation)) {
    return '';
  }
  if (isPostDeliveryDisputeReservation(reservation)) {
    const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
    const sellerStillCanRespond =
      reservation.canSellerRespondToComplaint === true ||
      (reservation.disputeByBuyer &&
        !hasSellerPostDeliveryResponse(reservation) &&
        reservation.sellerResponseDeadlineAt);
    if (sellerStillCanRespond && !hasSellerPostDeliveryResponse(reservation)) {
      return isViewerBuyer
        ? 'Shop có 2 ngày để phản hồi khiếu nại. Sau đó admin sẽ xử lý.'
        : 'Bạn có 2 ngày để phản hồi khiếu nại của khách. Sau đó admin sẽ xử lý.';
    }
    return 'Admin sẽ xử lý tranh chấp sau khi shop phản hồi hoặc hết thời hạn phản hồi (2 ngày).';
  }
  return DISPUTE_ADMIN_PENDING_FOOTER;
}

/** Dòng hiển thị tranh chấp trên thẻ đơn (danh sách). */
export function buildDisputeOrderListDisplay(item, viewerRole = VIEWER_ROLE.BUYER) {
  if (!shouldShowDisputeListHints(item)) {
    return null;
  }
  if (!item.disputeByBuyer && !item.disputeBySeller) {
    return null;
  }

  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
  const buyerReason = getBuyerDisputeReasonLabel(item) || '—';
  const sellerReason = getSellerDisputeReasonLabel();
  const lines = buildDisputeReportOrder(item).map(({ side }) => {
    if (side === 'buyer') {
      return isViewerBuyer
        ? `Bạn đã báo cáo: ${buyerReason}`
        : `Người mua đã báo cáo: ${buyerReason}`;
    }
    return isViewerBuyer
      ? `Shop đã báo cáo: ${sellerReason}`
      : `Bạn đã báo cáo: ${sellerReason}`;
  });

  return {
    lines,
    footer: buildDisputeAdminPendingFooter(item, viewerRole),
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
    code === RESERVATION_STATUS.RECEIVED || isCompletedReservationStatus(code)
  );
}

/** Nhãn trạng thái tab Hoàn thành phía seller (RECEIVED hiển thị như Hoàn thành). */
export function getSellerCompletedOrderStatusLabel(status) {
  if (isDeliveredReservationStatus(status)) {
    return RESERVATION_STATUS_LABELS[RESERVATION_STATUS.COMPLETED];
  }
  return RESERVATION_STATUS_LABELS[Number(status)] || 'Không rõ';
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

  if (
    status === RESERVATION_STATUS.DISPUTE_RESOLVED ||
    status === RESERVATION_STATUS.REFUNDED
  ) {
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
      if (!report?.processedAt) {
        return false;
      }
      const decision = String(report.adminDecision || '').trim();
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
    reservation.cancelledBySellerAfterAccept ||
    reservation.cancelledBy === 'seller_after_accept'
  ) {
    return true;
  }
  if (
    String(reservation.cancelledBy || '').trim() === 'buyer' &&
    Number(reservation.depositSettleTo) === DEPOSIT_SETTLE_TO.SELLER &&
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

  if (String(reservation.cancelledBy || '').trim() === 'admin') {
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
    status === RESERVATION_STATUS.DISPUTE_RESOLVED &&
    Number(reservation.depositSettleTo) === DEPOSIT_SETTLE_TO.SELLER &&
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

  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
  const processed = getProcessedAdminDisputeReport(reports);
  if (processed?.adminDecision === 'approve_buyer') {
    return isViewerBuyer
      ? 'Admin hoàn cọc cho bạn'
      : 'Admin hoàn cọc cho người mua';
  }
  if (processed?.adminDecision === 'approve_seller') {
    return isViewerBuyer
      ? 'Admin hoàn cọc cho người bán'
      : 'Admin hoàn cọc cho bạn';
  }

  const code = inferCancelReasonCode(reservation);
  const settleTo = Number(reservation.depositSettleTo);
  const buyerWins =
    code === RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN ||
    settleTo === DEPOSIT_SETTLE_TO.BUYER ||
    Number(reservation.status) === RESERVATION_STATUS.REFUNDED;

  if (buyerWins) {
    return isViewerBuyer
      ? 'Admin hoàn cọc cho bạn'
      : 'Admin hoàn cọc cho người mua';
  }

  return isViewerBuyer
    ? 'Admin hoàn cọc cho người bán'
    : 'Admin hoàn cọc cho bạn';
}

export function getAdminDisputeResolutionNote(reservation, reports = []) {
  if (!hasAdminDisputeResolution(reservation, reports)) {
    return '';
  }

  const fromReport = String(getProcessedAdminDisputeReport(reports)?.adminNote || '').trim();
  if (fromReport && !GENERIC_ADMIN_RESOLUTION_NOTES.has(fromReport)) {
    return fromReport;
  }

  const cancelReason = String(reservation?.cancelReason || '').trim();
  if (cancelReason && !GENERIC_ADMIN_RESOLUTION_NOTES.has(cancelReason)) {
    return cancelReason;
  }

  return fromReport || cancelReason || '';
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
