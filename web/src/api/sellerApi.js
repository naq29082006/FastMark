import { apiRequest } from './client';

export function listPendingVerifications(token) {
  return apiRequest('/api/seller/verification/pending', { token });
}

export function listAdminVerifications(token, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/seller/verification/admin${suffix}`, { token });
}

export function approveVerification(token, verificationId) {
  return apiRequest(`/api/seller/verification/${verificationId}/approve`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function updateAdminVerification(token, verificationId, body) {
  return apiRequest(`/api/seller/verification/${verificationId}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function rejectVerification(token, verificationId, lyDoTuChoi) {
  return apiRequest(`/api/seller/verification/${verificationId}/reject`, {
    method: 'POST',
    token,
    body: { lyDoTuChoi },
  });
}
