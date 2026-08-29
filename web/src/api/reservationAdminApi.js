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

export function listReservations(token, params = {}) {
  return apiRequest(buildQueryPath('/api/admin/reservations', params), { token });
}

export function getReservationStats(token) {
  return apiRequest('/api/admin/reservations/stats', { token });
}

export function listDisputes(token, params = {}) {
  return apiRequest(buildQueryPath('/api/admin/reservations/disputes', params), { token });
}

export function getReservationDetail(token, reservationId) {
  return apiRequest(`/api/admin/reservations/${reservationId}`, { token });
}

export function refundReservation(token, reservationId, note = '') {
  return apiRequest(`/api/admin/reservations/${reservationId}/refund`, {
    method: 'POST',
    token,
    body: { note },
  });
}

export function releaseReservation(token, reservationId, note = '') {
  return apiRequest(`/api/admin/reservations/${reservationId}/release`, {
    method: 'POST',
    token,
    body: { note },
  });
}

export function rejectReservationDispute(token, reservationId, note = '') {
  return apiRequest(`/api/admin/reservations/${reservationId}/reject-dispute`, {
    method: 'POST',
    token,
    body: { note },
  });
}

export function cancelReservation(token, reservationId, reason = '') {
  return apiRequest(`/api/admin/reservations/${reservationId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}
