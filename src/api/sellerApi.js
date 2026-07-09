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

export async function requestSellerPhoneCodeOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerPhoneCodeRequest,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({}),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function confirmSellerPhoneCodeOnBackend({ idToken, code }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerPhoneCodeConfirm,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ code }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function getMySellerVerificationOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerVerificationMe,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function submitSellerVerificationOnBackend({ idToken, payload }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerVerificationSubmit,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify(payload),
    },
    SELLER_UPLOAD_TIMEOUT_MS
  );

  const parsed = await parseApiResponse(response);
  return parsed.data;
}
