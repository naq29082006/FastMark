const CANCELLED_STATUSES = new Set([5]);

function isTechnicalToken(value) {
  const text = String(value || '').trim();
  return Boolean(text) && /^[a-z0-9_]+$/i.test(text) && text.includes('_');
}

function pickHumanText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text || isTechnicalToken(text)) {
      continue;
    }
    return text;
  }
  return '';
}

/** Lý do hủy hiển thị trên admin list — cùng nguồn nhãn như mobile. */
export function getAdminReservationCancelReason(item) {
  if (!item || !CANCELLED_STATUSES.has(Number(item.status))) {
    return '';
  }

  if (
    item.cancelType === 'seller_after_accept' ||
    item.cancelType === 'seller_cancel_holding' ||
    item.cancelType === 'seller_refund_after_pickup' ||
    item.cancelledBySellerAfterAccept
  ) {
    const sellerNote = pickHumanText(item.cancelNote);
    if (sellerNote) {
      return sellerNote;
    }
  }

  return pickHumanText(
    item.reasonLabelBuyer,
    item.disputeReasonLabel,
    item.cancelNote,
  );
}
