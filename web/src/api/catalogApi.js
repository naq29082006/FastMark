import { apiRequest } from './client';

function buildQueryPath(basePath, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function listShops(token, params = {}) {
  return apiRequest(buildQueryPath('/api/admin/shops', params), { token });
}

export function getShopDetail(token, shopId) {
  return apiRequest(`/api/admin/shops/${shopId}`, { token });
}

export function blockShop(token, shopId) {
  return apiRequest(`/api/admin/shops/${shopId}/block`, { method: 'POST', token, body: {} });
}

export function unblockShop(token, shopId) {
  return apiRequest(`/api/admin/shops/${shopId}/unblock`, { method: 'POST', token, body: {} });
}

export function deleteShop(token, shopId) {
  return apiRequest(`/api/admin/shops/${shopId}`, { method: 'DELETE', token });
}

export function listProducts(token, params = {}) {
  return apiRequest(buildQueryPath('/api/admin/products', params), { token });
}

export function getProductDetail(token, productId) {
  return apiRequest(`/api/admin/products/${productId}`, { token });
}

export function hideProduct(token, productId) {
  return apiRequest(`/api/admin/products/${productId}/hide`, { method: 'POST', token, body: {} });
}

export function showProduct(token, productId) {
  return apiRequest(`/api/admin/products/${productId}/show`, { method: 'POST', token, body: {} });
}

export function deleteProduct(token, productId) {
  return apiRequest(`/api/admin/products/${productId}`, { method: 'DELETE', token });
}

export function listReservations(token, params = {}) {
  return apiRequest(buildQueryPath('/api/admin/reservations', params), { token });
}

export function getReservationDetail(token, reservationId) {
  return apiRequest(`/api/admin/reservations/${reservationId}`, { token });
}

export function cancelReservation(token, reservationId, reason = '') {
  return apiRequest(`/api/admin/reservations/${reservationId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}
