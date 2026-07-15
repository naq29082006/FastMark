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

export async function getFavoriteShopsOnBackend(idToken, params = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerFavoriteShops}${toQuery(params)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
}

export async function getFavoriteShopIdsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavoriteShopIds,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.shopIds || [];
}

export async function getFavoriteShopStatusOnBackend(idToken, shopId) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerFavoriteShopStatus}${toQuery({ shopId })}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { isFavorite: false, totalLikes: 0 };
}

export async function addFavoriteShopOnBackend({ idToken, shopId }) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavoriteShops,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ shopId }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.favorite;
}

export async function removeFavoriteShopOnBackend(idToken, shopId) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavoriteShop(shopId),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}
