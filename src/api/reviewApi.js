import { apiRequest, AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function authHeaders(idToken) {
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

export async function getMyReviewsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerReviews,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.reviews || [];
}

export async function submitBuyerReviewOnBackend({
  idToken,
  storeId,
  storeName,
  productName,
  orderCode,
  rating,
  comment,
  imageUrl,
}) {
  const timeoutMs = imageUrl ? SELLER_UPLOAD_TIMEOUT_MS : AUTH_TIMEOUT_MS;
  const response = await apiRequest(
    API_ENDPOINTS.buyerReviews,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        storeId,
        storeName,
        productName,
        orderCode,
        rating,
        comment,
        imageUrl,
      }),
    },
    timeoutMs
  );
  const payload = await parseApiResponse(response);
  return payload.data?.review;
}

export async function updateBuyerReviewOnBackend({ idToken, reviewId, rating, comment }) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerReview(reviewId),
    {
      method: 'PUT',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ rating, comment }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.review;
}

export async function deleteBuyerReviewOnBackend(idToken, reviewId) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerReview(reviewId),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
    AUTH_TIMEOUT_MS
  );
  await parseApiResponse(response);
}
