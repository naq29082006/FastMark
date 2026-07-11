import { apiRequest } from './client';

export function listReports(token, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const path = query ? `/api/admin/reports?${query}` : '/api/admin/reports';
  return apiRequest(path, { token });
}

export function getReportDetail(token, reportId) {
  return apiRequest(`/api/admin/reports/${reportId}`, { token });
}

export function dismissReport(token, reportId) {
  return apiRequest(`/api/admin/reports/${reportId}/dismiss`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function approveReport(token, reportId, action) {
  return apiRequest(`/api/admin/reports/${reportId}/approve`, {
    method: 'POST',
    token,
    body: { action },
  });
}
