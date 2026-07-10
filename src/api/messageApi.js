import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';

const MESSAGE_TYPE_IMAGE = 1;

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

export async function getBuyerConversationsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerConversations,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.conversations || [];
}

export async function getBuyerShopsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerShops,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.shops || [];
}

export async function startBuyerConversationOnBackend({ idToken, shopId, content, imageContent }) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerConversations,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        shopId,
        content,
        imageContent,
        messageType: imageContent ? MESSAGE_TYPE_IMAGE : undefined,
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || {};
}

export async function getBuyerMessagesOnBackend(idToken, conversationId) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerConversationMessages(conversationId),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.messages || [];
}

export async function sendBuyerMessageOnBackend({
  idToken,
  conversationId,
  content,
  imageContent,
}) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerConversationMessages(conversationId),
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        content,
        imageContent,
        messageType: imageContent ? MESSAGE_TYPE_IMAGE : undefined,
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.message;
}
