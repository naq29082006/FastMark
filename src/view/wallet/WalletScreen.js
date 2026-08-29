import { memo, useCallback, useEffect, useState } from 'react';
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
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { loadWalletViewModel } from '../../viewmodel/wallet/walletViewModel';
import { isSameData, mergeListById } from '../../core/utils/realtimeList';
import { showErrorAlert } from '../../core/utils/appAlert';
import WalletTransactionDetailScreen from './WalletTransactionDetailScreen';
import WalletTransactionRow from './WalletTransactionRow';

export default function WalletScreen({
  onBack,
  onTopUp,
  onWithdraw,
  onSeeAllTransactions,
  canWithdraw = true,
  canTopUp = true,
}) {
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await loadWalletViewModel();
      const nextWallet = data.wallet;
      setWallet((current) => {
        if (
          Number(current?.balance) === Number(nextWallet?.balance) &&
          isSameData(current, nextWallet)
        ) {
          return current;
        }
        return nextWallet;
      });
      setTransactions((current) => mergeListById(current, data.transactions || []));
    } catch (err) {
      if (!silent) {
        showErrorAlert(err.message || 'Không tải được ví.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (selectedTransaction) {
    return (
      <WalletTransactionDetailScreen
        transactionId={selectedTransaction.id}
        initialTransaction={selectedTransaction}
        onBack={() => setSelectedTransaction(null)}
      />
    );
  }

  const showTopUp = canTopUp && Boolean(onTopUp);
  const showWithdraw = canWithdraw && Boolean(onWithdraw);

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Ví FastMark" onBack={onBack} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
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
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Tổng số dư</Text>
            <Text style={styles.balanceValue}>{formatPrice(wallet.balance)}</Text>
            <View
              style={[
                styles.actionRow,
                showTopUp && showWithdraw ? styles.actionRowSpread : styles.actionRowStart,
              ]}
            >
              {showTopUp ? (
              <Pressable style={styles.actionItem} onPress={onTopUp}>
                <View style={styles.actionBtn}>
                  <Ionicons name="add" size={22} color={t.primaryDark} />
                </View>
                <Text style={styles.actionLabel}>Nạp tiền</Text>
              </Pressable>
              ) : null}
              {showWithdraw ? (
              <Pressable
                style={styles.actionItem}
                onPress={() => {
                  onWithdraw();
                }}
              >
                <View style={styles.actionBtn}>
                  <Ionicons name="remove" size={22} color={t.primaryDark} />
                </View>
                <Text style={styles.actionLabel}>Rút tiền</Text>
              </Pressable>
              ) : null}
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
              transactions
                .slice(0, 8)
                .map((item) => (
                  <WalletTransactionRow
                    key={item.id}
                    item={item}
                    onPress={setSelectedTransaction}
                  />
                ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
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
  actionRow: { flexDirection: 'row' },
  actionRowSpread: { justifyContent: 'space-around' },
  actionRowStart: { justifyContent: 'flex-start', gap: 28 },
  actionItem: { alignItems: 'center', gap: 8 },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
});
