import { formatPrice } from './productFormat';
import { reservationRequiresDeposit } from './reservationEntity';
import {
  RESERVATION_CANCEL_REASON,
  VIEWER_ROLE,
  getReservationReasonLabel,
  inferCancelReasonCode,
} from '../../constants/reservationOrderFlow';
import {
  DEPOSIT_SETTLE_TO,
  RESERVATION_STATUS,
  buildDisputeAdminPendingFooter,
  buildDisputeReportOrder,
  buildDisputeSideSummaryLine,
  buildActiveDisputeDetailNotice,
  DISPUTE_ADMIN_PENDING_LIST_LINE,
  DISPUTE_FOOTER_CONTEXT,
  disputeBothPartiesReported,
  getDisputeHistoryListOutcomeLine,
  getDisputeListInitiatorLine,
  getDisputeResultDetailLabel,
  getDisputeSettledListOutcomeLine,
  hasAdminDisputeResolution,
  hasSellerPostDeliveryResponse,
  isActiveDisputeOrder,
  isCancelledReservationStatus,
  isDeliveredReservationStatus,
  isDisputeResolvedOrder,
  isPostDeliveryDisputeReservation,
  RESERVATION_DISPUTE_REASON_LABELS,
  shouldShowDisputeListHints,
} from '../../constants/sellerOrders';
import {
  getDisputeListResponseCountdownLine,
  getEscrowProtectionLabel,
  getSellerDepositReleaseCountdownLabel,
  isDepositAlreadySettled,
  isPostDeliveryEscrowEligible,
} from './escrowHold';

export const ORDER_DISPLAY_CONTEXT = {
  LIST: 'list',
  DETAIL: 'detail',
};

function normalizeRole(viewerRole) {
  return viewerRole === VIEWER_ROLE.SELLER ? VIEWER_ROLE.SELLER : VIEWER_ROLE.BUYER;
}

function pickDepositAmount(item) {
  const amount = Number(item?.depositAmount) || 0;
  return amount > 0 ? amount : 0;
}

function resolveDepositSettleTo(item) {
  const raw = Number(item?.cocChuyenDen);
  if (raw === DEPOSIT_SETTLE_TO.BUYER || raw === DEPOSIT_SETTLE_TO.SELLER) {
    return raw;
  }
  if (item?.depositRefundedAt) {
    return DEPOSIT_SETTLE_TO.BUYER;
  }
  if (item?.depositReleasedAt) {
    return DEPOSIT_SETTLE_TO.SELLER;
  }
  return DEPOSIT_SETTLE_TO.NONE;
}

function formatSettledDepositLine(item, viewerRole = VIEWER_ROLE.BUYER) {
  const role = normalizeRole(viewerRole);
  const amount = pickDepositAmount(item);
  const amountText = amount > 0 ? formatPrice(amount) : 'Tiền cọc';
  const settleTo = resolveDepositSettleTo(item);

  if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
    return role === VIEWER_ROLE.BUYER
      ? `${amountText} đã hoàn về ví người mua`
      : `${amountText} đã hoàn về ví người mua`;
  }
  if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
    return role === VIEWER_ROLE.BUYER
      ? `${amountText} đã chuyển vào ví người bán`
      : `${amountText} đã chuyển vào ví người bán`;
  }

  return '';
}

export function isCompletedTabDepositPendingLine(line) {
  const text = String(line || '').trim();
  if (!text) {
    return false;
  }
  return /sau:/i.test(text) || /đang được giữ/i.test(text);
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
  return (
    String(item?.sellerDisputeReasonLabel || '').trim() ||
    RESERVATION_DISPUTE_REASON_LABELS[code] ||
    RESERVATION_DISPUTE_REASON_LABELS[item?.disputeReason] ||
    ''
  );
}

/** Dòng sự kiện khiếu nại / báo cáo / phản hồi (tách khỏi kết quả cọc). */
export function getDisputeEventLines(
  item,
  viewerRole = VIEWER_ROLE.BUYER,
  { forList = false } = {}
) {
  const buyerReason = getBuyerDisputeReasonLabel(item) || '—';
  const sellerReason = getSellerDisputeReasonLabel(item) || '—';
  const lineOptions = { omitReason: forList };

  if (isPostDeliveryDisputeReservation(item)) {
    const lines = [];
    if (item?.disputeByBuyer) {
      lines.push(
        buildDisputeSideSummaryLine('buyer', viewerRole, buyerReason, {
          isResponse: false,
          ...lineOptions,
        })
      );
    }
    if (hasSellerPostDeliveryResponse(item)) {
      lines.push(
        buildDisputeSideSummaryLine('seller', viewerRole, '', {
          isResponse: true,
          ...lineOptions,
        })
      );
    }
    return lines;
  }

  if (!item?.disputeByBuyer && !item?.disputeBySeller) {
    return [];
  }

  return buildDisputeReportOrder(item).map(({ side }, index) =>
    buildDisputeSideSummaryLine(
      side,
      viewerRole,
      side === 'buyer' ? buyerReason : sellerReason,
      { isResponse: index > 0, ...lineOptions }
    )
  );
}

