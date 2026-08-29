import { Alert } from 'react-native';

import { submitBuyerReviewOnBackend } from '../../api/reviewApi';
import { markOrderAsReviewed, getReviewForOrder } from '../../hooks/useReviewedOrderCodes';
import { getCurrentUserIdToken } from '../../repository/authRepository';

import {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  isDeliveredReservationStatus,
} from '../../constants/sellerOrders';

export const PURCHASE_REVIEW_STATUSES = ['Hoàn thành', 'Đã giao'];

const RESERVATION_STATUS_LABEL = {
  ...RESERVATION_STATUS_LABELS,
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
  const reasonCode = String(order?.reasonCode || order?.cancelType || '').trim();
  if (reasonCode === 'buyer_forfeit') {
    return false;
  }
  return (
    isDeliveredReservationStatus(order?.status) ||
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

export function hasOrderReviewSubmitted(order) {
  return order?.hasReviewed === true;
}

export function hasActiveReviewOnOrder(order, reviewsByOrderId = null) {
  if (order?.buyerReview?.id) {
    return true;
  }
  if (order?.hasActiveReview === true || order?.buyerReviewId) {
    return true;
  }
  if (reviewsByOrderId) {
    const review = getReviewForOrder(order, reviewsByOrderId);
    return Boolean(review?.id);
  }
  return false;
}

export function canShowReviewButton(order, reviewedOrderCodes) {
  if (order?.canReview === false) {
    return false;
  }
  if (!canReviewOrder(order)) {
    return false;
  }
  if (hasOrderReviewSubmitted(order)) {
    return false;
  }
  if (hasActiveReviewOnOrder(order)) {
    return false;
  }
  const key = String(order?.orderCode || order?.id || order?.reservationId || '').trim();
  if (order?.hasReviewed === undefined && key && reviewedOrderCodes?.has(key)) {
    return false;
  }
  return true;
}

/** Còn bản ghi Review active trong DB theo reservationId → hiện「Xem đánh giá」. */
export function canViewExistingReview(order, reviewsByOrderId) {
  return hasActiveReviewOnOrder(order, reviewsByOrderId);
}

/** Khiếu nại và đánh giá độc lập — đã đánh giá vẫn có thể khiếu nại. */
export function canShowComplaintButton(_order, _reviewsByOrderId = null) {
  return true;
}

export function buildViewReviewPayload(order, reviewsByOrderId, extras = {}) {
  const mergeExtras = (review) => ({
    ...review,
    storeName: extras.storeName || order?.storeName || review.storeName || '',
    productName:
      extras.productName ||
      order?.product?.productName ||
      order?.productName ||
      review.productName ||
      '',
    shopId: extras.shopId || (order?.shopId ? String(order.shopId) : review.shopId || ''),
  });

  if (order?.buyerReview?.id) {
    return mergeExtras(order.buyerReview);
  }

  const stored = getReviewForOrder(order, reviewsByOrderId);
  if (stored?.id) {
    return mergeExtras(stored);
  }

  const reviewId = String(order?.buyerReviewId || '').trim();
  const reservationId = String(
    order?.id || order?.reservationId || order?.orderCode || ''
  ).trim();
  if (!reviewId && !reservationId) {
    return null;
  }

  return mergeExtras({
    id: reviewId || undefined,
    reservationId,
    orderCode: reservationId,
  });
}

export function isOrderAlreadyReviewed(order, reviewedOrderCodes, reviewsByOrderId = null) {
  if (reviewsByOrderId) {
    return canViewExistingReview(order, reviewsByOrderId);
  }
  const key = String(order?.orderCode || order?.id || order?.reservationId || '').trim();
  return Boolean(key && reviewedOrderCodes?.has(key));
}

export function getPurchaseStatusLabel(status) {
  return status || 'Đang xử lý';
}

export async function submitShopReview({
  productId,
  reservationId,
  shopId,
  storeId,
  orderCode,
  rating,
  comment,
  images,
  imageUrl,
}) {
  if (!rating || Number(rating) < 1) {
    throw new Error('Vui lòng chọn số sao trước khi gửi đánh giá.');
  }

  const resolvedProductId = String(productId || '').trim();
  if (!resolvedProductId) {
    throw new Error('Thiếu sản phẩm để đánh giá.');
  }

  const resolvedReservationId = String(reservationId || orderCode || '').trim();
  if (!resolvedReservationId) {
    throw new Error('Thiếu đơn hàng để đánh giá.');
  }

  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để gửi đánh giá.');
  }

  const resolvedShopId = shopId || storeId;

  try {
    const review = await submitBuyerReviewOnBackend({
      idToken,
      productId: resolvedProductId,
      reservationId: resolvedReservationId,
      shopId: resolvedShopId,
      rating,
      comment,
      images,
      imageUrl,
    });

    markOrderAsReviewed(
      { orderCode: resolvedReservationId, id: resolvedReservationId },
      review
    );
    return review;
  } catch (error) {
    if (error.statusCode === 409) {
      markOrderAsReviewed({ orderCode: resolvedReservationId, id: resolvedReservationId });
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
