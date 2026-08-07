import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { WALLET_TX_STATUS } from '../../model/walletModel';

function formatTxTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const WalletTransactionRow = memo(function WalletTransactionRow({ item, onPress }) {
  const isCredit = item.isCredit;
  const status = item.status;
  const pending = status === WALLET_TX_STATUS.PENDING;
  const success = status === WALLET_TX_STATUS.SUCCESS;
  const cancelled = status === WALLET_TX_STATUS.CANCELLED;
  const failed = status === WALLET_TX_STATUS.FAILED;
  const statusText =
    item.statusLabel ||
    (pending
      ? 'Đang chờ'
      : success
        ? 'Thành công'
        : cancelled
          ? 'Đã hủy'
          : failed
            ? 'Thất bại'
            : '');

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}
    >
      <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
        <Ionicons
          name={isCredit ? 'add' : 'remove'}
          size={20}
          color={isCredit ? t.primaryDark : t.danger}
        />
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {item.description || item.typeLabel}
        </Text>
        <Text style={styles.txMeta}>{formatTxTime(item.createdAt)}</Text>
        {statusText ? (
          <Text
            style={[
              styles.txStatus,
              pending && styles.txPending,
              success && styles.txSuccess,
              cancelled && styles.txCancelled,
              failed && styles.txFailed,
            ]}
          >
            {statusText}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.txAmount, isCredit ? styles.txAmountPlus : styles.txAmountMinus]}>
        {isCredit ? '+' : '-'}
        {formatPrice(item.amount)}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
});

export default WalletTransactionRow;

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  txRowPressed: { backgroundColor: '#f8fafc' },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: t.primarySoft },
  txIconDebit: { backgroundColor: t.dangerSoft },
  txBody: { flex: 1, gap: 2 },
  txTitle: { fontSize: 14, fontWeight: '700', color: t.text },
  txMeta: { fontSize: 12, color: t.textMuted, fontWeight: '500' },
  txStatus: { fontSize: 11, fontWeight: '700' },
  txPending: { color: '#0284c7' },
  txSuccess: { color: '#16a34a' },
  txCancelled: { color: '#dc2626' },
  txFailed: { color: '#dc2626' },
  txAmount: { fontSize: 14, fontWeight: '800' },
  txAmountPlus: { color: t.primary },
  txAmountMinus: { color: t.danger },
});
