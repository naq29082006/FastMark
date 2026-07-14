import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  product,
  store,
  dealOfferId,
  agreedPrice,
  agreedTotal,
  lockedQuantity,
  preselectedVariantId = null,
  onClose,
  onSuccess,
}) {
  const insets = useSafeAreaInsets();
  const hasPresetVariant = Boolean(preselectedVariantId);
  const isFromDeal = Boolean(dealOfferId);
  const variants = useMemo(() => {
    const list = (product?.variants || []).filter((v) => (v.quantity ?? 0) > 0);
    if (list.length > 0) {
      return list;
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
      },
    ];
  }, [product]);

  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVariant = variants.find((v) => String(v.id) === String(selectedVariantId));
  const maxQty = Math.max(0, Number(selectedVariant?.quantity) || 0);
  const qtyNum = lockedQuantity != null ? Number(lockedQuantity) || 0 : Number(quantity) || 0;
  const dealTotal =
    agreedTotal != null
      ? Number(agreedTotal) || 0
      : agreedPrice != null
        ? (Number(agreedPrice) || 0) * (qtyNum || 1)
        : 0;
  const unitPrice = isFromDeal
    ? qtyNum > 0
      ? Math.round(dealTotal / qtyNum)
      : 0
    : agreedPrice ?? selectedVariant?.price ?? 0;
  const totalAmount = isFromDeal ? dealTotal : unitPrice * qtyNum;
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
    setQuantity(lockedQuantity != null ? Number(lockedQuantity) || 1 : 1);
    setNote('');
    setError('');
    const defaults = formatPickupInputs(buildDefaultPickupDate());
    setDateInput(defaults.dateInput);
    setTimeInput(defaults.timeInput);
  }, [visible, variants, preselectedVariantId, lockedQuantity]);

  useEffect(() => {
    if (!selectedVariant || lockedQuantity != null) {
      return;
    }
    const stock = Math.max(0, Number(selectedVariant.quantity) || 0);
    setQuantity((prev) => {
      if (stock <= 0) {
        return 0;
      }
      return Math.max(1, Math.min(Number(prev) || 1, stock));
    });
  }, [selectedVariantId, selectedVariant?.quantity, lockedQuantity]);

  function applyPickupDate(date) {
    const formatted = formatPickupInputs(date);
    setDateInput(formatted.dateInput);
    setTimeInput(formatted.timeInput);
  }

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
        dealOfferId: dealOfferId || undefined,
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

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.titleIcon}>{dealOfferId ? '🕐' : '📦'}</Text>
            <View>
              <Text style={styles.title}>
                {dealOfferId ? 'Giữ hàng theo deal' : 'Yêu cầu giữ hàng'}
              </Text>
              <Text style={styles.subtitle}>{product?.name || product?.productName}</Text>
            </View>
          </View>
          {store?.name ? <Text style={styles.shopName}>🏪 {store.name}</Text> : null}
          {dealOfferId ? (
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>
                Giá đã thỏa thuận: {formatPrice(totalAmount)} ({qtyNum} sp)
              </Text>
            </View>
          ) : null}

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {!dealOfferId && !hasPresetVariant ? (
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

            {(dealOfferId || hasPresetVariant) && selectedVariant ? (
              <SelectedVariantCard
                variant={selectedVariant}
                productThumbnail={product?.thumbnail || ''}
              />
            ) : null}

            {selectedVariant && qtyNum > 0 ? (
              <Text style={styles.totalUnderVariant}>Tổng: {formatPrice(totalAmount)}</Text>
            ) : null}

            <Text style={styles.label}>Số lượng</Text>
            {dealOfferId && lockedQuantity != null ? (
              <Text style={styles.lockedQty}>{lockedQuantity} sp (theo deal)</Text>
            ) : (
              <QuantityStepper
                value={qtyNum}
                max={maxQty}
                onChange={(next) => {
                  setQuantity(next);
                  setError('');
                }}
              />
            )}

            <Text style={styles.label}>Giờ nhận hàng</Text>
            <View style={styles.datetimeRow}>
              <View style={styles.datetimeField}>
                <Text style={styles.datetimeHint}>Ngày (DD/MM/YYYY)</Text>
                <TextInput
                  style={styles.input}
                  value={dateInput}
                  onChangeText={setDateInput}
                  placeholder="16/07/2026"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.datetimeField}>
                <Text style={styles.datetimeHint}>Giờ (HH:mm)</Text>
                <TextInput
                  style={styles.input}
                  value={timeInput}
                  onChangeText={setTimeInput}
                  placeholder="14:30"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
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
                <Text style={styles.submitBtnText}>
                  {dealOfferId ? 'Xác nhận giữ hàng' : 'Gửi yêu cầu'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
  dealBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dealBadgeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
  lockedQty: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 10,
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
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  variantText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  variantTextActive: {
    color: '#0f766e',
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
  datetimeField: {
    flex: 1,
  },
  datetimeHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
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
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeChipTextActive: {
    color: '#0f766e',
  },
  selectedTime: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
  },
  totalUnderVariant: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '900',
    color: '#0f766e',
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
    backgroundColor: '#0f766e',
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
