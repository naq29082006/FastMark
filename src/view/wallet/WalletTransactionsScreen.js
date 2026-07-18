import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

export default function WalletTransactionsScreen({ onBack }) {
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await loadWalletViewModel();
      setTransactions(data.transactions || []);
    } catch {
      setTransactions([]);
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
        <Text style={styles.headerTitle}>Lịch sử giao dịch</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Chưa có giao dịch.</Text>}
          renderItem={({ item }) => {
            const isCredit = item.isCredit;
            return (
              <View style={styles.row}>
                <View style={[styles.icon, isCredit ? styles.iconPlus : styles.iconMinus]}>
                  <Ionicons
                    name={isCredit ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={isCredit ? t.primary : t.danger}
                  />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.description || item.typeLabel}
                  </Text>
                  <Text style={styles.meta}>{formatTxTime(item.createdAt)}</Text>
                  {item.status === WALLET_TX_STATUS.PENDING ? (
                    <Text style={styles.pending}>Đang chờ</Text>
                  ) : null}
                </View>
                <Text style={[styles.amount, isCredit ? styles.plus : styles.minus]}>
                  {isCredit ? '+' : '-'}
                  {formatPrice(item.amount)}
                </Text>
              </View>
            );
          }}
        />
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
    color: t.text,
  },
  headerSpacer: { width: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: t.textMuted, marginTop: 40, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlus: { backgroundColor: t.primarySoft },
  iconMinus: { backgroundColor: t.dangerSoft },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: t.text },
  meta: { fontSize: 12, color: t.textMuted },
  pending: { fontSize: 11, color: '#d97706', fontWeight: '700' },
  amount: { fontSize: 14, fontWeight: '800' },
  plus: { color: t.primary },
  minus: { color: t.danger },
});
