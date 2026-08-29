import { apiRequest, AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
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

export async function getSellerShopSettingsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerShop,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.shop;
}

export async function updateSellerShopSettingsOnBackend({ idToken, payload }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerShop,
    {
      method: 'PUT',
      headers: await authHeaders(idToken),
      body: JSON.stringify(payload),
    },
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data?.shop;
}

export async function checkSellerShopUsernameAvailabilityOnBackend({ idToken, shopUsername }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerShopUsernameAvailability,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ shopUsername }),
    },
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data || { available: false, message: 'Không kiểm tra được username shop.' };
}

export async function uploadShopAvatarOnBackend({ idToken, imageBase64, mimeType = 'image/jpeg' }) {
  if (!imageBase64) {
    throw new Error('Thiếu dữ liệu ảnh để upload.');
  }

  const response = await apiRequest(
    API_ENDPOINTS.sellerShopAvatar,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        imageBase64,
        mimeType,
      }),
    },
    SELLER_UPLOAD_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data?.shop || null;
}

export async function getSellerOrdersOnBackend({ idToken, tab, search, page = 1, limit = 20 }) {
  const params = new URLSearchParams({
    tab: tab || 'pending',
    page: String(page),
    limit: String(limit),
  });
  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    params.set('search', trimmedSearch);
  }
  const response = await apiRequest(
    `${API_ENDPOINTS.sellerOrders}?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function getSellerReviewsOnBackend({ idToken, page = 1, limit = 20 }) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const response = await apiRequest(
    `${API_ENDPOINTS.sellerReviews}?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function getSellerReviewDetailOnBackend(idToken, reviewId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReview(reviewId),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.review;
}

export async function getSellerReservationDetailOnBackend(idToken, reservationId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservation(reservationId),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function confirmSellerReservationOnBackend(idToken, reservationId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationConfirm(reservationId),
    { method: 'POST', headers: await authHeaders(idToken), body: '{}' },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function rejectSellerReservationOnBackend({ idToken, reservationId, reason }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationReject(reservationId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ reason }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function cancelSellerReservationOnBackend({
  idToken,
  reservationId,
  reason,
  images = [],
}) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationCancel(reservationId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ reason, images }),
    },
    SELLER_UPLOAD_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function refundSellerDisputeDepositOnBackend(idToken, reservationId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationRefundDispute(reservationId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: '{}',
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function reportBuyerNoShowOnBackend({
  idToken,
  reservationId,
  reason,
  description,
  note,
  title,
  images,
}) {
  const id = String(reservationId || '').trim();
  if (!id) {
    throw new Error('Thiếu reservationId.');
  }
  const hasImages = Array.isArray(images) && images.length > 0;
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationReportBuyer(id),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        reservationId: id,
        reason: reason || undefined,
        title: title || 'Báo cáo người mua',
        description: description || note || '',
        note: note || description || '',
        images: images || [],
      }),
    },
    hasImages ? SELLER_UPLOAD_TIMEOUT_MS : AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation || payload.data;
}

export async function validateSellerPickupQrOnBackend(idToken, { qrPayload }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationValidatePickupQr,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ qrPayload }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation || payload.data;
}

export async function confirmSellerDeliveredOnBackend(idToken, reservationId) {
  const id = String(reservationId || '').trim();
  if (!id) {
    throw new Error('Thiếu reservationId.');
  }
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationConfirmDelivered(id),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: '{}',
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function adjustSellerReservationAtPickupOnBackend(idToken, reservationId, { quantity }) {
  const id = String(reservationId || '').trim();
  if (!id) {
    throw new Error('Thiếu reservationId.');
  }
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationAdjustAtPickup(id),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ quantity }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function respondSellerPostDeliveryComplaintOnBackend(
  idToken,
  { reservationId, description, images }
) {
  const id = String(reservationId || '').trim();
  if (!id) {
    throw new Error('Thiếu reservationId.');
  }
  const hasImages = Array.isArray(images) && images.length > 0;
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationDisputeResponse(id),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        reservationId: id,
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

export async function getSellerStatsOnBackend(idToken, { range, from, to } = {}) {
  const params = new URLSearchParams();
  if (range) {
    params.set('range', range);
  }
  if (from) {
    params.set('from', from);
  }
  if (to) {
    params.set('to', to);
  }
  const query = params.toString();
  const response = await apiRequest(
    query ? `${API_ENDPOINTS.sellerStats}?${query}` : API_ENDPOINTS.sellerStats,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.stats;
}
