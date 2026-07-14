import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { createBuyerDealOnBackend } from '../../api/buyerOpsApi';
import { formatPrice } from '../../core/utils/productFormat';
import SelectedVariantCard from './SelectedVariantCard';
import QuantityStepper from './QuantityStepper';

function parsePriceInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? Number(digits) : NaN;
}

const MAX_DEAL_DISCOUNT_PERCENT = 50;

export default function DealOfferModal({
  visible,
  product,
  store,
  preselectedVariantId = null,
  onClose,
  onSuccess,
}) {
  const insets = useSafeAreaInsets();
  const hasPresetVariant = Boolean(preselectedVariantId);
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
  const [priceInput, setPriceInput] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVariant = variants.find((v) => String(v.id) === String(selectedVariantId));
  const maxQty = Math.max(0, Number(selectedVariant?.quantity) || 0);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedVariantId(preselectedVariantId || variants[0]?.id || null);
    setQuantity(1);
    setPriceInput('');
    setNote('');
    setError('');
  }, [visible, variants, preselectedVariantId]);

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

  const unitPrice = Number(selectedVariant?.price) || 0;
  const qtyNum = Number(quantity) || 0;
  const originalTotal = unitPrice * (qtyNum > 0 ? qtyNum : 0);
  const offeredTotal = parsePriceInput(priceInput);
  const minOfferedTotal = Math.ceil(originalTotal * (1 - MAX_DEAL_DISCOUNT_PERCENT / 100));
  const discountPercent =
    originalTotal > 0 && Number.isFinite(offeredTotal)
      ? Math.max(0, Math.round(((originalTotal - offeredTotal) / originalTotal) * 10000) / 100)
      : 0;

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
    if (!Number.isFinite(offeredTotal) || offeredTotal <= 0) {
      return 'Tổng giá đề nghị không hợp lệ.';
    }
    if (offeredTotal >= originalTotal) {
      return 'Tổng đề nghị phải thấp hơn tổng niêm yết.';
    }
    if (discountPercent > MAX_DEAL_DISCOUNT_PERCENT) {
      return `Không được deal giảm quá ${MAX_DEAL_DISCOUNT_PERCENT}%. Tổng tối thiểu ${formatPrice(minOfferedTotal)}.`;
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
      const deal = await createBuyerDealOnBackend({
        idToken,
        productId: product.id,
        variantId: selectedVariant.id,
        offeredPrice: offeredTotal,
        offeredTotal,
        quantity: qtyNum,
        note: note.trim(),
      });
      onSuccess?.(deal);
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || 'Không gửi được đề nghị deal giá.');
      Alert.alert('Lỗi', submitError.message || 'Không gửi được đề nghị deal giá.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function askConfirmAndSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    Keyboard.dismiss();
    Alert.alert(
      'Xác nhận gửi deal?',
      `Đề nghị ${formatPrice(offeredTotal)} cho ${qtyNum} sp (tổng ${formatPrice(originalTotal)}).`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Gửi', onPress: () => handleSubmit() },
      ]
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <Text style={styles.titleIcon}>💬</Text>
              <View>
                <Text style={styles.title}>Đề nghị deal giá</Text>
                <Text style={styles.subtitle}>{product?.name || product?.productName}</Text>
              </View>
            </View>
            {store?.name ? <Text style={styles.shopName}>🏪 {store.name}</Text> : null}

            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {!hasPresetVariant ? (
                <>
                  <Text style={styles.label}>Chọn biến thể</Text>
                  {variants.length === 0 ? (
                    <Text style={styles.hint}>Sản phẩm hết hàng.</Text>
                  ) : (
                    variants.map((variant) => {
                      const isActive = String(variant.id) === String(selectedVariantId);
                      return (
                        <Pressable
                          key={variant.id}
                          style={[styles.variantChip, isActive && styles.variantChipActive]}
                          onPress={() => setSelectedVariantId(variant.id)}
                        >
                          <Text style={[styles.variantText, isActive && styles.variantTextActive]}>
                            {variant.name || variant.variantName} — {formatPrice(variant.price)}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                  {selectedVariant ? (
                    <SelectedVariantCard
                      variant={selectedVariant}
                      productThumbnail={product?.thumbnail || ''}
                    />
                  ) : null}
                </>
              ) : selectedVariant ? (
                <SelectedVariantCard
                  variant={selectedVariant}
                  productThumbnail={product?.thumbnail || ''}
                />
              ) : null}

              {selectedVariant && qtyNum > 0 ? (
                <Text style={styles.totalUnderVariant}>Tổng: {formatPrice(originalTotal)}</Text>
              ) : null}

              {selectedVariant ? (
                <>
                  <Text style={styles.label}>Số lượng</Text>
                  <QuantityStepper
                    value={qtyNum}
                    max={maxQty}
                    onChange={(next) => {
                      setQuantity(next);
                      setError('');
                    }}
                  />

                  <Text style={styles.label}>
                    Tổng đề nghị{qtyNum > 0 ? ` cho ${qtyNum} sp` : ''}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={priceInput}
                    onChangeText={(value) => {
                      setPriceInput(value.replace(/\D/g, ''));
                      setError('');
                    }}
                    keyboardType="number-pad"
                    placeholder="Nhập tổng bạn muốn trả"
                    placeholderTextColor="#94a3b8"
                  />
                  {Number.isFinite(offeredTotal) && offeredTotal > 0 && qtyNum > 0 ? (
                    <Text style={styles.discountText}>Giảm ~{discountPercent}%</Text>
                  ) : null}

                  <Text style={styles.label}>Ghi chú (tuỳ chọn)</Text>
                  <TextInput
                    style={[styles.input, styles.noteInput]}
                    value={note}
                    onChangeText={setNote}
                    multiline
                    placeholder="Lý do hoặc yêu cầu thêm..."
                    placeholderTextColor="#94a3b8"
                  />
                </>
              ) : null}

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
                disabled={isSubmitting || !selectedVariant}
                onPress={askConfirmAndSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Gửi đề nghị</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
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
  hint: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
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
  originalPrice: {
    fontSize: 16,
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
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  discountText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
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