/** Dòng trạng thái chờ xử lý (list — ngắn, cam/xám). */
export function getDisputePendingLine(
  item,
  viewerRole = VIEWER_ROLE.BUYER,
  now = Date.now()
) {
  if (!isActiveDisputeOrder(item)) {
    return '';
  }
  return buildDisputeAdminPendingFooter(item, viewerRole, DISPUTE_FOOTER_CONTEXT.LIST, now);
}

/** Kết quả tranh chấp đã xử lý — list có prefix "Kết quả:". */
export function getDisputeOutcomeLine(
  item,
  viewerRole = VIEWER_ROLE.BUYER,
  { forList = true } = {}
) {
  if (!isDisputeResolvedOrder(item)) {
    return '';
  }
  if (forList) {
    return getDisputeSettledListOutcomeLine(item, viewerRole);
  }
  return getDisputeResultDetailLabel(item, viewerRole);
}

/** Hướng tiền cọc sau khi đã quyết định. */
export function getDepositOutcomeLine(item, viewerRole = VIEWER_ROLE.BUYER) {
  if (!item || !reservationRequiresDeposit(item)) {
    return '';
  }

  const role = normalizeRole(viewerRole);

  if (isActiveDisputeOrder(item)) {
    if (resolveDepositSettleTo(item) === DEPOSIT_SETTLE_TO.NONE) {
      const amount = pickDepositAmount(item);
      const amountText = amount > 0 ? formatPrice(amount) : 'Tiền cọc';
      return role === VIEWER_ROLE.BUYER
        ? `${amountText} đang được giữ an toàn`
        : `${amountText} đang được giữ chờ xử lý`;
    }
  }

  const status = Number(item?.status);
  const showSettledLine =
    isDisputeResolvedOrder(item) ||
    isCancelledReservationStatus(status) ||
    isDeliveredReservationStatus(status);

  if (!showSettledLine) {
    return '';
  }

  return formatSettledDepositLine(item, viewerRole);
}

/** Tab Hoàn thành — ai nhận cọc / còn bao lâu chuyển cọc. */
export function getCompletedTabDepositLine(
  item,
  viewerRole = VIEWER_ROLE.BUYER,
  now = Date.now()
) {
  if (!item || !reservationRequiresDeposit(item)) {
    return '';
  }
  if (!isDeliveredReservationStatus(item?.status)) {
    return '';
  }

  if (isActiveDisputeOrder(item)) {
    return getDepositOutcomeLine(item, viewerRole);
  }

  if (isDepositAlreadySettled(item)) {
    return formatSettledDepositLine(item, viewerRole);
  }

  if (isPostDeliveryEscrowEligible(item)) {
    const role = normalizeRole(viewerRole);
    if (role === VIEWER_ROLE.SELLER) {
      return getSellerDepositReleaseCountdownLabel(item, now);
    }

    const countdown = getEscrowProtectionLabel(item, now);
    if (countdown) {
      const amount = pickDepositAmount(item);
      const amountText = amount > 0 ? formatPrice(amount) : 'Tiền cọc';
      const suffix = countdown.replace(/^Còn\s/i, '');
      return `${amountText} chuyển vào ví của người bán sau: ${suffix}`;
    }
  }

  return '';
}

/** Lý do hủy / kết thúc (tab Đã hủy hoặc không thuộc tranh chấp). */
export function getOrderCancelReasonLine(item, viewerRole = VIEWER_ROLE.BUYER) {
  if (!item) {
    return '';
  }

  const status = Number(item?.status);
  if (isActiveDisputeOrder(item) || isDisputeResolvedOrder(item)) {
    return '';
  }

  if (status === RESERVATION_STATUS.DISPUTED) {
    return getReservationReasonLabel(item, viewerRole);
  }

  if (!isCancelledReservationStatus(status)) {
    return '';
  }

  if (hasAdminDisputeResolution(item, [])) {
    return getReservationReasonLabel(item, viewerRole);
  }

  const label = getReservationReasonLabel(item, viewerRole);
  if (label) {
    return label;
  }

  const apiLabel =
    viewerRole === VIEWER_ROLE.SELLER ? item?.reasonLabelSeller : item?.reasonLabelBuyer;
  return String(apiLabel || '').trim();
}

