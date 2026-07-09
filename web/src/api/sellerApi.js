import { apiRequest } from './client';

export function listPendingVerifications(token) {
  return apiRequest('/api/seller/verification/pending', { token });
}

export function approveVerification(token, verificationId) {
  return apiRequest(`/api/seller/verification/${verificationId}/approve`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function rejectVerification(token, verificationId, lyDoTuChoi) {
  return apiRequest(`/api/seller/verification/${verificationId}/reject`, {
    method: 'POST',
    token,
    body: { lyDoTuChoi },
  });
}
