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

/** Theo dõi User. Có thể truyền followedUserId hoặc shopId (map → chủ shop). */
export async function getFollowStatusOnBackend(
  idToken,
  { followedUserId, shopId, userId } = {}
) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerFollowStatus}${toQuery({
      followedUserId: followedUserId || userId,
      shopId,
    })}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { isFollowing: false, soNguoiTheo: 0 };
}

export async function followShopOnBackend({ idToken, shopId, followedUserId, userId }) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFollows,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        followedUserId: followedUserId || userId || undefined,
        shopId: shopId || undefined,
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function unfollowShopOnBackend({ idToken, shopId, followedUserId, userId }) {
  const targetId = followedUserId || userId || shopId;
  const path = targetId
    ? API_ENDPOINTS.buyerFollow(targetId)
    : API_ENDPOINTS.buyerFollows;

  const response = await apiRequest(
    path,
    {
      method: 'DELETE',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        followedUserId: followedUserId || userId || undefined,
        shopId: shopId || undefined,
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
