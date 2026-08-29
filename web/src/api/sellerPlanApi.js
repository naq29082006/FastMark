import { apiRequest } from './client';

export async function listSellerPlans(token) {
  return apiRequest('/api/admin/seller-plans', { token });
}

export async function createSellerPlan(token, body) {
  return apiRequest('/api/admin/seller-plans', { method: 'POST', token, body });
}

export async function updateSellerPlan(token, planId, body) {
  return apiRequest(`/api/admin/seller-plans/${planId}`, {
    method: 'PUT',
    token,
    body,
  });
}

export async function deleteSellerPlan(token, planId) {
  return apiRequest(`/api/admin/seller-plans/${planId}`, {
    method: 'DELETE',
    token,
  });
}

export async function listSellerSubscriptions(token, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.status !== undefined && params.status !== '') query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest(`/api/admin/seller-subscriptions${suffix}`, { token });
}

export async function listBannerPlans(token) {
  return apiRequest('/api/admin/banner-plans', { token });
}

export async function createBannerPlan(token, body) {
  return apiRequest('/api/admin/banner-plans', { method: 'POST', token, body });
}

export async function updateBannerPlan(token, planId, body) {
  return apiRequest(`/api/admin/banner-plans/${planId}`, {
    method: 'PUT',
    token,
    body,
  });
}

export async function deleteBannerPlan(token, planId) {
  return apiRequest(`/api/admin/banner-plans/${planId}`, {
    method: 'DELETE',
    token,
  });
}

export async function listSellerBanners(token, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.filter !== undefined && params.filter !== '') query.set('filter', params.filter);
  if (params.status !== undefined && params.status !== '') query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest(`/api/admin/seller-banners${suffix}`, { token });
}

export async function approveSellerBanner(token, bannerId) {
  return apiRequest(`/api/admin/seller-banners/${bannerId}/approve`, {
    method: 'POST',
    token,
  });
}

export async function rejectSellerBanner(token, bannerId, body) {
  return apiRequest(`/api/admin/seller-banners/${bannerId}/reject`, {
    method: 'POST',
    token,
    body,
  });
}

export async function cancelSellerBanner(token, bannerId) {
  return apiRequest(`/api/admin/seller-banners/${bannerId}/cancel`, {
    method: 'POST',
    token,
  });
}
