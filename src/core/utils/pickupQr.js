/** QR payload đơn hàng — buyer hiển thị, seller quét (đồng bộ backend). */
export function buildPickupQrPayload({ reservationId, orderCode, buyerId } = {}) {
  const id = String(reservationId || '').trim();
  if (!id) {
    return '';
  }
  return JSON.stringify({
    v: 1,
    orderId: id,
    reservationId: id,
    orderCode: String(orderCode || '').trim(),
    buyerId: String(buyerId || '').trim(),
  });
}

export function parsePickupQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const id = String(parsed.orderId || parsed.reservationId || parsed.id || '').trim();
      if (id) {
        return id;
      }
    }
  } catch {
    // not JSON
  }

  const pipe = text.match(/^FM\|ORDER\|(.+)$/i);
  if (pipe?.[1]) {
    return String(pipe[1]).trim();
  }

  return text;
}

export function buildQrImageUrl(payload, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    payload
  )}`;
}

export function resolvePickupQrPayload(reservation) {
  const fromApi = String(reservation?.pickupQrPayload || '').trim();
  if (fromApi) {
    return fromApi;
  }
  const id = String(reservation?.id || reservation?._id || '').trim();
  if (!id) {
    return '';
  }
  const orderCode = String(reservation?.orderCode || '').trim();
  const buyerId = String(reservation?.buyer?.id || reservation?.buyerId || '').trim();
  return buildPickupQrPayload({ reservationId: id, orderCode, buyerId });
}
