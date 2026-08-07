import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';
import { normalizeWallet, normalizeWalletTransaction } from '../model/walletModel';
import { DEFAULT_PAGE_SIZE, normalizePageResult } from '../core/utils/pagination';

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

export async function getWalletTransactionsOnBackend(
  idToken,
  { page = 1, limit = DEFAULT_PAGE_SIZE, type } = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (type != null && String(type).trim() !== '') {
    params.set('type', String(type));
  }
  const response = await apiRequest(
    `${API_ENDPOINTS.walletTransactions}?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  const data = payload.data || {};
  const result = normalizePageResult(
    { ...data, items: data.transactions || data.items || [] },
    'items'
  );
  return {
    ...result,
    transactions: result.items.map(normalizeWalletTransaction),
    items: result.items.map(normalizeWalletTransaction),
  };
}

export async function getWalletTransactionOnBackend(idToken, transactionId) {
  const id = encodeURIComponent(String(transactionId || '').trim());
  if (!id) {
    throw new Error('Thiếu mã giao dịch.');
  }

  const response = await apiRequest(
    API_ENDPOINTS.walletTransaction(id),
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return normalizeWalletTransaction(payload.data?.transaction || {});
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
    description: payload.data?.description || '',
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

export async function cancelWalletTopupOnBackend(idToken, orderCode) {
  const response = await apiRequest(
    API_ENDPOINTS.walletTopupCancel,
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

export async function listWalletBanksOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.walletBanks,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.banks || [];
}

export async function createWalletWithdrawOnBackend(idToken, body) {
  const response = await apiRequest(
    API_ENDPOINTS.walletWithdraw,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify(body),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return {
    withdraw: payload.data?.withdraw || null,
    wallet: normalizeWallet(payload.data?.wallet || {}),
  };
}

export async function listWalletWithdrawsOnBackend(
  idToken,
  { page = 1, limit = DEFAULT_PAGE_SIZE } = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const response = await apiRequest(
    `${API_ENDPOINTS.walletWithdraws}?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  const data = payload.data || {};
  return normalizePageResult(
    { ...data, items: data.withdraws || data.items || [] },
    'items'
  );
}
