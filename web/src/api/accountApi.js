import { apiRequest } from './client';
import { normalizeFinanceOverview } from '../admin/utils/apiNormalize';

export function listAccounts(token, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const path = query ? `/api/admin/accounts?${query}` : '/api/admin/accounts';
  return apiRequest(path, { token });
}

export function getAccountDetail(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}`, { token });
}

export function blockAccount(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}/block`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function unblockAccount(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}/unblock`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function getAccountHistory(token, accountId, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return apiRequest(
    `/api/admin/accounts/${accountId}/history${query ? `?${query}` : ''}`,
    { token }
  );
}

export function getAccountFinance(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}/finance`, { token });
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

export function getAccountFollowing(token, accountId, params = {}) {
  return apiRequest(
    `/api/admin/accounts/${accountId}/following${buildFollowQuery(params)}`,
    { token }
  );
}

export function getAccountFollowers(token, accountId, params = {}) {
  return apiRequest(
    `/api/admin/accounts/${accountId}/followers${buildFollowQuery(params)}`,
    { token }
  );
}

export async function getFinanceOverview(token, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  const payload = await apiRequest(`/api/admin/finance/overview${query ? `?${query}` : ''}`, {
    token,
  });
  if (payload?.data) {
    payload.data = normalizeFinanceOverview(payload.data);
  }
  return payload;
}
export function getAccountStatistics(token) {
  return apiRequest('/api/admin/accounts/statistics', {
    token,
  });
}
