import {
  createWalletWithdrawOnBackend,
  listWalletBanksOnBackend,
  listWalletWithdrawsOnBackend,
} from '../../api/walletApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';

async function requireToken() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }
  return idToken;
}

export async function loadWithdrawBanksViewModel() {
  const idToken = await requireToken();
  const data = await listWalletBanksOnBackend(idToken);
  if (Array.isArray(data)) {
    return { banks: data, withdrawProfile: null };
  }
  return {
    banks: Array.isArray(data?.banks) ? data.banks : [],
    withdrawProfile: data?.withdrawProfile || null,
  };
}

export async function loadMyWithdrawsViewModel({ page = 1, limit = 20 } = {}) {
  const idToken = await requireToken();
  return listWalletWithdrawsOnBackend(idToken, { page, limit });
}

export async function createWithdrawViewModel(payload) {
  const idToken = await requireToken();
  return createWalletWithdrawOnBackend(idToken, payload);
}
