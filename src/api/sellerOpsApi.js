import { apiRequest, AUTH_TIMEOUT_MS } from './client';
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

export async function uploadSellerShopAvatarOnBackend({ idToken, imageBase64, mimeType = 'image/jpeg' }) {
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
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data;
}

export async function getSellerOrdersOnBackend({ idToken, tab }) {
  const response = await apiRequest(
    `${API_ENDPOINTS.sellerOrders}?tab=${encodeURIComponent(tab)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
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

export async function cancelSellerReservationOnBackend({ idToken, reservationId, reason }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationCancel(reservationId),
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

export async function completeSellerReservationOnBackend(idToken, reservationId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerReservationComplete(reservationId),
    { method: 'POST', headers: await authHeaders(idToken), body: '{}' },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reservation;
}

export async function acceptSellerDealOnBackend(idToken, dealId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerDealAccept(dealId),
    { method: 'POST', headers: await authHeaders(idToken), body: '{}' },
    AUTH_TIMEOUT_MS
  );
  return parseApiResponse(response);
}

export async function rejectSellerDealOnBackend({ idToken, dealId, reason }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerDealReject(dealId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ reason }),
    },
    AUTH_TIMEOUT_MS
  );
  return parseApiResponse(response);
}

export async function counterSellerDealOnBackend({ idToken, dealId, counterPrice, note }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerDealCounter(dealId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ counterPrice, note }),
    },
    AUTH_TIMEOUT_MS
  );
  return parseApiResponse(response);
}

export async function getSellerConversationsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerConversations,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.conversations || [];
}

export async function getSellerMessagesOnBackend(idToken, conversationId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerConversationMessages(conversationId),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return {
    messages: payload.data?.messages || [],
    sequence: payload.data?.sequence || null,
  };
}

export async function sendSellerMessageOnBackend({ idToken, conversationId, content, imageContent }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerConversationMessages(conversationId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        content,
        imageContent,
        messageType: imageContent ? 1 : undefined,
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.message;
}

export async function deleteSellerMessageOnBackend(idToken, conversationId, messageId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerConversationMessage(conversationId, messageId),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return {
    message: payload.data?.message,
    lastMessage: payload.data?.lastMessage || payload.data?.message?.conversationLastMessage || '',
  };
}

export async function getSellerConversationPeerOnBackend(idToken, conversationId) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerConversationPeer(conversationId),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.peer;
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
