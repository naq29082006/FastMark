import { apiRequest, AUTH_TIMEOUT_MS } from './client';
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

export async function listSellerVouchersOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerVouchers,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.vouchers || [];
}

export async function createSellerVoucherOnBackend({ idToken, payload }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerVouchers,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify(payload),
    },
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data?.voucher;
}

export async function updateSellerVoucherOnBackend({ idToken, voucherId, payload }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerVoucher(voucherId),
    {
      method: 'PUT',
      headers: await authHeaders(idToken),
      body: JSON.stringify(payload),
    },
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data?.voucher;
}

export async function deleteSellerVoucherOnBackend({ idToken, voucherId }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerVoucher(voucherId),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
    AUTH_TIMEOUT_MS
  );
  await parseApiResponse(response);
  return true;
}

export async function listNearbyVouchersOnBackend(idToken, { limit = 12 } = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerVouchersNearby}?limit=${limit}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.vouchers || [];
}

export async function listShopVouchersOnBackend(idToken, shopId) {
  const response = await apiRequest(
    `${API_ENDPOINTS.buyerVouchers}?shopId=${encodeURIComponent(shopId)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.vouchers || [];
}
