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

export function getShopHistory(token, shopId, params = {}) {
  return apiRequest(buildQueryPath(`/api/admin/shops/${shopId}/history`, params), { token });
}

export function blockShop(token, shopId) {
  return apiRequest(`/api/admin/shops/${shopId}/block`, { method: 'POST', token, body: {} });
}

export function unblockShop(token, shopId) {
  return apiRequest(`/api/admin/shops/${shopId}/unblock`, { method: 'POST', token, body: {} });
}

function buildFollowQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getShopFollowing(token, shopId, params = {}) {
  return apiRequest(`/api/admin/shops/${shopId}/following${buildFollowQuery(params)}`, { token });
}

export function getShopFollowers(token, shopId, params = {}) {
  return apiRequest(`/api/admin/shops/${shopId}/followers${buildFollowQuery(params)}`, { token });
}

export function listProducts(token, params = {}) {
  return apiRequest(buildQueryPath('/api/admin/products', params), { token });
}

export function getProductDetail(token, productId) {
  return apiRequest(`/api/admin/products/${productId}`, { token });
}

export function hideProduct(token, productId) {
  return apiRequest(`/api/admin/products/${productId}/hide`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function showProduct(token, productId) {
  return apiRequest(`/api/admin/products/${productId}/show`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function deleteProduct(token, productId, { reason } = {}) {
  return apiRequest(`/api/admin/products/${productId}`, {
    method: 'DELETE',
    token,
    body: reason ? { reason } : {},
  });
}
