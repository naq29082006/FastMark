import { apiRequest } from './client';

export async function listBanners(token) {
  return apiRequest('/api/admin/banners', { token });
}

export async function createBanner(token, body) {
  return apiRequest('/api/admin/banners', { method: 'POST', token, body });
}

export async function updateBanner(token, bannerId, body) {
  return apiRequest(`/api/admin/banners/${bannerId}`, { method: 'PUT', token, body });
}

export async function deleteBanner(token, bannerId) {
  return apiRequest(`/api/admin/banners/${bannerId}`, { method: 'DELETE', token });
}
