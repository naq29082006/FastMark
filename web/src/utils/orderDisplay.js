import {
  RESERVATION_CANCEL_REASON,
  inferCancelReasonCode,
} from '../constants/reservationOrderFlow';

const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

function isDisputeResolvedOrder(item) {
  const status = Number(item?.status);
  const settleTo = Number(item?.cocChuyenDen);
  return status === 3 && (settleTo === DEPOSIT_SETTLE_TO.BUYER || settleTo === DEPOSIT_SETTLE_TO.SELLER);
}

function isActiveDisputeOrder(item) {
  const status = Number(item?.status);
  const settleTo = Number(item?.cocChuyenDen);
  return status === 3 && settleTo === DEPOSIT_SETTLE_TO.NONE;
}

/** Admin — tóm tắt 1 dòng trung lập cho list đơn hàng. */
export function getAdminOrderListSummary(item) {
  if (!item) {
    return '—';
  }

  const parts = [];
  const code = inferCancelReasonCode(item);
  const settleTo = Number(item.cocChuyenDen);

  if (item.disputeByBuyer) {
    parts.push(
      `Buyer: ${item.disputeReasonLabel || item.buyerDisputeReasonLabel || item.latestDispute?.reasonLabel || 'khiếu nại'}`
    );
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
    } else if (code === RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN) {
      parts.push('Auto: buyer thắng');
    } else if (code === RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN) {
      parts.push('Auto: seller thắng');
    }
  } else if (isActiveDisputeOrder(item)) {
    parts.push('Chờ xử lý');
  } else {
    const buyerLabel = String(item.reasonLabelBuyer || '').trim();
    const sellerLabel = String(item.reasonLabelSeller || '').trim();
    if (buyerLabel || sellerLabel) {
      parts.push(buyerLabel || sellerLabel);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** Admin detail — hiển thị cả hai góc nhìn app. */
export function getAdminOrderReasonPanel(item) {
  if (!item) {
    return null;
  }
  return {
    buyerLabel: String(item.reasonLabelBuyer || '').trim() || '—',
    sellerLabel: String(item.reasonLabelSeller || '').trim() || '—',
    reasonCode: inferCancelReasonCode(item) || '—',
    summary: getAdminOrderListSummary(item),
  };
}
