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

export async function getFollowStatusOnBackend(idToken, { shopId, sellerUserId } = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerFollowStatus}${toQuery({ shopId, sellerUserId })}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { isFollowing: false, followersCount: 0 };
}

export async function followUserOnBackend({ idToken, shopId, sellerUserId }) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFollows,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ shopId, sellerUserId }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function unfollowUserOnBackend({ idToken, shopId, sellerUserId }) {
  const query = toQuery({
    shopId: shopId || undefined,
    sellerUserId: sellerUserId || undefined,
  });
  const path = sellerUserId
    ? `${API_ENDPOINTS.buyerFollow(sellerUserId)}${query}`
    : `${API_ENDPOINTS.buyerFollows}${query}`;

  const response = await apiRequest(
    path,
    {
      method: 'DELETE',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        ...(shopId ? { shopId } : {}),
        ...(sellerUserId ? { sellerUserId } : {}),
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function getFollowingOnBackend(idToken, params = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerFollowing}${toQuery(params)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
}

export async function getFollowersOnBackend(idToken, params = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerFollowers}${toQuery(params)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
}
