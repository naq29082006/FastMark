import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  canShowReviewButton,
  getPurchaseStatusLabel,
  isOrderAlreadyReviewed,
  submitShopReview,
} from '../../core/utils/orderReview';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import { getReservationStatusLabel } from '../../core/utils/orderReview';
import { ReviewedBadge, ReviewNowButton } from '../shared/components/ReviewOrderAction';
import ShopReviewModal from '../shared/components/ShopReviewModal';
import ProfileSubScreen from './ProfileSubScreen';

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString('vi-VN')}đ`;
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

export default function OrderDetailScreen({
  order,
  onBack,
  onOpenStore,
  reviewedOrderCodes: externalReviewedCodes,
  onOrderReviewed,
}) {
  const [reviewVisible, setReviewVisible] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const { reviewedOrderCodes: internalReviewedCodes, markReviewed } =
    useReviewedOrderCodes(localRefreshKey);

  if (!order) {
    return null;
  }

  const reviewedOrderCodes = externalReviewedCodes || internalReviewedCodes;
  const isPurchase = order.type === 'purchase';
  const title = isPurchase ? 'Chi tiết đơn hàng' : 'Chi tiết phiếu giữ hàng';
  const showReviewButton = canShowReviewButton(order, reviewedOrderCodes);
  const alreadyReviewed = isOrderAlreadyReviewed(order, reviewedOrderCodes);

  async function handleSubmitReview({ rating, comment, imageUrl }) {
    try {
      await submitShopReview({
        storeId: order.storeId,
        storeName: order.storeName,
        productName: order.productName,
        orderCode: order.orderCode || order.id,
        rating,
        comment,
        imageUrl,
      });
      setReviewVisible(false);
      markReviewed(order);
      onOrderReviewed?.(order);
      setLocalRefreshKey((value) => value + 1);
      Alert.alert('Cảm ơn bạn', 'Đánh giá của bạn đã được gửi thành công.');
    } catch (error) {
      if (error.statusCode === 409) {
        markReviewed(order);
        onOrderReviewed?.(order);
        setReviewVisible(false);
        Alert.alert('Thông báo', 'Bạn đã đánh giá đơn hàng này rồi.');
        return;
      }
      Alert.alert('Không gửi được đánh giá', error.message || 'Vui lòng thử lại.');
    }
  }

  return (
    <ProfileSubScreen title={title} onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.label}>{isPurchase ? 'Mã đơn hàng' : 'Mã phiếu giữ'}</Text>
        <Text style={styles.code}>{order.orderCode || order.id}</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Sản phẩm</Text>
          <Text style={styles.rowValue}>{order.productName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Gian hàng</Text>
          <Text style={styles.rowValue}>{order.storeName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Số lượng</Text>
          <Text style={styles.rowValue}>{order.quantity}</Text>
        </View>

        {isPurchase ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Trạng thái</Text>
              <Text style={styles.rowValue}>{getPurchaseStatusLabel(order.status)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Đơn giá</Text>
              <Text style={styles.rowValue}>{formatPrice(order.price)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Tổng tiền</Text>
              <Text style={[styles.rowValue, styles.total]}>
                {formatPrice(Number(order.price || 0) * Number(order.quantity || 0))}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Ngày mua</Text>
              <Text style={styles.rowValue}>{formatDateTime(order.purchasedAt)}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Trạng thái</Text>
              <Text style={styles.rowValue}>{getReservationStatusLabel(order.status)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Giữ lúc</Text>
              <Text style={styles.rowValue}>{formatDateTime(order.reservedAt)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Hết hạn</Text>
              <Text style={styles.rowValue}>{formatDateTime(order.expiresAt)}</Text>
            </View>
          </>
        )}
      </View>

      {showReviewButton ? (
        <ReviewNowButton onPress={() => setReviewVisible(true)} />
      ) : null}

      {alreadyReviewed ? <ReviewedBadge /> : null}

      <Pressable
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
        onPress={() => order.storeId && onOpenStore?.(order.storeId)}
      >
        <Text style={styles.actionButtonText}>Đến gian hàng</Text>
      </Pressable>

      <ShopReviewModal
        visible={reviewVisible}
        storeName={order.storeName}
        productName={order.productName}
        onClose={() => setReviewVisible(false)}
        onSubmit={handleSubmitReview}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  code: {
    marginTop: 4,
    marginBottom: 16,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rowLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  total: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900',
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
  },
});
