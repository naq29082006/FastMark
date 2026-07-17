import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getBuyerOrdersOnBackend } from '../../api/buyerOpsApi';
import { RESERVATION_STATUS, RESERVATION_TAB } from '../../constants/sellerOrders';
import {
  canReviewReservationOrder,
  canShowReviewButton,
  getReservationStatusLabel,
  isOrderAlreadyReviewed,
  submitShopReview,
} from '../../core/utils/orderReview';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { ReviewedBadge, ReviewNowButton } from '../shared/components/ReviewOrderAction';
import ShopReviewModal from '../shared/components/ShopReviewModal';
import ProfileSubScreen from './ProfileSubScreen';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_COLORS = {
  [RESERVATION_STATUS.PENDING]: { bg: '#fef3c7', text: '#b45309' },
  [RESERVATION_STATUS.CONFIRMED]: { bg: '#d1fae5', text: '#047857' },
  [RESERVATION_STATUS.COMPLETED]: { bg: '#e0e7ff', text: '#4338ca' },
  [RESERVATION_STATUS.CANCELLED]: { bg: '#fee2e2', text: '#b91c1c' },
};

function ReservationList({ items, onOpenOrderDetail, onOpenStore, onReviewStore, reviewedOrderCodes }) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>Chưa có phiếu giữ hàng.</Text>;
  }

  return items.map((item) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS[RESERVATION_STATUS.PENDING];
    const isActiveReservation = item.status === RESERVATION_STATUS.CONFIRMED;
    const isPickedUp = canReviewReservationOrder(item);
    const showReviewButton = canShowReviewButton(
      { ...item, orderCode: item.id },
      reviewedOrderCodes
    );
    const alreadyReviewed = isOrderAlreadyReviewed(
      { ...item, orderCode: item.id },
      reviewedOrderCodes
    );
    return (
      <Pressable
        key={item.id}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => onOpenOrderDetail?.({ ...item, orderCode: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.productName}>{item.productName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {getReservationStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.storeName}>🏪 {item.storeName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Số lượng: {item.quantity}</Text>
          <Text style={styles.metaText}>Giữ lúc: {formatDateTime(item.reservedAt)}</Text>
          <Text style={styles.metaText}>Hết hạn: {formatDateTime(item.expiresAt)}</Text>
        </View>

        {isActiveReservation ? (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={(event) => {
              event.stopPropagation?.();
              item.storeId && onOpenStore?.(item.storeId);
            }}
          >
            <Text style={styles.actionButtonText}>Đến lấy hàng</Text>
          </Pressable>
        ) : isPickedUp && showReviewButton ? (
          <ReviewNowButton compact onPress={() => onReviewStore?.(item)} />
        ) : isPickedUp && alreadyReviewed ? (
          <ReviewedBadge compact />
        ) : (
          <View style={styles.secondaryActionWrap}>
            <View style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Phiếu giữ hàng đã hết hạn</Text>
            </View>
          </View>
        )}
      </Pressable>
    );
  });
}

export default function ReservationHistoryScreen({
  embedded = false,
  onBack,
  onOpenStore,
  onOpenOrderDetail,
  reviewedOrderCodes: externalReviewedCodes,
  onOrderReviewed,
}) {
  const [reviewTarget, setReviewTarget] = useState(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { reviewedOrderCodes: internalReviewedCodes, markReviewed } =
    useReviewedOrderCodes(localRefreshKey);
  const reviewedOrderCodes = externalReviewedCodes || internalReviewedCodes;

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setReservations([]);
        return;
      }

      const data = await getBuyerOrdersOnBackend({
        idToken,
        tab: RESERVATION_TAB.HOLDING,
      });
      const rows = (data?.reservations || []).map((reservation) => ({
        id: String(reservation.id),
        storeId: reservation.shopId || reservation.storeId || '',
        productName:
          reservation.product?.productName ||
          reservation.variant?.variantName ||
          'Sản phẩm',
        storeName: reservation.storeName || 'Gian hàng',
        quantity: Number(reservation.quantity || 1),
        reservedAt: reservation.createdAt,
        expiresAt: reservation.expiresAt || reservation.pickupDeadline,
        status: reservation.status,
      }));
      setReservations(rows);
    } catch {
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations, localRefreshKey]);

  async function handleSubmitReview({ rating, comment, imageUrl }) {
    if (!reviewTarget) {
      return;
    }
    try {
      await submitShopReview({
        storeId: reviewTarget.storeId,
        storeName: reviewTarget.storeName,
        productName: reviewTarget.productName,
        orderCode: reviewTarget.id,
        rating,
        comment,
        imageUrl,
      });
      markReviewed({ ...reviewTarget, orderCode: reviewTarget.id });
      onOrderReviewed?.({ ...reviewTarget, orderCode: reviewTarget.id });
      setLocalRefreshKey((value) => value + 1);
      setReviewTarget(null);
      Alert.alert('Cảm ơn bạn', 'Đánh giá của bạn đã được gửi thành công.');
    } catch (error) {
      if (error.statusCode === 409) {
        markReviewed({ ...reviewTarget, orderCode: reviewTarget.id });
        onOrderReviewed?.({ ...reviewTarget, orderCode: reviewTarget.id });
        setReviewTarget(null);
        Alert.alert('Thông báo', 'Bạn đã đánh giá đơn hàng này rồi.');
        return;
      }
      Alert.alert('Không gửi được đánh giá', error.message || 'Vui lòng thử lại.');
    }
  }

  const content = (
    <>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0f766e" style={styles.loader} />
      ) : (
        <ReservationList
          items={reservations}
          onOpenOrderDetail={onOpenOrderDetail}
          onOpenStore={onOpenStore}
          onReviewStore={setReviewTarget}
          reviewedOrderCodes={reviewedOrderCodes}
        />
      )}
      <ShopReviewModal
        visible={Boolean(reviewTarget)}
        storeName={reviewTarget?.storeName}
        productName={reviewTarget?.productName}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleSubmitReview}
      />
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <ProfileSubScreen title="Lịch sử giữ hàng" onBack={onBack}>
      {content}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 24,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  storeName: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  metaRow: {
    gap: 4,
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  reviewButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  reviewButtonText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryActionWrap: {
    marginTop: 14,
  },
  secondaryAction: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  secondaryActionText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
});