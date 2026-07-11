import { apiRequest } from './client';

export function listAdminReviews(token, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const path = query ? `/api/admin/reviews?${query}` : '/api/admin/reviews';
  return apiRequest(path, { token });
}

export function hideAdminReview(token, reviewId) {
  return apiRequest(`/api/admin/reviews/${encodeURIComponent(reviewId)}/hide`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function showAdminReview(token, reviewId) {
  return apiRequest(`/api/admin/reviews/${encodeURIComponent(reviewId)}/show`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function deleteAdminReview(token, reviewId) {
  return apiRequest(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    token,
  });
}
