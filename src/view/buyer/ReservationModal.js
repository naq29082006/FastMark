import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { createBuyerReservationOnBackend } from '../../api/buyerOpsApi';
import { formatPrice } from '../../core/utils/productFormat';
import { formatPickupInputs, parsePickupInputs } from '../../core/utils/pickupDateTime';
import SelectedVariantCard from './SelectedVariantCard';
import QuantityStepper from './QuantityStepper';
import DatePickerField from '../shared/components/DatePickerField';
import TimePickerField from '../shared/components/TimePickerField';

function buildDefaultPickupDate() {
  const d = new Date();
  d.setTime(d.getTime() + 2 * 60 * 60 * 1000);
  return d;
}

function addHoursFromNow(hours) {
  const date = new Date();
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date;
}

export default function ReservationModal({
  visible,
  loading = false,
  product,
  store,
  preselectedVariantId = null,
  initialQuantity = 1,
  onClose,
  onSuccess,
}) {
  const insets = useSafeAreaInsets();
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
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVariant = variants.find((v) => String(v.id) === String(selectedVariantId));
  const maxQty = Math.max(0, Number(selectedVariant?.quantity) || 0);
  const qtyNum = Number(quantity) || 0;
  const unitPrice = selectedVariant?.price ?? 0;
  const totalAmount = unitPrice * qtyNum;
  const depositPercent = Math.max(0, Math.min(100, Number(store?.depositPercent) || 0));
  const allowReserve = store?.allowReserve !== false;
  const depositAmount =
    allowReserve && depositPercent > 0
      ? Math.round((unitPrice * qtyNum * depositPercent) / 100)
      : 0;
  const pickupTime = parsePickupInputs(dateInput, timeInput);

  const pickupOptions = useMemo(
    () =>
      [1, 2, 5, 12, 24].map((hours) => ({
        label: `Sau ${hours}h`,
        value: addHoursFromNow(hours),
      })),
    []
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedVariantId(preselectedVariantId || variants[0]?.id || null);
    const seedQty = Math.max(1, Math.floor(Number(initialQuantity) || 1));
    setQuantity(seedQty);
    setNote('');
    setError('');
    const defaults = formatPickupInputs(buildDefaultPickupDate());
    setDateInput(defaults.dateInput);
    setTimeInput(defaults.timeInput);
  }, [visible, variants, preselectedVariantId, initialQuantity]);

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

  function applyPickupDate(date) {
    const formatted = formatPickupInputs(date);
    setDateInput(formatted.dateInput);
    setTimeInput(formatted.timeInput);
  }

  function validateForm() {
    if (!allowReserve) {
      return 'Cửa hàng không nhận giữ hàng.';
    }
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

  async function handleSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const reservation = await createBuyerReservationOnBackend({
        idToken,
        productId: product.id,
        variantId: selectedVariant.id,
        quantity: qtyNum,
        pickupTime: pickupTime.toISOString(),
        note: note.trim(),
      });
      onSuccess?.(reservation);
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || 'Không gửi được yêu cầu giữ hàng.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!visible) {
    return null;
  }

  if (loading) {
    return (
      <Modal visible animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, styles.loadingSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.handle} />
            <ActivityIndicator size="large" color="#076F32" />
            <Text style={styles.loadingText}>Đang tải sản phẩm...</Text>
            <Pressable style={[styles.cancelBtn, styles.loadingCancelBtn]} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Huỷ</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.titleIcon}>📦</Text>
            <View>
              <Text style={styles.title}>Yêu cầu giữ hàng</Text>
              <Text style={styles.subtitle}>{product?.name || product?.productName}</Text>
            </View>
          </View>
          {store?.name ? <Text style={styles.shopName}>🏪 {store.name}</Text> : null}

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {!hasPresetVariant ? (
              <>
                <Text style={styles.label}>Chọn biến thể</Text>
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
                {selectedVariant ? (
                  <SelectedVariantCard
                    variant={selectedVariant}
                    productThumbnail={product?.thumbnail || ''}
                  />
                ) : null}
              </>
            ) : null}

            {hasPresetVariant && selectedVariant ? (
              <SelectedVariantCard
                variant={selectedVariant}
                productThumbnail={product?.thumbnail || ''}
              />
            ) : null}

            {selectedVariant && qtyNum > 0 ? (
              <Text style={styles.totalUnderVariant}>Tổng: {formatPrice(totalAmount)}</Text>
            ) : null}

            {!allowReserve ? (
              <Text style={styles.depositWarn}>Cửa hàng hiện không nhận giữ hàng.</Text>
            ) : depositAmount > 0 ? (
              <View style={styles.depositBox}>
                <Text style={styles.depositTitle}>
                  Đặt cọc {depositPercent}%: {formatPrice(depositAmount)}
                </Text>
                <Text style={styles.depositHint}>
                  Số tiền sẽ trừ từ Ví FastMark khi gửi yêu cầu. Hủy khi đang chờ duyệt sẽ được hoàn
                  cọc.
                </Text>
              </View>
            ) : (
              <Text style={styles.depositHint}>Shop không yêu cầu đặt cọc.</Text>
            )}

            <Text style={styles.label}>Số lượng</Text>
            <QuantityStepper
              value={qtyNum}
              max={maxQty}
              onChange={(next) => {
                setQuantity(next);
                setError('');
              }}
            />

            <Text style={styles.label}>Giờ nhận hàng</Text>
            <View style={styles.datetimeRow}>
              <DatePickerField
                label="Ngày"
                value={dateInput}
                onChange={setDateInput}
                minimumDate={new Date()}
              />
              <TimePickerField
                label="Giờ"
                value={timeInput}
                onChange={setTimeInput}
              />
            </View>

            {pickupTime ? (
              <Text style={styles.selectedTime}>
                Đã chọn:{' '}
                {pickupTime.toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}

            <Text style={styles.suggestLabel}>Gợi ý nhanh</Text>
            <View style={styles.timeRow}>
              {pickupOptions.map((option) => {
                const formatted = formatPickupInputs(option.value);
                const isActive =
                  dateInput === formatted.dateInput && timeInput === formatted.timeInput;
                return (
                  <Pressable
                    key={option.label}
                    style={[styles.timeChip, isActive && styles.timeChipActive]}
                    onPress={() => applyPickupDate(option.value)}
                  >
                    <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Ghi chú (tuỳ chọn)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Yêu cầu đóng gói, ghi chú thêm..."
              placeholderTextColor="#94a3b8"
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
  },
  loadingSheet: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  loadingCancelBtn: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  shopName: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  scroll: {
    marginTop: 16,
    maxHeight: 420,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  suggestLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 8,
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
    gap: 10,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  timeChipActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeChipTextActive: {
    color: '#076F32',
  },
  selectedTime: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#076F32',
  },
  totalUnderVariant: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '900',
    color: '#076F32',
  },
  depositBox: {
    backgroundColor: '#E6F4EC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  depositTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#076F32',
  },
  depositHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
    marginBottom: 8,
  },
  depositWarn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 8,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
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
