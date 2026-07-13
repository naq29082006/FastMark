import { Alert } from 'react-native';

import { submitBuyerReviewOnBackend } from '../../api/reviewApi';
import { markOrderAsReviewed } from '../../hooks/useReviewedOrderCodes';
import { getCurrentUserIdToken } from '../../repository/authRepository';

import { RESERVATION_STATUS } from '../../constants/sellerOrders';

export const PURCHASE_REVIEW_STATUSES = ['Hoàn thành', 'Đã giao'];

const RESERVATION_STATUS_LABEL = {
  [RESERVATION_STATUS.PENDING]: 'Chờ xác nhận',
  [RESERVATION_STATUS.CONFIRMED]: 'Đã xác nhận',
  [RESERVATION_STATUS.COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.CANCELLED]: 'Đã hủy',
  active: 'Đang giữ',
  picked_up: 'Đã nhận',
  expired: 'Hết hạn',
};

export function getReservationStatusLabel(status) {
  return RESERVATION_STATUS_LABEL[status] || status || 'Đang xử lý';
}

export function canReviewPurchaseOrder(order) {
  const status = String(order?.status || '').trim();
  return PURCHASE_REVIEW_STATUSES.includes(status);
}

export function canReviewReservationOrder(order) {
  return (
    order?.status === RESERVATION_STATUS.COMPLETED ||
    order?.status === 'picked_up'
  );
}

export function canReviewOrder(order) {
  if (!order) {
    return false;
  }
  if (order.type === 'purchase' || order.purchasedAt) {
    return canReviewPurchaseOrder(order);
  }
  return canReviewReservationOrder(order);
}

export function canShowReviewButton(order, reviewedOrderCodes) {
  if (!canReviewOrder(order)) {
    return false;
  }
  const key = String(order?.orderCode || order?.id || '').trim();
  return Boolean(key && !reviewedOrderCodes?.has(key));
}

export function isOrderAlreadyReviewed(order, reviewedOrderCodes) {
  const key = String(order?.orderCode || order?.id || '').trim();
  return Boolean(key && reviewedOrderCodes?.has(key));
}

export function getPurchaseStatusLabel(status) {
  return status || 'Đang xử lý';
}

export async function submitShopReview({
  storeId,
  storeName,
  productName,
  orderCode,
  rating,
  comment,
  imageUrl,
}) {
  if (!rating || Number(rating) < 1) {
    throw new Error('Vui lòng chọn số sao trước khi gửi đánh giá.');
  }

  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để gửi đánh giá.');
  }

  try {
    const review = await submitBuyerReviewOnBackend({
      idToken,
      storeId,
      storeName,
      productName,
      orderCode,
      rating,
      comment,
      imageUrl,
    });

    markOrderAsReviewed({ orderCode });
    return review;
  } catch (error) {
    if (error.statusCode === 409) {
      markOrderAsReviewed({ orderCode });
    }
    throw error;
  }
}

export async function submitShopReviewWithFeedback(params) {
  try {
    const review = await submitShopReview(params);
    Alert.alert('Cảm ơn bạn', 'Đánh giá đã được gửi lên hệ thống.');
    return review;
  } catch (error) {
    Alert.alert('Lỗi', error.message || 'Không gửi được đánh giá.');
    throw error;
  }
}
