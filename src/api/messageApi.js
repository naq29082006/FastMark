import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { callWithAuthToken } from './authTokenHelper';
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

export async function getBuyerConversationsOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.buyerConversations,
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data?.conversations || [];
  });
}

export async function getBuyerShopsOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.buyerShops,
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data?.shops || [];
  });
}

export async function startBuyerConversationOnBackend({ shopId, shopName, content, imageContent }) {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.buyerConversations,
      {
        method: 'POST',
        headers: await authHeaders(idToken),
        body: JSON.stringify({
          shopId,
          shopName,
          content,
          imageContent,
          messageType: imageContent ? MESSAGE_TYPE_IMAGE : undefined,
        }),
      },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data || {};
  });
}

export async function getBuyerMessagesOnBackend(conversationId) {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.buyerConversationMessages(conversationId),
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return {
      messages: payload.data?.messages || [],
      sequence: payload.data?.sequence || null,
    };
  });
}

export async function sendBuyerMessageOnBackend({ conversationId, content, imageContent }) {
  return callWithAuthToken(async (idToken) => {
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
  });
}

export async function deleteBuyerMessageOnBackend(conversationId, messageId) {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.buyerConversationMessage(conversationId, messageId),
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data?.message;
  });
}

export async function getBuyerConversationPeerOnBackend(conversationId) {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.buyerConversationPeer(conversationId),
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data?.peer;
  });
}
