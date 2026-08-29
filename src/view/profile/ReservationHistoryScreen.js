import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getBuyerOrdersOnBackend,
  getBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import { RESERVATION_STATUS, RESERVATION_TAB } from '../../constants/sellerOrders';
import {
  canReviewReservationOrder,
  canShowReviewButton,
  getReservationStatusLabel,
  hasOrderReviewSubmitted,
  submitShopReview,
} from '../../core/utils/orderReview';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import {
  hasItemId,
  removeById,
  upsertById,
} from '../../core/utils/realtimeList';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import { coalesceReservationFetch } from '../../core/utils/coalesceReservationFetch';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import LoadMoreButton from '../shared/components/LoadMoreButton';
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

function toHistoryRow(reservation) {
  return {
    id: String(reservation.id),
    reservationId: String(reservation.id),
    orderCode: String(reservation.id),
    shopId: reservation.shopId || reservation.storeId || '',
    storeId: reservation.shopId || reservation.storeId || '',
    productId: reservation.product?.id ? String(reservation.product.id) : '',
    productName:
      reservation.product?.productName || reservation.variant?.variantName || 'Sản phẩm',
    storeName: reservation.storeName || 'Gian hàng',
    quantity: Number(reservation.quantity || 1),
    reservedAt: reservation.createdAt,
    expiresAt: reservation.expiresAt || reservation.pickupDeadline,
    status: reservation.status,
  };
}

const STATUS_COLORS = {
  [RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION]: { bg: '#fef3c7', text: '#b45309' },
  [RESERVATION_STATUS.WAITING_PICKUP]: { bg: '#d1fae5', text: '#076F32' },
  [RESERVATION_STATUS.COMPLETED]: { bg: '#e0e7ff', text: '#4338ca' },
  [RESERVATION_STATUS.AUTO_COMPLETED]: { bg: '#e0e7ff', text: '#4338ca' },
  [RESERVATION_STATUS.REJECTED]: { bg: '#fee2e2', text: '#b91c1c' },
  [RESERVATION_STATUS.REFUNDED]: { bg: '#fee2e2', text: '#b91c1c' },
  [RESERVATION_STATUS.DISPUTED]: { bg: '#ffedd5', text: '#c2410c' },
};

function ReservationList({ items, onOpenOrderDetail, onOpenStore, onReviewStore, reviewedOrderCodes }) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>Chưa có phiếu giữ hàng.</Text>;
  }

  return items.map((item) => {
    const statusStyle =
      STATUS_COLORS[item.status] ||
      STATUS_COLORS[RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION];
    const isActiveReservation = item.status === RESERVATION_STATUS.WAITING_PICKUP;
    const isPickedUp = canReviewReservationOrder(item);
    const showReviewButton = canShowReviewButton(
      { ...item, orderCode: item.id },
      reviewedOrderCodes
    );
    const reviewSubmitted = hasOrderReviewSubmitted({ ...item, orderCode: item.id });
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
        ) : isPickedUp && reviewSubmitted ? (
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
  // Đọc danh sách hiện tại trong handler realtime mà không cần thêm dependency.
  const reservationsRef = useRef(reservations);
  reservationsRef.current = reservations;
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const { reviewedOrderCodes: internalReviewedCodes, markReviewed } =
    useReviewedOrderCodes(localRefreshKey);
  const reviewedOrderCodes = externalReviewedCodes || internalReviewedCodes;

  const loadReservations = useCallback(async ({ nextPage = 1 } = {}) => {
    if (nextPage === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setReservations([]);
        setHasMore(false);
        setTotalCount(0);
        return;
      }

      const data = await getBuyerOrdersOnBackend({
        idToken,
        tab: RESERVATION_TAB.PENDING,
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const rows = (data?.reservations || []).map(toHistoryRow);
      setReservations((current) =>
        nextPage === 1 ? rows : appendUniqueById(current, rows)
      );
      setPage(Number(data?.page) || nextPage);
      setHasMore(
        typeof data?.hasMore === 'boolean'
          ? data.hasMore
          : rows.length >= DEFAULT_PAGE_SIZE
      );
      setTotalCount(
        Number.isFinite(Number(data?.total))
          ? Math.max(0, Number(data.total))
          : (nextPage - 1) * DEFAULT_PAGE_SIZE +
            rows.length +
            (data?.hasMore ? DEFAULT_PAGE_SIZE : 0)
      );
    } catch {
      if (nextPage === 1) {
        setReservations([]);
        setHasMore(false);
        setTotalCount(0);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadReservations({ nextPage: 1 });
  }, [loadReservations, localRefreshKey]);

  /** Realtime: chỉ sửa đúng đơn thay đổi trong danh sách "đang giữ hàng". */
  const handleOrderUpdated = useCallback(async (payload) => {
    const reservationId = String(payload?.reservationId || payload?.id || '').trim();
    if (!reservationId) {
      return;
    }

    const isInList = hasItemId(reservationsRef.current, reservationId);
    const isPendingEvent =
      Number(payload?.status) === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;

    if (!isInList && !isPendingEvent) {
      return;
    }

    try {
      const reservation = await coalesceReservationFetch('buyer', reservationId, async () => {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          return null;
        }
        return getBuyerReservationOnBackend(idToken, reservationId);
      });
      if (!reservation?.id) {
        return;
      }

      const stillPending =
        Number(reservation.status) === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;

      if (!stillPending) {
        if (isInList) {
          setReservations((current) => removeById(current, reservationId));
          setTotalCount((current) => Math.max(0, current - 1));
        }
        return;
      }

      setReservations((current) =>
        upsertById(current, toHistoryRow(reservation), {
          position: 'start',
          moveToStartOnUpdate: true,
        })
      );
      if (!isInList) {
        setTotalCount((current) => current + 1);
      }
    } catch {
      // Giữ nguyên danh sách nếu tải lỗi.
    }
  }, []);

  useOrderSocket({
    enabled: true,
    onOrderUpdated: handleOrderUpdated,
  });

  async function handleSubmitReview({ rating, comment, images, imageUrl }) {
    if (!reviewTarget) {
      return;
    }
    try {
      await submitShopReview({
        shopId: reviewTarget.shopId || reviewTarget.storeId,
        productId: reviewTarget.productId,
        reservationId: reviewTarget.reservationId || reviewTarget.id,
        rating,
        comment,
        images,
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
        <ActivityIndicator size="large" color="#076F32" style={styles.loader} />
      ) : (
        <>
          <ReservationList
            items={reservations}
            onOpenOrderDetail={onOpenOrderDetail}
            onOpenStore={onOpenStore}
            onReviewStore={setReviewTarget}
            reviewedOrderCodes={reviewedOrderCodes}
          />
          {reservations.length > 0 ? (
            <LoadMoreButton
              currentCount={reservations.length}
              totalCount={
                hasMore
                  ? Math.max(totalCount, reservations.length + DEFAULT_PAGE_SIZE)
                  : reservations.length
              }
              loading={isLoadingMore}
              onPress={() => loadReservations({ nextPage: page + 1 })}
            />
          ) : null}
        </>
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
    backgroundColor: '#076F32',
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