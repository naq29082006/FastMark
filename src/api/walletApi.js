import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';
import { normalizeWallet, normalizeWalletTransaction } from '../model/walletModel';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    let message = payload.message || 'Yêu cầu API thất bại.';
    if (response.status === 404 && message === 'API not found') {
      message =
        'Backend chưa có API ví. Khởi động lại backend: cd backend && npm run dev';
    }
    const error = new Error(message);
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

export async function getWalletOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.wallet,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return normalizeWallet(payload.data?.wallet || {});
}

export async function getWalletTransactionsOnBackend(idToken, { limit = 30 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiRequest(
    `${API_ENDPOINTS.walletTransactions}?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return (payload.data?.transactions || []).map(normalizeWalletTransaction);
}

export async function createWalletTopupOnBackend(idToken, amount) {
  const response = await apiRequest(
    API_ENDPOINTS.walletTopup,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ amount }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return {
    transaction: normalizeWalletTransaction(payload.data?.transaction || {}),
    checkoutUrl: payload.data?.checkoutUrl || '',
    orderCode: payload.data?.orderCode ?? null,
    paymentLinkId: payload.data?.paymentLinkId || '',
  };
}

export async function syncWalletTopupOnBackend(idToken, orderCode) {
  const response = await apiRequest(
    API_ENDPOINTS.walletTopupSync,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ orderCode }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return {
    transaction: normalizeWalletTransaction(payload.data?.transaction || {}),
    wallet: normalizeWallet(payload.data?.wallet || {}),
  };
}
