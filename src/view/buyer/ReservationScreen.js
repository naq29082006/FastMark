import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import {
  createReservationViewModel,
  loadReservationWalletViewModel,
} from '../../viewmodel/buyer/reservationViewModel';
import { saveReservationResume, clearReservationResume } from '../../viewmodel/buyer/reservationResumeSession';
import { requestWalletTopUp } from '../wallet/walletTopUpBridge';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import { formatPrice, getPromotionalUnitPrice } from '../../core/utils/productFormat';
import { showErrorAlert } from '../../core/utils/appAlert';
import { formatPickupInputs, parsePickupInputs } from '../../core/utils/pickupDateTime';
import SelectedVariantCard from './SelectedVariantCard';
import QuantityStepper from './QuantityStepper';
import DatePickerField from '../shared/components/DatePickerField';
import TimePickerField from '../shared/components/TimePickerField';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';

function buildDefaultPickupDate() {
  const d = new Date();
  d.setTime(d.getTime() + 2 * 60 * 60 * 1000);
  return d;
}

function SectionDivider() {
  return <View style={styles.divider} />;
}

export default function ReservationScreen({
  loading = false,
  loadError = null,
  product,
  store,
  preselectedVariantId = null,
  initialQuantity = 1,
  initialFormResume = null,
  onBack,
  onSuccess,
  onOpenTopUp,
  /** map | products | profile | orders */
  resumeSource = 'products',
  resumeStoreId = null,
}) {
  const profile = useSelector(selectAuthProfile);
  const hasPresetVariant = Boolean(preselectedVariantId);
  const variants = useMemo(() => {
    const list = product?.variants || [];
    const inStock = list.filter((v) => (v.quantity ?? 0) > 0);
    if (hasPresetVariant && preselectedVariantId) {
      const preset = list.find((v) => String(v.id) === String(preselectedVariantId));
      if (preset) {
        const others = inStock.filter((v) => String(v.id) !== String(preselectedVariantId));
        return [preset, ...others];
      }
    }
    if (inStock.length > 0) {
      return inStock;
    }
    if (!product?.id) {
      return [];
    }
    return [
      {
        id: product.id,
        variantName: product.name || product.productName || 'Mặc định',
        price: product.minPrice ?? product.price ?? 0,
        quantity: product.isOutOfStock ? 0 : 99,
        soldCount: product.soldCount || 0,
        images: [],
      },
    ];
  }, [product, hasPresetVariant, preselectedVariantId]);

  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);

  const selectedVariant = variants.find((v) => String(v.id) === String(selectedVariantId));
  const maxQty = Math.max(0, Number(selectedVariant?.quantity) || 0);
  const qtyNum = Number(quantity) || 0;
  const unitPrice = getPromotionalUnitPrice(product, selectedVariant?.price ?? 0);
  const totalAmount = unitPrice * qtyNum;
  const depositPercent = Math.max(0, Math.min(100, Number(store?.depositPercent) || 0));
  const depositAmount =
    depositPercent > 0 ? Math.round((unitPrice * qtyNum * depositPercent) / 100) : 0;
  const cashDue = Math.max(0, totalAmount - depositAmount);
  const pickupTime = parsePickupInputs(dateInput, timeInput);
  const needsTopUp =
    depositAmount > 0 &&
    walletBalance != null &&
    Number(walletBalance) < depositAmount;

  useEffect(() => {
    let cancelled = false;

    if (initialFormResume?.fromTopUp) {
      if (initialFormResume.variantId) {
        setSelectedVariantId(String(initialFormResume.variantId));
      } else {
        setSelectedVariantId(preselectedVariantId || variants[0]?.id || null);
      }
      setQuantity(Math.max(1, Number(initialFormResume.quantity) || Number(initialQuantity) || 1));
      setDateInput(initialFormResume.dateInput || '');
      setTimeInput(initialFormResume.timeInput || '');
      setNote(initialFormResume.note || '');
    } else {
      setSelectedVariantId(preselectedVariantId || variants[0]?.id || null);
      const seedQty = Math.max(1, Math.floor(Number(initialQuantity) || 1));
      setQuantity(seedQty);
      setNote('');
      const defaults = formatPickupInputs(buildDefaultPickupDate());
      setDateInput(defaults.dateInput);
      setTimeInput(defaults.timeInput);
    }

    loadReservationWalletViewModel()
      .then((result) => {
        if (!cancelled) {
          setWalletBalance(result.balance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWalletBalance(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [variants, preselectedVariantId, initialQuantity, initialFormResume]);

  useEffect(() => {
    const balance = Number(profile?.walletBalance);
    if (Number.isFinite(balance)) {
      setWalletBalance(balance);
    }
  }, [profile?.walletBalance]);

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }
    const stock = Math.max(0, Number(selectedVariant.quantity) || 0);
    setQuantity((prev) => {
      if (stock <= 0) {
        return 0;
      }
      return Math.max(1, Math.min(Number(prev) || 1, stock));
    });
  }, [selectedVariantId, selectedVariant?.quantity]);

  function validateForm() {
    if (!selectedVariant) {
      return 'Vui lòng chọn biến thể sản phẩm.';
    }
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      return 'Số lượng không hợp lệ.';
    }
    if (qtyNum > (selectedVariant.quantity ?? 0)) {
      return `Chỉ còn ${selectedVariant.quantity} sản phẩm trong kho.`;
    }
    if (!pickupTime) {
      return 'Vui lòng nhập ngày (DD/MM/YYYY) và giờ (HH:mm) hợp lệ.';
    }
    if (pickupTime.getTime() <= Date.now()) {
      return 'Thời gian nhận hàng phải ở tương lai.';
    }
    return '';
  }

  function handleOpenTopUp() {
    const normalizedProductId = String(product?.id || product?._id || '').trim();
    const resumePayload = {
      productId: normalizedProductId || null,
      variantId: selectedVariant?.id,
      quantity: qtyNum,
      source: resumeSource || 'products',
      storeId:
        resumeStoreId ||
        store?.id ||
        store?.shopId ||
        product?.shopId ||
        null,
      dateInput,
      timeInput,
      note: note.trim(),
    };
    requestWalletTopUp(resumePayload);
    if (resumeSource === 'map') {
      onBack?.();
    }
    void saveReservationResume(resumePayload).catch(() => {});
  }

  async function handleSubmit() {
    const validationError = validateForm();
    if (validationError) {
      showErrorAlert(validationError);
      return;
    }
    if (needsTopUp) {
      showErrorAlert(
        `Số dư ví không đủ cọc ${formatPrice(depositAmount)}. Hiện có ${formatPrice(walletBalance)}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const reservation = await createReservationViewModel({
        productId: product.id,
        variantId: selectedVariant.id,
        quantity: qtyNum,
        pickupTime: pickupTime.toISOString(),
        note: note.trim(),
      });
      await clearReservationResume();
      onSuccess?.(reservation);
      onBack?.();
    } catch (submitError) {
      const message = submitError.message || 'Không gửi được yêu cầu giữ hàng.';
      showErrorAlert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Yêu cầu giữ hàng" onBack={onBack} />
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color="#076F32" />
          <Text style={styles.loadingText}>Đang tải sản phẩm...</Text>
        </View>
      </View>
    );
  }

  if (!product || loadError) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Yêu cầu giữ hàng" onBack={onBack} />
        <View style={styles.loadingBody}>
          <Text style={styles.errorText}>
            {loadError || 'Không tải được thông tin sản phẩm. Vui lòng thử lại.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Yêu cầu giữ hàng" onBack={onBack} />
      <View style={styles.body}>
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.formCard}>
              {!hasPresetVariant ? (
                <View style={styles.formSection}>
                  <Text style={styles.sectionLabel}>Chọn phân loại</Text>
                  {variants.map((variant) => {
                    const isActive = String(variant.id) === String(selectedVariantId);
                    return (
                      <Pressable
                        key={variant.id}
                        style={[styles.variantChip, isActive && styles.variantChipActive]}
                        onPress={() => setSelectedVariantId(variant.id)}
                      >
                        <Text style={[styles.variantText, isActive && styles.variantTextActive]}>
                          {variant.name || variant.variantName} — {formatPrice(variant.price)} (còn{' '}
                          {variant.quantity})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {selectedVariant ? (
                <>
                  {!hasPresetVariant ? <SectionDivider /> : null}
                  <View style={styles.formSection}>
                    <Text style={styles.sectionLabel}>Phân loại đã chọn</Text>
                    <SelectedVariantCard
                      variant={selectedVariant}
                      productThumbnail={product?.thumbnail || ''}
                      label={null}
                      priceOverride={unitPrice}
                      quantity={qtyNum > 0 ? qtyNum : null}
                      embedded
                    />
                  </View>

                  <SectionDivider />

                  <View style={styles.formSection}>
                    <View style={styles.quantityRow}>
                      <Text style={styles.quantityLabel}>Số lượng:</Text>
                      <QuantityStepper
                        compact
                        value={qtyNum}
                        max={maxQty}
                        onChange={(next) => {
                          setQuantity(next);
                        }}
                      />
                    </View>
                  </View>

                  {qtyNum > 0 ? (
                    <>
                      <SectionDivider />
                      <View style={styles.formSection}>
                      <Text style={styles.sectionLabel}>Chi tiết thanh toán</Text>
                      <View style={styles.summaryBlock}>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Tổng tiền:</Text>
                            <Text style={styles.summaryValue}>{formatPrice(totalAmount)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Đặt cọc {depositPercent}%:</Text>
                            <Text style={styles.summaryDeposit}>{formatPrice(depositAmount)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Phải trả khi nhận hàng:</Text>
                            <Text style={styles.summaryCashDue}>{formatPrice(cashDue)}</Text>
                          </View>
                        </View>
                      </View>
                    </>
                  ) : null}

                  <SectionDivider />

                  <View style={styles.formSection}>
                    <View style={styles.walletBalanceRow}>
                      <View style={styles.walletBalanceLeading}>
                        <Text style={styles.quantityLabel}>Số dư ví:</Text>
                        <Text style={styles.walletBalanceValue}>
                          {walletBalance != null
                            ? formatPrice(walletBalance)
                            : 'Đang tải...'}
                        </Text>
                      </View>
                      <Pressable style={styles.topUpBtn} onPress={handleOpenTopUp}>
                        <Text style={styles.topUpBtnText}>
                          {needsTopUp ? 'Nạp tiền' : 'Nạp thêm'}
                        </Text>
                      </Pressable>
                    </View>
                    {depositAmount > 0 && needsTopUp ? (
                      <Text style={styles.depositWarning}>
                        Cần thêm {formatPrice(depositAmount - Number(walletBalance))} để đặt cọc
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : null}

              {selectedVariant || !hasPresetVariant ? <SectionDivider /> : null}

              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Giờ nhận hàng</Text>
                <View style={styles.datetimeRow}>
                  <TimePickerField
                    compact
                    label="Giờ"
                    value={timeInput}
                    onChange={setTimeInput}
                  />
                  <DatePickerField
                    label="Ngày"
                    value={dateInput}
                    onChange={setDateInput}
                    minimumDate={new Date()}
                  />
                </View>
                {pickupTime ? (
                  <View style={styles.selectedPickupBlock}>
                    <Text style={styles.sectionLabel}>Đã chọn giờ nhận:</Text>
                    <View style={styles.selectedPickupRow}>
                      <Ionicons name="time-outline" size={18} color="#64748b" />
                      <Text style={styles.selectedPickupText}>
                        Giờ:{' '}
                        <Text style={styles.selectedPickupValue}>{timeInput || '—'}</Text>
                        {' · '}
                        Ngày:{' '}
                        <Text style={styles.selectedPickupValue}>{dateInput || '—'}</Text>
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <SectionDivider />

              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Ghi chú</Text>
                <KeyboardAwareTextInput
                  style={[styles.input, styles.noteInput]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder="Yêu cầu đóng gói, ghi chú thêm..."
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onBack} disabled={isSubmitting}>
                  <Text style={styles.cancelBtnText}>Huỷ</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                  disabled={isSubmitting}
                  onPress={handleSubmit}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Gửi yêu cầu</Text>
                  )}
                </Pressable>
              </View>
            </View>
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  body: {
    flex: 1,
  },
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  walletBalanceLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  walletBalanceValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#076F32',
  },
  depositWarning: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  topUpBtn: {
    backgroundColor: '#076F32',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  topUpBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formSection: {
    gap: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  variantChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  variantChipActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  variantText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  variantTextActive: {
    color: '#076F32',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  datetimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  selectedPickupBlock: {
    marginTop: 10,
    gap: 8,
  },
  selectedPickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedPickupText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 20,
  },
  selectedPickupValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryBlock: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  summaryDeposit: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  summaryCashDue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#dc2626',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  submitBtn: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
