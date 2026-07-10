import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { callWithAuthToken } from './authTokenHelper';
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

export async function setPresenceOnlineOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.presenceOnline,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: '{}',
      },
      AUTH_TIMEOUT_MS
    );
    return parseApiResponse(response);
  });
}

export async function setPresenceOfflineOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.presenceOffline,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: '{}',
      },
      AUTH_TIMEOUT_MS
    );
    return parseApiResponse(response);
  });
}

export async function setShopPresenceOnlineOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.shopPresenceOnline,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: '{}',
      },
      AUTH_TIMEOUT_MS
    );
    return parseApiResponse(response);
  });
}

export async function setShopPresenceOfflineOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.shopPresenceOffline,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: '{}',
      },
      AUTH_TIMEOUT_MS
    );
    return parseApiResponse(response);
  });
}
