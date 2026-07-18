import {
  createWalletTopupOnBackend,
  getWalletOnBackend,
  getWalletTransactionsOnBackend,
  syncWalletTopupOnBackend,
} from '../../api/walletApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';

export async function loadWalletViewModel() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để xem ví.');
  }

  const [wallet, transactions] = await Promise.all([
    getWalletOnBackend(idToken),
    getWalletTransactionsOnBackend(idToken, { limit: 20 }),
  ]);

  return { wallet, transactions };
}

export async function createTopupViewModel(amount) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để nạp tiền.');
  }

  return createWalletTopupOnBackend(idToken, amount);
}

export async function syncTopupViewModel(orderCode) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }

  return syncWalletTopupOnBackend(idToken, orderCode);
}
