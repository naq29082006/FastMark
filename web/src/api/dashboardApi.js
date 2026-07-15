import { apiRequest } from './client';

export async function getAdminDashboard(token, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await apiRequest(`/api/admin/dashboard${suffix}`, {
    method: 'GET',
    token,
  });
  return payload.data?.dashboard || null;
}
