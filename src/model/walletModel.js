export const WALLET_TX_TYPE = {
  TOPUP: 1,
  PAYMENT: 2,
  REFUND: 3,
  WITHDRAWAL: 4,
  DEPOSIT_HOLD: 5,
  DEPOSIT_REFUND: 6,
  DEPOSIT_RELEASE: 7,
};

export const WALLET_TX_TYPE_LABEL = {
  [WALLET_TX_TYPE.TOPUP]: 'Nạp tiền',
  [WALLET_TX_TYPE.PAYMENT]: 'Thanh toán',
  [WALLET_TX_TYPE.REFUND]: 'Hoàn tiền',
  [WALLET_TX_TYPE.WITHDRAWAL]: 'Rút tiền',
  [WALLET_TX_TYPE.DEPOSIT_HOLD]: 'Đặt cọc giữ hàng',
  [WALLET_TX_TYPE.DEPOSIT_REFUND]: 'Hoàn cọc giữ hàng',
  [WALLET_TX_TYPE.DEPOSIT_RELEASE]: 'Giải phóng cọc cho shop',
};

export const WALLET_TX_STATUS = {
  PENDING: 0,
  SUCCESS: 1,
  FAILED: 2,
  CANCELLED: 3,
};

export const WALLET_TX_STATUS_LABEL = {
  [WALLET_TX_STATUS.PENDING]: 'Đang chờ',
  [WALLET_TX_STATUS.SUCCESS]: 'Thành công',
  [WALLET_TX_STATUS.FAILED]: 'Thất bại',
  [WALLET_TX_STATUS.CANCELLED]: 'Đã hủy',
};

export function normalizeWallet(row) {
  return {
    balance: Math.max(0, Number(row?.balance) || 0),
    updatedAt: row?.updatedAt || null,
  };
}

/** Số dư hiển thị: ưu tiên balanceAfter của giao dịch thành công mới nhất nếu cao hơn API wallet. */
export function resolveWalletDisplayBalance(wallet, transactions = []) {
  let display = Math.max(0, Number(wallet?.balance) || 0);
  const list = Array.isArray(transactions) ? transactions : [];
  for (const tx of list) {
    if (Number(tx?.status) !== WALLET_TX_STATUS.SUCCESS) {
      continue;
    }
    const after = Number(tx?.balanceAfter);
    if (Number.isFinite(after) && after > display) {
      display = after;
    }
  }
  return display;
}

export function normalizeWalletTransaction(row) {
  const amount = Number(row?.amount) || 0;
  const type = Number(row?.type) || WALLET_TX_TYPE.TOPUP;
  const status = Number(row?.status);
  const resolvedStatus = Number.isFinite(status) ? status : WALLET_TX_STATUS.PENDING;
  const isCredit =
    type === WALLET_TX_TYPE.TOPUP ||
    type === WALLET_TX_TYPE.REFUND ||
    type === WALLET_TX_TYPE.DEPOSIT_REFUND ||
    type === WALLET_TX_TYPE.DEPOSIT_RELEASE;

  return {
    id: String(row?.id || ''),
    type,
    typeLabel: row?.typeLabel || WALLET_TX_TYPE_LABEL[type] || 'Giao dịch',
    amount,
    status: resolvedStatus,
    statusLabel:
      row?.statusLabel || WALLET_TX_STATUS_LABEL[resolvedStatus] || '',
    orderCode: row?.orderCode == null ? null : Number(row.orderCode),
    paymentLinkId: row?.paymentLinkId || '',
    description: row?.description || '',
    balanceAfter: row?.balanceAfter == null ? null : Number(row.balanceAfter),
    reservationId:
      row?.reservationId != null
        ? String(row.reservationId)
        : String(row?.referenceType || '') === 'Reservation' && row?.referenceId
          ? String(row.referenceId)
          : null,
    bankName: row?.bankName || '',
    bankCode: row?.bankCode || '',
    accountNumber: row?.accountNumber || '',
    accountName: row?.accountName || '',
    adminNote: row?.adminNote || '',
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
    isCredit,
  };
}
