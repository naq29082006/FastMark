import { apiRequest, AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    let message = payload.message || 'Yêu cầu API thất bại.';
    if (response.status === 404 && message === 'API not found') {
      message =
        'Backend chưa có API này. Khởi động lại backend: cd backend && npm run dev';
    }
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function authHeaders(idToken) {
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

export async function getBuyerOrdersOnBackend({ idToken, tab, search, page = 1, limit = 20 }) {
  const params = new URLSearchParams({
    tab: tab || 'pending',
    page: String(page),
    limit: String(limit),
  });
  if (search) {
    params.set('search', search);
  }

  const response = await apiRequest(
    `${API_ENDPOINTS.buyerOrders}?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function createBuyerReservationOnBackend({
  idToken,
  productId,
  variantId,
  quantity,
  pickupTime,
  note,
}) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerReservations,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        productId,
        variantId,
        quantity,
        pickupTime,
        note,
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function cancelBuyerReservationOnBackend(idToken, reservationId) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerReservationCancel(reservationId),
    { method: 'POST', headers: await authHeaders(idToken), body: '{}' },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function confirmBuyerReceivedOnBackend(idToken, payload) {
  const reservationId =
    typeof payload === 'string'
      ? String(payload || '').trim()
      : String(payload?.reservationId || '').trim();
  const scannedShopId =
    typeof payload === 'string' ? '' : String(payload?.scannedShopId || '').trim();

  if (!reservationId) {
    throw new Error('Không tìm thấy mã đơn giữ hàng.');
  }
  if (!scannedShopId) {
    throw new Error('Thiếu mã shop đã quét.');
  }

  const response = await apiRequest(
    API_ENDPOINTS.buyerReservationConfirmReceived,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ reservationId, scannedShopId }),
    },
    AUTH_TIMEOUT_MS
  );
  const payloadRes = await parseApiResponse(response);
  return payloadRes.data?.reservation;
}

export async function reportBuyerReservationOnBackend(
  idToken,
  { reservationId, reason, description, images }
) {
  const id = String(reservationId || '').trim();
  if (!id) {
    throw new Error('Không tìm thấy mã đơn giữ hàng.');
  }
  const hasImages = Array.isArray(images) && images.length > 0;
  const response = await apiRequest(
    API_ENDPOINTS.buyerReportSeller,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        reservationId: id,
        reason,
        description: description || '',
        images: images || [],
      }),
    },
    hasImages ? SELLER_UPLOAD_TIMEOUT_MS : AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation || payload.data;
}

export async function getReservationDisputeReportsOnBackend(idToken, reservationId) {
  const id = encodeURIComponent(String(reservationId || '').trim());
  if (!id) {
    throw new Error('Thiếu reservationId.');
  }
  const response = await apiRequest(
    API_ENDPOINTS.reservationDisputeReports(id),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reports || [];
}

/** Buyer đồng ý mất cọc sau quá giờ nhận → giải ngân cho seller. */
export async function forfeitBuyerDepositOnBackend(idToken, reservationId) {
  const id = String(reservationId || '').trim();
  if (!id) {
    throw new Error('Thiếu reservationId.');
  }

  const response = await apiRequest(
    API_ENDPOINTS.buyerReservationForfeitDepositById(id),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ reservationId: id }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function getBuyerReservationOnBackend(idToken, reservationId) {
  const id = encodeURIComponent(String(reservationId || '').trim());
  if (!id) {
    throw new Error('Không tìm thấy mã đơn giữ hàng.');
  }
  const response = await apiRequest(
    API_ENDPOINTS.buyerReservation(id),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}
