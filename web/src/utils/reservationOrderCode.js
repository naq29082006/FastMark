function stripLegacyFmPrefix(value) {
  const text = String(value || '')
    .trim()
    .replace(/^#/, '');
  if (!text) return '';
  if (/^FM-/i.test(text)) {
    return text.replace(/^FM-/i, '');
  }
  if (/^FM/i.test(text) && text.length > 8) {
    return text.slice(-8).toUpperCase();
  }
  return text;
}

/** Mã đơn hiển thị (8 ký tự cuối id hoặc code từ API, không tiền tố FM). */
export function formatReservationOrderCode(reservation) {
  const rawCode = String(reservation?.code || reservation?.orderCode || '').trim();
  if (rawCode && !rawCode.startsWith('ID:')) {
    const normalized = stripLegacyFmPrefix(rawCode);
    if (normalized) return normalized;
  }

  const id = String(reservation?.id || reservation?._id || '').trim();
  return id.slice(-8).toUpperCase();
}

/** 6 ký tự cuối mã đơn — dùng bảng đánh giá admin. */
export function formatReservationOrderCodeShort(source) {
  const id = String(
    typeof source === 'object'
      ? source?.reservationId || source?.id || source?._id || ''
      : source || ''
  ).trim();
  if (!id) return '';
  return id.slice(-6).toUpperCase();
}
