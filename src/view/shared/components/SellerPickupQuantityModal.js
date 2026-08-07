import { useEffect, useMemo, useState } from 'react';
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

import QuantityStepper from '../../buyer/QuantityStepper';
import { BottomSheetHandle } from './bottomSheetChrome';
import {
  FormSheetActions,
  FormSheetBackdrop,
  FormSheetHeader,
  FormSheetShell,
  FORM_SHEET_SCROLL_STYLE,
} from './formSheetLayout';
import { formatPrice } from '../../../core/utils/productFormat';

function computeAmounts(reservation, quantity) {
  const qty = Math.max(1, Number(quantity) || 1);
  const unitPrice =
    reservation?.agreedPrice != null
      ? Number(reservation.agreedPrice)
      : reservation?.variant?.price != null
        ? Number(reservation.variant.price)
        : Number(reservation?.reservedPrice) || 0;
  const depositPercent = Math.max(0, Math.min(100, Number(reservation?.depositPercent) || 0));
  const totalAmount = unitPrice * qty;
  const depositAmount =
    depositPercent > 0 ? Math.round((unitPrice * qty * depositPercent) / 100) : 0;
  const cashDue = Math.max(0, totalAmount - depositAmount);
  return { qty, unitPrice, totalAmount, depositAmount, cashDue };
}

function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

function PaymentLine({ label, value, variant = 'default' }) {
  const labelStyle = [
    styles.paymentLabel,
    variant === 'deposit' && styles.paymentLabelDeposit,
    variant === 'cashDue' && styles.paymentLabelCashDue,
    variant === 'refund' && styles.paymentLabelRefund,
  ];
  const valueStyle = [
    styles.paymentValue,
    variant === 'deposit' && styles.paymentValueDeposit,
    variant === 'cashDue' && styles.paymentValueCashDue,
    variant === 'refund' && styles.paymentValueRefund,
  ];
  return (
    <View style={styles.paymentRow}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

export default function SellerPickupQuantityModal({
  visible,
  reservation,
  onClose,
  onConfirm,
}) {
  const currentQty = Number(reservation?.quantity) || 1;
  const [draftQty, setDraftQty] = useState(currentQty);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftQty(Number(reservation?.quantity) || 1);
      setIsSubmitting(false);
    }
  }, [visible, reservation?.quantity]);

  const preview = useMemo(() => computeAmounts(reservation, draftQty), [reservation, draftQty]);
  const currentAmounts = useMemo(() => computeAmounts(reservation, currentQty), [reservation, currentQty]);
  const depositRefund = Math.max(0, currentAmounts.depositAmount - preview.depositAmount);
  const canSave = draftQty < currentQty && draftQty >= 1;

  async function handleConfirm() {
    if (!canSave) {
      Alert.alert('Thông báo', 'Hãy chọn số lượng mới nhỏ hơn số lượng ban đầu.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm?.(draftQty);
      onClose?.();
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không cập nhật được số lượng.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <FormSheetBackdrop onClose={onClose} />
        <FormSheetShell panelStyle={styles.sheet} heightRatio={0.85}>
            <BottomSheetHandle />
            <FormSheetHeader
              title="Chỉnh số lượng"
              onClose={onClose}
              disabled={isSubmitting}
            />

            <ScrollView
              style={FORM_SHEET_SCROLL_STYLE}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Số lượng ban đầu:</Text>
              <Text style={styles.quantityReadonly}>{currentQty}</Text>
            </View>

            <SectionDivider />

            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Số lượng mới:</Text>
              <QuantityStepper
                compact
                min={1}
                max={currentQty}
                value={draftQty}
                disabled={isSubmitting || currentQty <= 1}
                onChange={setDraftQty}
              />
            </View>

            <SectionDivider />

            <View style={styles.paymentSection}>
              <Text style={styles.sectionLabel}>Chi tiết thanh toán</Text>
              <View style={styles.paymentCard}>
                <PaymentLine label="Tổng đơn:" value={formatPrice(preview.totalAmount)} />
                <View style={styles.paymentDivider} />
                <PaymentLine
                  label="Tiền cọc:"
                  value={formatPrice(preview.depositAmount)}
                  variant="deposit"
                />
                <View style={styles.paymentDivider} />
                <PaymentLine
                  label="Cần thu:"
                  value={formatPrice(preview.cashDue)}
                  variant="cashDue"
                />
                {depositRefund > 0 ? (
                  <>
                    <View style={styles.paymentDivider} />
                    <PaymentLine
                      label="Hoàn cọc cho người mua:"
                      value={formatPrice(depositRefund)}
                      variant="refund"
                    />
                  </>
                ) : null}
              </View>
              <Text style={styles.hint}>
                Giảm số lượng khi hàng thiếu, phần cọc thừa hoàn về ví người mua.
              </Text>
            </View>
            </ScrollView>

            <FormSheetActions style={styles.footer}>
              <Pressable style={styles.cancelBtn} disabled={isSubmitting} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, (!canSave || isSubmitting) && styles.confirmBtnDisabled]}
                disabled={!canSave || isSubmitting}
                onPress={handleConfirm}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Xác nhận</Text>
                )}
              </Pressable>
            </FormSheetActions>
        </FormSheetShell>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    paddingTop: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 0,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 10,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quantityLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  quantityReadonly: {
    fontSize: 14,
    fontWeight: '900',
    color: '#076F32',
    minWidth: 22,
    textAlign: 'center',
  },
  paymentSection: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 14,
  },
  paymentLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  paymentValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  paymentLabelDeposit: {
    fontWeight: '800',
    color: '#076F32',
  },
  paymentValueDeposit: {
    fontSize: 16,
    color: '#076F32',
  },
  paymentLabelCashDue: {
    fontWeight: '800',
    color: '#c2410c',
  },
  paymentValueCashDue: {
    fontSize: 16,
    color: '#ea580c',
  },
  paymentLabelRefund: {
    fontWeight: '800',
    color: '#c2410c',
  },
  paymentValueRefund: {
    fontSize: 16,
    color: '#ea580c',
  },
  footer: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
