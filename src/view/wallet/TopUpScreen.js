import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { createTopupViewModel, syncTopupViewModel } from '../../viewmodel/wallet/walletViewModel';
import CircularBackButton from '../shared/components/CircularBackButton';

const PRESETS = [50000, 100000, 200000, 500000];

export default function TopUpScreen({ balance = 0, onBack, onSuccess }) {
  const insets = useScreenInsets();
  const [amount, setAmount] = useState(100000);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedAmount = useMemo(() => {
    const custom = Math.round(Number(String(customText).replace(/\D/g, '')));
    if (Number.isFinite(custom) && custom > 0) {
      return custom;
    }
    return amount;
  }, [amount, customText]);

  function selectPreset(value) {
    setAmount(value);
    setCustomText('');
  }

  async function handleConfirm() {
    if (submitting) {
      return;
    }
    if (!selectedAmount || selectedAmount < 10000) {
      Alert.alert('Số tiền không hợp lệ', 'Số tiền nạp tối thiểu là 10.000đ.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createTopupViewModel(selectedAmount);
      if (!result.checkoutUrl) {
        throw new Error('Không nhận được liên kết thanh toán PayOS.');
      }

      await WebBrowser.openBrowserAsync(result.checkoutUrl, {
        enableBarCollapsing: true,
        showTitle: true,
      });

      if (result.orderCode != null) {
        try {
          const synced = await syncTopupViewModel(result.orderCode);
          if (synced.transaction?.status === 1) {
            onSuccess?.({
              amount: synced.transaction.amount,
              orderCode: synced.transaction.orderCode,
              balance: synced.wallet?.balance,
            });
            return;
          }
        } catch {
          // Stay on screen; user can check history.
        }
      }

      Alert.alert(
        'Đã mở PayOS',
        'Nếu bạn đã thanh toán xong, số dư sẽ cập nhật sau vài giây. Vào lịch sử ví để kiểm tra.',
        [{ text: 'OK', onPress: () => onBack?.() }]
      );
    } catch (error) {
      Alert.alert('Không nạp được', error.message || 'Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.floatingTop }]}>
      <View style={styles.header}>
        <CircularBackButton onPress={onBack} />
        <Text style={styles.headerTitle}>Nạp tiền</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
          <Text style={styles.balanceValue}>{formatPrice(balance)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Chọn mệnh giá nạp</Text>
        <View style={styles.presetGrid}>
          {PRESETS.map((value) => {
            const active = !customText && amount === value;
            return (
              <Pressable
                key={value}
                onPress={() => selectPreset(value)}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>
                  {formatPrice(value)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="wallet-outline" size={18} color={t.textMuted} />
          <TextInput
            style={styles.input}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Nhập số tiền khác..."
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
          />
          <Text style={styles.inputSuffix}>VNĐ</Text>
        </View>

        <Text style={styles.sectionTitle}>Phương thức nạp</Text>
        <View style={[styles.methodCard, styles.methodCardActive]}>
          <View style={styles.methodIcon}>
            <Ionicons name="card-outline" size={20} color={t.primaryDark} />
          </View>
          <View style={styles.methodBody}>
            <Text style={styles.methodTitle}>Thanh toán PayOS</Text>
            <Text style={styles.methodSub}>ATM / Visa / QR trên cổng PayOS</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={t.primary} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottomSpacing, 12) }]}>
        <Pressable
          style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.confirmText}>
                Xác nhận nạp {formatPrice(selectedAmount || 0)}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
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
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  balanceCard: {
    backgroundColor: t.primaryDark,
    borderRadius: t.radiusLg,
    padding: 18,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  balanceValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: t.text, marginTop: 4 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetChip: {
    width: '48%',
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  presetChipActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  presetText: { fontSize: 15, fontWeight: '700', color: t.text },
  presetTextActive: { color: '#fff' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    backgroundColor: '#fff',
  },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: t.text },
  inputSuffix: { fontWeight: '700', color: t.textMuted },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
  },
  methodCardActive: {
    borderColor: t.primary,
    backgroundColor: '#f0fdf4',
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBody: { flex: 1, gap: 2 },
  methodTitle: { fontSize: 15, fontWeight: '800', color: t.text },
  methodSub: { fontSize: 12, fontWeight: '600', color: t.textMuted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: t.background,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  confirmBtn: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: t.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