/** Khối hiển thị tranh chấp trên thẻ list. */
export function getOrderListDisputeDisplay(item, viewerRole = VIEWER_ROLE.BUYER, now = Date.now()) {
  if (!shouldShowDisputeListHints(item)) {
    return null;
  }

  if (isDisputeResolvedOrder(item) && !item.disputeByBuyer && !item.disputeBySeller) {
    return null;
  }

  if (isDisputeResolvedOrder(item)) {
    const historyLine = getDisputeHistoryListOutcomeLine(item);
    return {
      eventLines: historyLine ? [historyLine] : [],
      pendingLine: '',
      responseLine: '',
      outcomeLine: '',
      depositLine: '',
      variant: 'resolved',
    };
  }

  if (!isActiveDisputeOrder(item)) {
    return null;
  }

  const waitingForAdmin =
    disputeBothPartiesReported(item) ||
    (isPostDeliveryDisputeReservation(item) && hasSellerPostDeliveryResponse(item));

  if (waitingForAdmin) {
    return {
      eventLines: [],
      pendingLine: DISPUTE_ADMIN_PENDING_LIST_LINE,
      responseLine: '',
      outcomeLine: '',
      depositLine: '',
      variant: 'waiting_admin',
    };
  }

  const initiatorLine = getDisputeListInitiatorLine(item);
  const responseLine = getDisputeListResponseCountdownLine(item, now);

  return {
    eventLines: initiatorLine ? [initiatorLine] : [],
    pendingLine: '',
    responseLine,
    outcomeLine: '',
    depositLine: '',
    variant: 'awaiting_response',
  };
}

/** Tóm tắt list: lý do hủy + cọc (tab Đã hủy). */
export function getOrderListCancelDisplay(item, viewerRole = VIEWER_ROLE.BUYER) {
  const reasonLine = getOrderCancelReasonLine(item, viewerRole);
  const depositLine = getDepositOutcomeLine(item, viewerRole);
  return {
    reasonLine,
    depositLine,
  };
}

/** Khối hiển thị chi tiết đơn. */
export function getOrderDetailDisplay(
  item,
  viewerRole = VIEWER_ROLE.BUYER,
  now = Date.now()
) {
  const activeNotice = buildActiveDisputeDetailNotice(item, viewerRole, now);
  const eventLines = getDisputeEventLines(item, viewerRole);
  const outcomeLabel = getDisputeOutcomeLine(item, viewerRole, { forList: false });
  const depositLine = getDepositOutcomeLine(item, viewerRole);
  const cancelReasonLine = getOrderCancelReasonLine(item, viewerRole);
  const pendingLine = getDisputePendingLine(item, viewerRole, now);

  return {
    activeNotice,
    eventLines,
    pendingLine,
    outcomeLabel,
    depositLine,
    cancelReasonLine,
    showDisputeEvents:
      eventLines.length > 0 && (isActiveDisputeOrder(item) || isDisputeResolvedOrder(item)),
    showOutcome: Boolean(outcomeLabel) && isDisputeResolvedOrder(item),
    showCancelReason:
      Boolean(cancelReasonLine) &&
      !isActiveDisputeOrder(item) &&
      !isDisputeResolvedOrder(item),
    isPostDelivery: isPostDeliveryDisputeReservation(item),
  };
}

/** Admin — tóm tắt 1 dòng trung lập cho list. */
export function getAdminOrderListSummary(item) {
  if (!item) {
    return '—';
  }

  const parts = [];
  const buyerLabel = String(item.reasonLabelBuyer || '').trim();
  const sellerLabel = String(item.reasonLabelSeller || '').trim();
  const code = inferCancelReasonCode(item);
  const settleTo = Number(item.cocChuyenDen);

  if (item.disputeByBuyer) {
    parts.push(`Buyer: ${item.disputeReasonLabel || item.buyerDisputeReasonLabel || 'khiếu nại'}`);
  }
  if (item.disputeBySeller) {
    parts.push(`Seller: ${item.sellerDisputeReasonLabel || 'báo cáo'}`);
  }

  if (isDisputeResolvedOrder(item)) {
    if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
      parts.push('Cọc → buyer');
    } else if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
      parts.push('Cọc → seller');
    }
    if (code === RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN) {
      parts.push('Admin: hoàn buyer');
    } else if (code === RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN) {
      parts.push('Admin: seller thắng');
    } else if (code === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP) {
      parts.push('Shop tự hoàn cọc');
    } else if (code === RESERVATION_CANCEL_REASON.BUYER_FORFEIT) {
      parts.push('Buyer mất cọc');
    }
  } else if (isActiveDisputeOrder(item)) {
    parts.push('Chờ xử lý');
  } else if (buyerLabel || sellerLabel) {
    parts.push(buyerLabel || sellerLabel);
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** @deprecated Dùng getOrderListDisputeDisplay */
export function buildDisputeOrderListDisplay(item, viewerRole = VIEWER_ROLE.BUYER, now = Date.now()) {
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
