import { StyleSheet, Text, View } from 'react-native';

import { formatPrice } from '../../../core/utils/productFormat';
import { normalizeWalletTransaction, WALLET_TX_STATUS } from '../../../model/walletModel';

function formatTxTime(iso) {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReservationWalletHistorySection({ reservation }) {
  const raw = Array.isArray(reservation?.walletTransactions) ? reservation.walletTransactions : [];
  const rows = raw
    .map((item) => normalizeWalletTransaction(item))
    .filter((item) => item.status === WALLET_TX_STATUS.SUCCESS);

  if (!rows.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Lịch sử giao dịch</Text>
      {rows.map((item) => {
        const sign = item.isCredit ? '+' : '−';
        const amountColor = item.isCredit ? '#076F32' : '#0f172a';
        return (
          <View key={item.id || `${item.type}-${item.createdAt}`} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.typeLabel}>{item.typeLabel}</Text>
              <Text style={[styles.amount, { color: amountColor }]}>
                {sign}
                {formatPrice(item.amount)}
              </Text>
            </View>
            {item.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.time}>{formatTxTime(item.createdAt)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 4,
  },
  heading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  typeLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  amount: {
    fontSize: 14,
    fontWeight: '900',
  },
  description: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 17,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
});
