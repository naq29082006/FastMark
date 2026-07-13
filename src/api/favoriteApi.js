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

export async function getFavoriteProductsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavorites,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.favorites || [];
}

export async function getFavoriteProductIdsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavoriteIds,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.productIds || [];
}

export async function addFavoriteProductOnBackend({ idToken, productId }) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavorites,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ productId }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.favorite;
}

export async function removeFavoriteProductOnBackend(idToken, productId) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerFavorite(productId),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
    AUTH_TIMEOUT_MS
  );
  await parseApiResponse(response);
}
