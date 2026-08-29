import { apiRequest } from './client';

export async function listAdminBanks(token) {
  return apiRequest('/api/admin/banks', { token });
}

export async function createAdminBank(token, body) {
  return apiRequest('/api/admin/banks', { method: 'POST', token, body });
}

export async function updateAdminBank(token, bankId, body) {
  return apiRequest(`/api/admin/banks/${bankId}`, {
    method: 'PUT',
    token,
    body,
  });
}

export async function deleteAdminBank(token, bankId) {
  return apiRequest(`/api/admin/banks/${bankId}`, {
    method: 'DELETE',
    token,
  });
}

export async function listAdminWithdraws(token, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.status !== undefined && params.status !== '') query.set('status', params.status);
  if (params.q) query.set('q', params.q);
  if (params.search) query.set('q', params.search);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest(`/api/admin/withdraws${suffix}`, { token });
}

export async function getAdminWithdraw(token, withdrawId) {
  return apiRequest(`/api/admin/withdraws/${withdrawId}`, { token });
}

export async function approveAdminWithdraw(token, withdrawId, body = {}) {
  return apiRequest(`/api/admin/withdraws/${withdrawId}/approve`, {
    method: 'POST',
    token,
    body,
  });
}

export async function rejectAdminWithdraw(token, withdrawId, body = {}) {
  return apiRequest(`/api/admin/withdraws/${withdrawId}/reject`, {
    method: 'POST',
    token,
    body,
  });
}
