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

export async function getMyNotificationsOnBackend() {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.notifications,
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data?.items || [];
  });
}
