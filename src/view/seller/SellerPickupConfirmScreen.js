import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SubScreenHeader, { APP_HEADER_ICON_BUTTON_STYLE } from '../shared/components/SubScreenHeader';
import { PickupOrderSummaryCard } from '../shared/components/PickupOrderLayout';
import SellerCancelAcceptedModal from '../shared/components/SellerCancelAcceptedModal';
import SellerPickupQuantityModal from '../shared/components/SellerPickupQuantityModal';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  adjustSellerReservationAtPickupOnBackend,
  cancelSellerReservationOnBackend,
  confirmSellerDeliveredOnBackend,
} from '../../api/sellerOpsApi';
import { RESERVATION_STATUS } from '../../constants/sellerOrders';
import { getOrderCodeValue } from '../../core/utils/orderCode';
import { useScreenInsets } from '../../hooks/useScreenInsets';

export default function SellerPickupConfirmScreen({
  reservation: initialReservation,
  onBack,
  onCompleted,
}) {
  const insets = useScreenInsets();
  const [reservation, setReservation] = useState(initialReservation);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const orderId = String(reservation?.id || '').trim();

  const productName = reservation?.product?.productName || 'Sản phẩm';
  const variantName = String(reservation?.variant?.variantName || '').trim();
  const productImage =
    reservation?.product?.thumbnail ||
    reservation?.variant?.imageUrl ||
    reservation?.product?.thumbnails?.[0] ||
    '';
  const buyerName =
    reservation?.buyer?.fullName ||
    reservation?.buyer?.userName ||
    'Khách hàng';
  const qty = Number(reservation?.quantity) || 1;
  const totalAmount = Number(reservation?.totalAmount) || 0;
  const depositAmount = Number(reservation?.depositAmount) || 0;
  const cashDue = Math.max(
    0,
    Number(reservation?.remainingAmount ?? reservation?.cashDue) ||
      totalAmount - depositAmount
  );
  const unitPrice =
    reservation?.agreedPrice != null
      ? Number(reservation.agreedPrice)
      : reservation?.variant?.price != null
        ? Number(reservation.variant.price)
        : qty > 0
          ? Math.round(totalAmount / qty)
          : 0;
  const note = String(reservation?.note || '').trim();

  function handleMorePress() {
    Alert.alert('Tùy chọn đơn hàng', undefined, [
      { text: 'Chỉnh số lượng', onPress: () => setShowQtyModal(true) },
      { text: 'Hủy đơn', style: 'destructive', onPress: () => setShowCancelModal(true) },
      { text: 'Đóng', style: 'cancel' },
    ]);
  }

  async function handleConfirmQuantity(newQuantity) {
    const idToken = await getCurrentUserIdToken();
    const updated = await adjustSellerReservationAtPickupOnBackend(idToken, orderId, {
      quantity: newQuantity,
    });
    if (updated) {
      setReservation(updated);
    }
  }

  async function handleCancelAccepted(payload) {
    setIsCancelling(true);
    try {
      const idToken = await getCurrentUserIdToken();
      await cancelSellerReservationOnBackend({
        idToken,
        reservationId: orderId,
        reason: payload.reason,
        images: payload.images,
      });
      setShowCancelModal(false);
      onCompleted?.();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không hủy được đơn.');
      throw actionError;
    } finally {
      setIsCancelling(false);
    }
  }

  function handleConfirmDelivered() {
    Alert.alert(
      'Xác nhận giao hàng',
      `Bạn xác nhận đã giao hàng cho ${buyerName}?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đã giao hàng',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const idToken = await getCurrentUserIdToken();
              await confirmSellerDeliveredOnBackend(idToken, orderId);
              onCompleted?.();
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không xác nhận được giao hàng.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }

  if (!orderId) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Xác nhận giao hàng" onBack={onBack} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Không có thông tin đơn hàng.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader
        title="Xác nhận giao hàng"
        onBack={onBack}
        rightSlot={
          Number(reservation?.status) === RESERVATION_STATUS.WAITING_PICKUP ? (
            <Pressable
              style={APP_HEADER_ICON_BUTTON_STYLE}
              onPress={handleMorePress}
              accessibilityRole="button"
              accessibilityLabel="Tùy chọn đơn hàng"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#334155" />
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.nestedScrollPaddingBottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PickupOrderSummaryCard
          productImage={productImage}
          productName={productName}
          variantName={variantName}
          unitPrice={unitPrice}
          qty={qty}
          totalAmount={totalAmount}
          depositAmount={depositAmount}
          cashDue={cashDue}
          pickupTime={reservation?.pickupTime}
          note={note}
          buyerName={buyerName}
        />

        {Number(reservation?.status) === RESERVATION_STATUS.WAITING_PICKUP ? (
          <Pressable
            style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
            disabled={isSubmitting}
            onPress={handleConfirmDelivered}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.confirmBtnText}>Đã giao hàng</Text>
            )}
          </Pressable>
        ) : (
          <Text style={styles.blockedHint}>
            Đơn không còn ở trạng thái giữ hàng. Không thể xác nhận giao hàng.
          </Text>
        )}
      </ScrollView>

      <SellerPickupQuantityModal
        visible={showQtyModal}
        reservation={reservation}
        onClose={() => setShowQtyModal(false)}
        onConfirm={handleConfirmQuantity}
      />

      <SellerCancelAcceptedModal
        visible={showCancelModal}
        orderCode={getOrderCodeValue(reservation?.id || reservation?._id)}
        onClose={() => {
          if (!isCancelling) {
            setShowCancelModal(false);
          }
        }}
        onSubmit={handleCancelAccepted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#64748b',
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#076F32',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  blockedHint: {
    textAlign: 'center',
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 14,
  },
});
