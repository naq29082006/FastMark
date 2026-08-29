import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { formatPrice } from '../../core/utils/productFormat';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { mergeListById } from '../../core/utils/realtimeList';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import { selectIsSeller } from '../../viewmodel/auth/authSelectors';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';
import PlanTabPanel from '../shared/components/PlanTabPanel';
import {
  createWithdrawViewModel,
  loadMyWithdrawsViewModel,
  loadWithdrawBanksViewModel,
} from '../../viewmodel/wallet/withdrawViewModel';

const WITHDRAW_SCREEN_TABS = [
  { key: 'withdraw', label: 'Rút tiền' },
  { key: 'history', label: 'Lịch sử rút' },
];

const MIN_WITHDRAW = 50000;

const STATUS_LABEL = {
  0: 'Chờ duyệt',
  1: 'Đã duyệt',
  2: 'Từ chối',
};

function formatWithdrawTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function WithdrawDetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {String(value)}
      </Text>
    </View>
  );
}

export default function WithdrawScreen({ balance = 0, onBack, onSuccess }) {
  const isSeller = useSelector(selectIsSeller);
  const [banks, setBanks] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [selectedWithdraw, setSelectedWithdraw] = useState(null);
  const [amountText, setAmountText] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNameNotice, setAccountNameNotice] = useState('');
  const [screenTab, setScreenTab] = useState('withdraw');
  const [historyLoading, setHistoryLoading] = useState(false);

  const amount = useMemo(
    () => Math.round(Number(String(amountText).replace(/\D/g, '')) || 0),
    [amountText]
  );

  const selectedBank = useMemo(
    () => banks.find((bank) => String(bank.id) === String(selectedBankId)) || null,
    [banks, selectedBankId]
  );

  const load = useCallback(async ({ nextPage = 1, silent = false, banksOnly = false } = {}) => {
    if (!silent) {
      if (banksOnly) {
        setLoading(true);
      } else if (nextPage === 1) {
        setHistoryLoading(true);
      } else {
        setLoadingMore(true);
      }
    }
    try {
      if (banksOnly) {
        const bankPayload = await loadWithdrawBanksViewModel();
        const bankRows = bankPayload?.banks || [];
        setBanks(Array.isArray(bankRows) ? bankRows : []);
        const profile = bankPayload?.withdrawProfile;
        if (profile) {
          setAccountName(String(profile.accountName || '').trim());
          setAccountNameNotice(String(profile.accountNameNotice || '').trim());
        }
        setSelectedBankId((current) => {
          if (current) return current;
          return bankRows?.[0]?.id ? String(bankRows[0].id) : '';
        });
        return;
      }

      const withdrawPage = await loadMyWithdrawsViewModel({
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const withdrawRows =
        withdrawPage?.items || (Array.isArray(withdrawPage) ? withdrawPage : []);
      setWithdraws((current) =>
        nextPage === 1
          ? mergeListById(current, withdrawRows)
          : appendUniqueById(current, withdrawRows)
      );
      setPage(Number(withdrawPage?.page) || nextPage);
      setHasMore(Boolean(withdrawPage?.hasMore));
      setTotalCount(Math.max(0, Number(withdrawPage?.total) || 0));
    } catch (error) {
      if (silent) {
        return;
      }
      Alert.alert('Lỗi', error.message || 'Không tải được dữ liệu rút tiền.');
      if (banksOnly) {
        setBanks([]);
      } else if (nextPage === 1) {
        setWithdraws([]);
        setHasMore(false);
        setTotalCount(0);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setHistoryLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    load({ banksOnly: true });
  }, [load]);

  useEffect(() => {
    if (isSeller) {
      return;
    }
    Alert.alert(
      'Thông báo',
      'Chỉ tài khoản người bán mới được rút tiền. Người mua chỉ có thể nạp tiền vào ví.',
      [{ text: 'OK', onPress: () => onBack?.() }]
    );
  }, [isSeller, onBack]);

  useEffect(() => {
    if (screenTab !== 'history') {
      return;
    }
    load({ nextPage: 1 });
  }, [screenTab, load]);

  const handleWithdrawRealtime = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim();
      if (type !== 'withdraw' && type !== 'wallet') {
        return;
      }
      if (screenTab === 'history') {
        load({ nextPage: 1, silent: true });
      }
    },
    [load, screenTab]
  );

  useResourceSocket({
    enabled: true,
    onResourceUpdated: handleWithdrawRealtime,
  });

  async function handleSubmit() {
    if (submitting) return;
    if (!selectedBankId) {
      Alert.alert('Thiếu ngân hàng', 'Admin chưa bật ngân hàng nào hoặc bạn chưa chọn.');
      return;
    }
    if (amount < MIN_WITHDRAW) {
      Alert.alert('Số tiền không hợp lệ', `Tối thiểu ${formatPrice(MIN_WITHDRAW)}.`);
      return;
    }
    if (amount > Number(balance || 0)) {
      Alert.alert('Số dư không đủ', `Số dư hiện tại: ${formatPrice(balance)}.`);
      return;
    }
    if (!/^\d{6,20}$/.test(String(accountNumber).replace(/\s/g, ''))) {
      Alert.alert('STK không hợp lệ', 'Số tài khoản gồm 6–20 chữ số.');
      return;
    }
    if (!accountName || !String(accountName).trim()) {
      Alert.alert(
        'Thiếu thông tin',
        'Không tải được họ tên CCCD đã duyệt. Vui lòng thử tải lại hoặc liên hệ hỗ trợ.'
      );
      return;
    }

    Alert.alert(
      'Xác nhận rút tiền',
      `Rút ${formatPrice(amount)} về ngân hàng đã chọn? Tiền sẽ tạm giữ đến khi admin duyệt.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi yêu cầu',
          onPress: async () => {
            setSubmitting(true);
            try {
              const result = await createWithdrawViewModel({
                bankId: selectedBankId,
                amount,
                accountNumber: String(accountNumber).replace(/\s/g, ''),
                accountName: String(accountName).trim().toUpperCase(),
              });
              Alert.alert('Đã gửi', 'Yêu cầu rút tiền đang chờ admin duyệt.');
              onSuccess?.(result);
              setAmountText('');
              setAccountNumber('');
              setScreenTab('history');
              await load({ nextPage: 1 });
            } catch (error) {
              Alert.alert('Không rút được', error.message || 'Vui lòng thử lại.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  function renderWithdrawHistoryList() {
    if (withdraws.length === 0) {
      return <Text style={styles.empty}>Chưa có yêu cầu rút tiền.</Text>;
    }
    return (
      <>
        {withdraws.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedWithdraw(item)}
            style={({ pressed }) => [
              styles.historyCard,
              pressed && styles.historyCardPressed,
            ]}
          >
            <View style={styles.historyTop}>
              <Text style={styles.historyAmount}>{formatPrice(item.amount)}</Text>
              <View style={styles.historyTopRight}>
                <Text
                  style={[
                    styles.historyStatus,
                    item.status === 1 && styles.statusOk,
                    item.status === 2 && styles.statusBad,
                  ]}
                >
                  {item.statusLabel || STATUS_LABEL[item.status] || '—'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </View>
            </View>
            <Text style={styles.historyMeta}>
              {item.bankName} · {item.accountNumber}
            </Text>
            {item.accountName ? (
              <Text style={styles.historyMeta}>{item.accountName}</Text>
            ) : null}
            {item.adminNote ? (
              <Text style={styles.historyNote}>Ghi chú: {item.adminNote}</Text>
            ) : null}
          </Pressable>
        ))}
        <LoadMoreButton
          currentCount={withdraws.length}
          totalCount={
            hasMore
              ? Math.max(totalCount, withdraws.length + DEFAULT_PAGE_SIZE)
              : withdraws.length
          }
          loading={loadingMore}
          onPress={() => load({ nextPage: page + 1 })}
        />
      </>
    );
  }

  if (!isSeller) {
    return null;
  }

  return (
    <View style={styles.screen}>
      {selectedWithdraw ? (
        <>
          <SubScreenHeader
            title="Chi tiết rút tiền"
            onBack={() => setSelectedWithdraw(null)}
          />
          <KeyboardAwareScrollView contentContainerStyle={styles.content}>
            <View style={styles.detailSummary}>
              <Text style={styles.detailSummaryLabel}>Số tiền rút</Text>
              <Text style={styles.detailSummaryAmount}>
                {formatPrice(selectedWithdraw.amount || 0)}
              </Text>
              <Text
                style={[
                  styles.detailSummaryStatus,
                  selectedWithdraw.status === 1 && styles.statusOk,
                  selectedWithdraw.status === 2 && styles.statusBad,
                ]}
              >
                {selectedWithdraw.statusLabel ||
                  STATUS_LABEL[selectedWithdraw.status] ||
                  '—'}
              </Text>
            </View>

            <View style={styles.detailCard}>
              <WithdrawDetailRow label="Ngân hàng" value={selectedWithdraw.bankName} />
              <WithdrawDetailRow label="Mã ngân hàng" value={selectedWithdraw.bankCode} />
              <WithdrawDetailRow
                label="Số tài khoản"
                value={selectedWithdraw.accountNumber}
              />
              <WithdrawDetailRow
                label="Tên chủ tài khoản"
                value={selectedWithdraw.accountName}
              />
              <WithdrawDetailRow
                label="Mã yêu cầu"
                value={selectedWithdraw.id}
              />
              <WithdrawDetailRow
                label="ID giao dịch ví"
                value={selectedWithdraw.gdViId}
              />
              <WithdrawDetailRow
                label="Ghi chú admin"
                value={selectedWithdraw.adminNote}
              />
              <WithdrawDetailRow
                label="Thời gian tạo"
                value={formatWithdrawTime(selectedWithdraw.createdAt)}
              />
              <WithdrawDetailRow
                label="Cập nhật lần cuối"
                value={formatWithdrawTime(selectedWithdraw.updatedAt)}
              />
              <WithdrawDetailRow
                label="Thời gian xử lý"
                value={formatWithdrawTime(selectedWithdraw.tgXuLy)}
              />
            </View>
          </KeyboardAwareScrollView>
        </>
      ) : (
        <>
          <SubScreenHeader title="Rút tiền" onBack={onBack} />

          <View style={styles.tabShell}>
            <PlanTabPanel
              tabs={WITHDRAW_SCREEN_TABS}
              activeTab={screenTab}
              onChangeTab={setScreenTab}
            >
              {screenTab === 'withdraw' ? (
                loading ? (
                  <View style={styles.tabLoading}>
                    <ActivityIndicator color={t.primary} size="large" />
                  </View>
                ) : (
                  <KeyboardAwareScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.tabContent}
                  >
                    <View style={styles.balanceCard}>
                      <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
                      <Text style={styles.balanceValue}>{formatPrice(balance)}</Text>
                    </View>

                    <Text style={styles.label}>Ngân hàng</Text>
                    {banks.length === 0 ? (
                      <Text style={styles.warn}>
                        Hiện chưa có ngân hàng nào được admin bật. Vui lòng thử lại sau.
                      </Text>
                    ) : (
                      <Pressable
                        style={styles.comboBox}
                        onPress={() => setBankPickerOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Chọn ngân hàng"
                      >
                        <View style={styles.comboBoxCopy}>
                          {selectedBank ? (
                            <>
                              <Text style={styles.comboBoxValue} numberOfLines={1}>
                                {selectedBank.name}
                              </Text>
                              <Text style={styles.comboBoxMeta} numberOfLines={1}>
                                {selectedBank.code}
                                {selectedBank.note ? ` · ${selectedBank.note}` : ''}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.comboBoxPlaceholder}>Chọn ngân hàng</Text>
                          )}
                        </View>
                        <Ionicons name="chevron-down" size={18} color="#64748b" />
                      </Pressable>
                    )}

                    <Text style={styles.label}>Số tiền rút (đ)</Text>
                    <KeyboardAwareTextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={amountText}
                      onChangeText={setAmountText}
                      placeholder={`Tối thiểu ${MIN_WITHDRAW.toLocaleString('vi-VN')}`}
                      placeholderTextColor="#94a3b8"
                    />

                    <Text style={styles.label}>Số tài khoản</Text>
                    <KeyboardAwareTextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      placeholder="Nhập số tài khoản"
                      placeholderTextColor="#94a3b8"
                    />

                    <Text style={styles.label}>Tên chủ tài khoản (theo CCCD)</Text>
                    {accountNameNotice ? (
                      <Text style={styles.nameNotice}>{accountNameNotice}</Text>
                    ) : null}
                    <View style={[styles.input, styles.inputReadonly]}>
                      <Text style={styles.readonlyName} selectable>
                        {accountName || '—'}
                      </Text>
                    </View>

                    <Pressable
                      style={[
                        styles.submitBtn,
                        (submitting || banks.length === 0 || !String(accountName).trim()) &&
                          styles.submitDisabled,
                      ]}
                      onPress={handleSubmit}
                      disabled={
                        submitting || banks.length === 0 || !String(accountName).trim()
                      }
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.submitText}>Gửi yêu cầu rút tiền</Text>
                          <Ionicons name="arrow-forward" size={18} color="#fff" />
                        </>
                      )}
                    </Pressable>
                  </KeyboardAwareScrollView>
                )
              ) : historyLoading ? (
                <View style={styles.tabLoading}>
                  <ActivityIndicator color={t.primary} size="large" />
                </View>
              ) : (
                <KeyboardAwareScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.historyTabContent}
                >
                  {renderWithdrawHistoryList()}
                </KeyboardAwareScrollView>
              )}
            </PlanTabPanel>
          </View>

          <Modal
            visible={bankPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setBankPickerOpen(false)}
          >
            <Pressable
              style={styles.comboOverlay}
              onPress={() => setBankPickerOpen(false)}
            >
              <Pressable style={styles.comboSheet} onPress={(e) => e.stopPropagation?.()}>
                <Text style={styles.comboSheetTitle}>Chọn ngân hàng</Text>
                <ScrollView
                  style={styles.comboSheetList}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {banks.map((bank) => {
                    const active = String(bank.id) === String(selectedBankId);
                    return (
                      <Pressable
                        key={bank.id}
                        onPress={() => {
                          setSelectedBankId(String(bank.id));
                          setBankPickerOpen(false);
                        }}
                        style={[styles.comboOption, active && styles.comboOptionActive]}
                      >
                        <View style={styles.comboOptionCopy}>
                          <Text
                            style={[
                              styles.comboOptionName,
                              active && styles.comboOptionNameActive,
                            ]}
                          >
                            {bank.name}
                          </Text>
                          <Text style={styles.comboOptionMeta}>
                            {bank.code}
                            {bank.note ? ` · ${bank.note}` : ''}
                          </Text>
                        </View>
                        {active ? (
                          <Ionicons name="checkmark" size={18} color={t.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 10 },
  tabShell: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabContent: { gap: 10, paddingBottom: 16 },
  historyTabContent: { gap: 10, paddingBottom: 24 },
  tabLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balanceCard: {
    backgroundColor: t.primaryDark,
    borderRadius: t.radiusLg,
    padding: 16,
    marginBottom: 6,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  balanceValue: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: t.text, marginTop: 8 },
  warn: { color: '#b91c1c', fontWeight: '600', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: t.textMuted, marginTop: 6 },
  comboBox: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  comboBoxCopy: {
    flex: 1,
    minWidth: 0,
  },
  comboBoxValue: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
  },
  comboBoxMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: t.textMuted,
  },
  comboBoxPlaceholder: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  comboOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  comboSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  comboSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: t.text,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  comboSheetList: {
    maxHeight: 360,
  },
  comboOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  comboOptionActive: {
    backgroundColor: '#f0fdf4',
  },
  comboOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  comboOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
  },
  comboOptionNameActive: {
    color: t.primaryDark,
  },
  comboOptionMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: t.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
    fontWeight: '600',
    color: t.text,
  },
  inputReadonly: {
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },
  readonlyName: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
    letterSpacing: 0.3,
  },
  nameNotice: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: t.textMuted,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: t.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  empty: { color: t.textMuted, fontWeight: '600' },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 12,
    gap: 4,
  },
  historyCardPressed: { opacity: 0.88 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTopRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyAmount: { fontSize: 15, fontWeight: '800', color: t.text },
  historyStatus: { fontSize: 12, fontWeight: '800', color: '#b45309' },
  statusOk: { color: '#15803d' },
  statusBad: { color: '#b91c1c' },
  historyMeta: { fontSize: 12, color: t.textMuted, fontWeight: '600' },
  historyNote: { fontSize: 12, color: '#64748b', marginTop: 2 },
  detailSummary: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailSummaryLabel: { fontSize: 13, fontWeight: '700', color: t.textMuted },
  detailSummaryAmount: { fontSize: 28, fontWeight: '900', color: t.text },
  detailSummaryStatus: { fontSize: 13, fontWeight: '800', color: '#b45309', marginTop: 2 },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
    gap: 6,
  },
  detailLabel: { fontSize: 12, fontWeight: '700', color: t.textMuted },
  detailValue: { fontSize: 15, fontWeight: '700', color: t.text },
});
