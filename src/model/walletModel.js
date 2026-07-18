export const WALLET_TX_TYPE = {
  TOPUP: 1,
  PAYMENT: 2,
  REFUND: 3,
};

export const WALLET_TX_STATUS = {
  PENDING: 0,
  SUCCESS: 1,
  FAILED: 2,
  CANCELLED: 3,
};

export function normalizeWallet(row) {
  return {
    balance: Math.max(0, Number(row?.balance) || 0),
    updatedAt: row?.updatedAt || null,
  };
}

export function normalizeWalletTransaction(row) {
  const amount = Number(row?.amount) || 0;
  const type = Number(row?.type) || WALLET_TX_TYPE.TOPUP;
  const status = Number(row?.status);

  return {
    id: String(row?.id || ''),
    type,
    typeLabel: row?.typeLabel || 'Giao dịch',
    amount,
    status: Number.isFinite(status) ? status : WALLET_TX_STATUS.PENDING,
    orderCode: row?.orderCode == null ? null : Number(row.orderCode),
    paymentLinkId: row?.paymentLinkId || '',
    description: row?.description || '',
    balanceAfter: row?.balanceAfter == null ? null : Number(row.balanceAfter),
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
    isCredit: type === WALLET_TX_TYPE.TOPUP || type === WALLET_TX_TYPE.REFUND,
  };
}
