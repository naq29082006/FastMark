import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { WALLET_TX_STATUS } from '../../model/walletModel';
import { loadWalletViewModel } from '../../viewmodel/wallet/walletViewModel';
import CircularBackButton from '../shared/components/CircularBackButton';

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

function TransactionRow({ item }) {
  const isCredit = item.isCredit;
  const pending = item.status === WALLET_TX_STATUS.PENDING;

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
        <Ionicons
          name={isCredit ? 'card-outline' : 'bag-handle-outline'}
          size={18}
          color={isCredit ? t.primaryDark : '#2563eb'}
        />
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {item.description || item.typeLabel}
        </Text>
        <Text style={styles.txMeta}>{formatTxTime(item.createdAt)}</Text>
        {pending ? <Text style={styles.txPending}>Đang chờ thanh toán</Text> : null}
      </View>
      <Text style={[styles.txAmount, isCredit ? styles.txAmountPlus : styles.txAmountMinus]}>
        {isCredit ? '+' : '-'}
        {formatPrice(item.amount)}
      </Text>
    </View>
  );
}

export default function WalletScreen({ onBack, onTopUp, onSeeAllTransactions }) {
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await loadWalletViewModel();
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message || 'Không tải được ví.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.screen, { paddingTop: insets.floatingTop }]}>
      <View style={styles.header}>
        <CircularBackButton onPress={onBack} />
        <Text style={styles.headerTitle}>Ví FastMark</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={t.primary}
            />
          }
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Tổng số dư</Text>
            <Text style={styles.balanceValue}>{formatPrice(wallet.balance)}</Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.actionItem} onPress={onTopUp}>
                <View style={styles.actionBtn}>
                  <Ionicons name="add" size={22} color={t.primaryDark} />
                </View>
                <Text style={styles.actionLabel}>Nạp tiền</Text>
              </Pressable>
              <View style={[styles.actionItem, styles.actionDisabled]}>
                <View style={styles.actionBtn}>
                  <Ionicons name="remove" size={22} color="#94a3b8" />
                </View>
                <Text style={[styles.actionLabel, styles.actionLabelMuted]}>Rút tiền</Text>
              </View>
              <View style={[styles.actionItem, styles.actionDisabled]}>
                <View style={styles.actionBtn}>
                  <Ionicons name="qr-code-outline" size={20} color="#94a3b8" />
                </View>
                <Text style={[styles.actionLabel, styles.actionLabelMuted]}>Quét mã</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            <Pressable onPress={onSeeAllTransactions} hitSlop={8}>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </Pressable>
          </View>

          <View style={styles.txCard}>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch nào.</Text>
            ) : (
              transactions.slice(0, 8).map((item) => <TransactionRow key={item.id} item={item} />)
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: t.primaryDark,
  },
  headerSpacer: { width: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  errorText: { color: t.danger, fontWeight: '600' },
  balanceCard: {
    backgroundColor: t.primaryDark,
    borderRadius: t.radiusLg,
    padding: 20,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  balanceValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 20,
  },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionItem: { alignItems: 'center', gap: 8 },
  actionDisabled: { opacity: 0.7 },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionLabelMuted: { color: 'rgba(255,255,255,0.7)' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: t.text },
  seeAll: { fontSize: 13, fontWeight: '700', color: t.primary },
  txCard: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: t.radius,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: t.textMuted,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: t.primarySoft },
  txIconDebit: { backgroundColor: '#dbeafe' },
  txBody: { flex: 1, gap: 2 },
  txTitle: { fontSize: 14, fontWeight: '700', color: t.text },
  txMeta: { fontSize: 12, color: t.textMuted, fontWeight: '500' },
  txPending: { fontSize: 11, color: '#d97706', fontWeight: '700' },
  txAmount: { fontSize: 14, fontWeight: '800' },
  txAmountPlus: { color: t.primary },
  txAmountMinus: { color: t.danger },
});
