import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  completeSellerReservationOnBackend,
  confirmSellerReservationOnBackend,
  getSellerReservationDetailOnBackend,
  rejectSellerReservationOnBackend,
} from '../../api/sellerOpsApi';
import { RESERVATION_STATUS } from '../../constants/sellerOrders';
import { formatPrice } from '../../core/utils/productFormat';
import AvatarBadge from '../shared/components/AvatarBadge';
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
        updated = await rejectSellerReservationOnBackend({
          idToken,
          reservationId,
          reason: 'Shop hủy',
        });
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
  const buyerName = reservation.buyer?.fullName || 'Khách';

  return (
    <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Người mua</Text>
        <View style={styles.buyerRow}>
          <AvatarBadge name={buyerName} uri={reservation.buyer?.avatar || ''} size={56} />
          <View style={styles.buyerInfo}>
            <Text style={styles.value}>{buyerName}</Text>
            <Text style={styles.meta}>@{reservation.buyer?.userName || '—'}</Text>
            <Text style={styles.meta}>SĐT: {reservation.buyer?.phone || 'Chưa có'}</Text>
          </View>
        </View>
        <Pressable onPress={handleCallBuyer} style={styles.callButton}>
          <Text style={styles.callButtonText}>📞 Gọi khách</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sản phẩm</Text>
        <View style={styles.productRow}>
          <View style={styles.productThumbWrap}>
            {reservation.product?.thumbnail ? (
              <Image
                source={{ uri: reservation.product.thumbnail }}
                style={styles.productThumb}
              />
            ) : (
              <Text style={styles.productThumbEmoji}>📦</Text>
            )}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.value} numberOfLines={2}>
              {reservation.product?.productName || 'Sản phẩm'}
            </Text>
            {reservation.variant?.variantName ? (
              <Text style={styles.meta}>{reservation.variant.variantName}</Text>
            ) : null}
            <Text style={styles.meta}>Số lượng: {reservation.quantity}</Text>
            <Text style={styles.price}>Tổng tiền: {formatPrice(reservation.totalAmount)}</Text>
          </View>
        </View>
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
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buyerInfo: {
    flex: 1,
    gap: 2,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  productThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productThumbEmoji: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  value: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  meta: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  price: { color: '#0d7377', fontWeight: '900', fontSize: 15, marginTop: 4 },
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
