import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  cancelSellerReservationOnBackend,
  completeSellerReservationOnBackend,
  confirmSellerReservationOnBackend,
  getSellerReservationDetailOnBackend,
  rejectSellerReservationOnBackend,
} from '../../api/sellerOpsApi';
import { RESERVATION_STATUS } from '../../constants/sellerOrders';
import { formatPrice } from '../../core/utils/productFormat';
import ProfileSubScreen from '../profile/ProfileSubScreen';

export default function SellerOrderDetailScreen({ reservationId, onBack, onChanged }) {
  const [reservation, setReservation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerReservationDetailOnBackend(idToken, reservationId);
      setReservation(data);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết đơn.');
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function runAction(action) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      let updated;
      if (action === 'confirm') {
        updated = await confirmSellerReservationOnBackend(idToken, reservationId);
      } else if (action === 'reject') {
        updated = await rejectSellerReservationOnBackend({ idToken, reservationId, reason: 'Shop từ chối' });
      } else if (action === 'cancel') {
        updated = await cancelSellerReservationOnBackend({ idToken, reservationId, reason: 'Shop hủy' });
      } else if (action === 'complete') {
        updated = await completeSellerReservationOnBackend(idToken, reservationId);
      }
      setReservation(updated);
      onChanged?.();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không thực hiện được thao tác.');
    } finally {
      setIsActing(false);
    }
  }

  function handleCallBuyer() {
    const phone = reservation?.buyer?.phone;
    if (!phone) {
      Alert.alert('Thông báo', 'Khách chưa có số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  }

  if (isLoading) {
    return (
      <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  if (!reservation) {
    return (
      <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
        <Text style={styles.errorText}>{error || 'Không tìm thấy đơn.'}</Text>
      </ProfileSubScreen>
    );
  }

  const canConfirm = reservation.status === RESERVATION_STATUS.PENDING;
  const canComplete = reservation.status === RESERVATION_STATUS.CONFIRMED;
  const canCancel =
    reservation.status === RESERVATION_STATUS.PENDING ||
    reservation.status === RESERVATION_STATUS.CONFIRMED;

  return (
    <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Người mua</Text>
        <Text style={styles.value}>{reservation.buyer?.fullName || 'N/A'}</Text>
        <Text style={styles.meta}>@{reservation.buyer?.userName || '—'}</Text>
        <Text style={styles.meta}>SĐT: {reservation.buyer?.phone || 'Chưa có'}</Text>
        <Pressable onPress={handleCallBuyer} style={styles.callButton}>
          <Text style={styles.callButtonText}>📞 Gọi khách</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sản phẩm</Text>
        <Text style={styles.value}>{reservation.product?.productName}</Text>
        <Text style={styles.meta}>{reservation.variant?.variantName}</Text>
        <Text style={styles.meta}>Số lượng: {reservation.quantity}</Text>
        <Text style={styles.price}>Tổng tiền: {formatPrice(reservation.totalAmount)}</Text>
        {reservation.pickupTime ? (
          <Text style={styles.meta}>
            Giờ lấy hàng: {new Date(reservation.pickupTime).toLocaleString('vi-VN')}
          </Text>
        ) : null}
        {reservation.note ? <Text style={styles.meta}>Ghi chú: {reservation.note}</Text> : null}
        {reservation.cancelReason ? (
          <Text style={styles.meta}>Lý do hủy: {reservation.cancelReason}</Text>
        ) : null}
        {reservation.buyerCancelLocked ? (
          <Text style={styles.lockHint}>Khách không thể hủy sau khi chấp nhận giá (15 phút).</Text>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        {canConfirm ? (
          <>
            <Pressable
              disabled={isActing}
              onPress={() => runAction('confirm')}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Xác nhận</Text>
            </Pressable>
            <Pressable
              disabled={isActing}
              onPress={() => runAction('reject')}
              style={styles.dangerBtn}
            >
              <Text style={styles.dangerBtnText}>Từ chối</Text>
            </Pressable>
          </>
        ) : null}
        {canComplete ? (
          <Pressable
            disabled={isActing}
            onPress={() => runAction('complete')}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Khách đã nhận hàng</Text>
          </Pressable>
        ) : null}
        {canCancel ? (
          <Pressable
            disabled={isActing}
            onPress={() => runAction('cancel')}
            style={styles.dangerBtn}
          >
            <Text style={styles.dangerBtnText}>Hủy đơn</Text>
          </Pressable>
        ) : null}
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  meta: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  price: { color: '#0d7377', fontWeight: '900', fontSize: 16, marginTop: 6 },
  lockHint: { color: '#b45309', fontSize: 12, fontWeight: '700', marginTop: 8 },
  callButton: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonText: { color: '#0d7377', fontWeight: '800' },
  actionRow: { gap: 10, marginTop: 4 },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '800' },
  dangerBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: '#b91c1c', fontWeight: '800' },
  errorText: { color: '#b91c1c', fontWeight: '700' },
});
