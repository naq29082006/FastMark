import { apiRequest, AUTH_TIMEOUT_MS } from './client';
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

export async function getBuyerOrdersOnBackend({ idToken, tab, search }) {
  const params = new URLSearchParams({ tab: tab || 'holding' });
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

export async function completeBuyerReservationOnBackend(idToken, reservationId) {
  const id = encodeURIComponent(String(reservationId || '').trim());
  if (!id) {
    throw new Error('Không tìm thấy mã đơn giữ hàng.');
  }
  const response = await apiRequest(
    API_ENDPOINTS.buyerReservationComplete(id),
    { method: 'POST', headers: await authHeaders(idToken), body: '{}' },
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
