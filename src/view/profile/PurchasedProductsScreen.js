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
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import {
  canShowReviewButton,
  getPurchaseStatusLabel,
  getReservationStatusLabel,
  isOrderAlreadyReviewed,
  submitShopReview,
} from '../../core/utils/orderReview';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { ReviewedBadge, ReviewNowButton } from '../shared/components/ReviewOrderAction';
import ShopReviewModal from '../shared/components/ShopReviewModal';
import ProfileSubScreen from './ProfileSubScreen';

function formatPrice(price) {
  return `${Number(price).toLocaleString('vi-VN')}đ`;
}

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

function formatOrderTotal(price, quantity) {
  return Number(price || 0) * Number(quantity || 0);
}

function PurchaseList({ items, onOpenOrderDetail, onOpenStore, onReviewStore, reviewedOrderCodes }) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>Chưa có đơn hàng hoàn thành.</Text>;
  }

  return items.map((item) => {
    const showReviewButton = canShowReviewButton(item, reviewedOrderCodes);
    const alreadyReviewed = isOrderAlreadyReviewed(item, reviewedOrderCodes);

    return (
      <Pressable
        key={item.id}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => onOpenOrderDetail?.({ ...item, type: 'purchase' })}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderLabel}>Mã đơn hàng</Text>
          <Text style={styles.orderCode}>{item.orderCode}</Text>
        </View>

        <View style={styles.cardRow}>
          <View style={styles.productImage}>
            <Text style={styles.emoji}>{item.imageEmoji}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.productName}>{item.productName}</Text>
            <Text style={styles.storeName}>🏪 {item.storeName}</Text>

            <View style={styles.detailList}>
              <Text style={styles.detailText}>
                Số lượng mua: <Text style={styles.detailValue}>{item.quantity}</Text>
              </Text>
              <Text style={styles.detailText}>
                Đơn giá: <Text style={styles.detailValue}>{formatPrice(item.price)}</Text>
              </Text>
              <Text style={styles.detailText}>
                Tổng tiền:{' '}
                <Text style={styles.totalValue}>
                  {formatPrice(formatOrderTotal(item.price, item.quantity))}
                </Text>
              </Text>
              <Text style={styles.detailText}>
                Trạng thái:{' '}
                <Text style={styles.detailValue}>
                  {getReservationStatusLabel(item.status) || getPurchaseStatusLabel(item.status)}
                </Text>
              </Text>
              <Text style={styles.detailText}>
                Ngày mua: <Text style={styles.detailValue}>{formatDateTime(item.purchasedAt)}</Text>
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {showReviewButton ? (
            <ReviewNowButton compact onPress={() => onReviewStore?.(item)} />
          ) : null}
          {alreadyReviewed ? <ReviewedBadge compact /> : null}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              !showReviewButton && !alreadyReviewed && styles.actionButtonFull,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={(event) => {
              event.stopPropagation?.();
              item.storeId && onOpenStore?.(item.storeId);
            }}
          >
            <Text style={styles.actionButtonText}>Đến gian hàng</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  });
}

export default function PurchasedProductsScreen({
  embedded = false,
  onBack,
  onOpenStore,
  onOpenOrderDetail,
  reviewedOrderCodes: externalReviewedCodes,
  onOrderReviewed,
}) {
  const [reviewTarget, setReviewTarget] = useState(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { reviewedOrderCodes: internalReviewedCodes, markReviewed } =
    useReviewedOrderCodes(localRefreshKey);
  const reviewedOrderCodes = externalReviewedCodes || internalReviewedCodes;

  const loadPurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setPurchases([]);
        return;
      }

      const data = await getBuyerOrdersOnBackend({
        idToken,
        tab: RESERVATION_TAB.COMPLETED,
      });
      const rows = (data?.reservations || []).map((reservation) => ({
        id: String(reservation.id),
        orderCode: String(reservation.id),
        storeId: reservation.shopId || reservation.storeId || '',
        productName:
          reservation.product?.productName ||
          reservation.variant?.variantName ||
          'Sản phẩm',
        storeName: reservation.storeName || 'Gian hàng',
        price: Number(reservation.variant?.price || reservation.product?.minPrice || 0),
        quantity: Number(reservation.quantity || 1),
        purchasedAt: reservation.completedAt || reservation.updatedAt || reservation.createdAt,
        imageEmoji: '📦',
        status: reservation.status,
        type: 'purchase',
      }));
      setPurchases(rows);
    } catch {
      setPurchases([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases, localRefreshKey]);

  async function handleSubmitReview({ rating, comment, imageUrl }) {
    if (!reviewTarget) {
      return;
    }
    try {
      await submitShopReview({
        storeId: reviewTarget.storeId,
        storeName: reviewTarget.storeName,
        productName: reviewTarget.productName,
        orderCode: reviewTarget.orderCode,
        rating,
        comment,
        imageUrl,
      });
      markReviewed(reviewTarget);
      onOrderReviewed?.(reviewTarget);
      setLocalRefreshKey((value) => value + 1);
      setReviewTarget(null);
      Alert.alert('Cảm ơn bạn', 'Đánh giá của bạn đã được gửi thành công.');
    } catch (error) {
      if (error.statusCode === 409) {
        markReviewed(reviewTarget);
        onOrderReviewed?.(reviewTarget);
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
        <PurchaseList
          items={purchases}
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
    <ProfileSubScreen title="Sản phẩm đã từng mua" onBack={onBack}>
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
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  orderLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderCode: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productImage: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  emoji: {
    fontSize: 30,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  storeName: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  detailList: {
    marginTop: 8,
    gap: 5,
  },
  detailText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  totalValue: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  actionButtonFull: {
    flex: 1,
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
});
