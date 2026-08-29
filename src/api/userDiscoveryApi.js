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

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function searchUsersOnBackend(idToken, { search, limit = 30, page = 1 } = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerUsersSearch}${toQuery({ search, q: search, limit, page })}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { items: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
}

export async function getPublicUserProfileOnBackend(idToken, userId) {
  const response = await apiRequest(API_ENDPOINTS.buyerUserProfile(userId), {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  }, AUTH_TIMEOUT_MS);
  const payload = await parseApiResponse(response);
  return payload.data || null;
}
