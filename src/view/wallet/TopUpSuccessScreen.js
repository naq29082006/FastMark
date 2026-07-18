import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

export default function TopUpSuccessScreen({
  amount = 0,
  orderCode = null,
  onBackHome,
  onViewHistory,
}) {
  const insets = useScreenInsets();
  const timeLabel = new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.floatingTop + 24 }]}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={40} color="#fff" />
      </View>
      <Text style={styles.title}>Thanh toán thành công!</Text>
      <Text style={styles.subtitle}>
        Số tiền đã được cộng vào Ví FastMark. Cảm ơn bạn đã tin tưởng Chợ Quê.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Chi tiết giao dịch</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Mã giao dịch</Text>
          <Text style={styles.value}>
            {orderCode != null ? `#${orderCode}` : '—'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Thời gian</Text>
          <Text style={styles.value}>{timeLabel}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Tổng tiền</Text>
          <Text style={[styles.value, styles.amount]}>{formatPrice(amount)}</Text>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottomSpacing, 16) }]}>
        <Pressable style={styles.primaryBtn} onPress={onBackHome}>
          <Text style={styles.primaryText}>Về ví FastMark</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onViewHistory}>
          <Text style={styles.secondaryText}>Xem lịch sử giao dịch</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.surface,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: t.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: t.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    width: '100%',
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: t.primary,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: t.text, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  divider: {
    borderStyle: 'dashed',
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  label: { fontSize: 13, color: t.textMuted, fontWeight: '600' },
  value: { fontSize: 14, color: t.text, fontWeight: '800' },
  amount: { color: t.price },
  actions: {
    width: '100%',
    marginTop: 'auto',
    gap: 10,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: t.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: t.primary, fontSize: 15, fontWeight: '800' },
});
