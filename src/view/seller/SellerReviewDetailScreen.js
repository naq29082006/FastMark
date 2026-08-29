import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getSellerReviewDetailOnBackend } from '../../api/sellerOpsApi';
import { submitReportOnBackend } from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { showErrorAlert } from '../../core/utils/appAlert';
import { formatPrice } from '../../core/utils/productFormat';
import { getOrderCodeValue } from '../../core/utils/orderCode';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import AvatarBadge from '../shared/components/AvatarBadge';
import ReportComposeModal from '../shared/components/ReportComposeModal';
import ReportSheet from '../shared/components/ReportSheet';
import StarRating from '../store/components/StarRating';
import SubScreenHeader from '../shared/components/SubScreenHeader';

const REVIEW_REPORT_REASONS = [
  'Ngôn từ xúc phạm',
  'Đánh giá không đúng sự thật',
  'Thông tin sai lệch',
  'Spam / quảng cáo',
  'Khác',
];

function PaymentRow({ label, value, valueStyle }) {
  return (
    <View style={styles.paymentRow}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={[styles.paymentValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function formatReviewDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('vi-VN');
}

function getReviewImages(review) {
  if (Array.isArray(review?.images) && review.images.length > 0) {
    return review.images
      .map((image) => image.imageUrl || image.ImageUrl || image)
      .filter((uri) => typeof uri === 'string' && uri);
  }
  const single = review?.imageUrl || review?.image_url || '';
  return single ? [single] : [];
}

function getProductName(review) {
  return (
    String(
      review?.product?.productName ||
        review?.productName ||
        review?.product_name ||
        'Sản phẩm'
    ).trim() || 'Sản phẩm'
  );
}

function getProductThumbnail(review) {
  return (
    review?.product?.thumbnail ||
    review?.productThumbnail ||
    review?.product?.imageUrl ||
    ''
  );
}

function getVariantName(review) {
  return String(review?.variant?.variantName || review?.variantName || '').trim();
}

export default function SellerReviewDetailScreen({
  reviewId,
  initialItem = null,
  shopName = '',
  onBack,
  onOpenBuyer,
  onOpenProduct,
}) {
  const resolvedId = String(reviewId || initialItem?.id || initialItem?._id || '').trim();
  const [review, setReview] = useState(initialItem);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [reportVisible, setReportVisible] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const insets = useScreenInsets();

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!resolvedId) {
      showErrorAlert('Thiếu mã đánh giá.');
      setIsLoading(false);
      return;
    }
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      const data = await getSellerReviewDetailOnBackend(idToken, resolvedId);
      if (data) {
        setReview(data);
      }
    } catch (loadError) {
      if (!silent) {
        showErrorAlert(loadError.message || 'Không tải được chi tiết đánh giá.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [resolvedId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function handleReportReason(reason) {
    setReportVisible(false);
    setReportReason(reason);
    setComposeVisible(true);
  }

  async function handleReportComposeSubmit({ title, content, images }) {
    if (!review?.id && !review?._id) {
      Alert.alert('Lỗi', 'Không xác định được đánh giá cần báo cáo.');
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }
      const reviewerName =
        review.buyer?.fullName ||
        review.userName ||
        review.user_name ||
        review.fullName ||
        'Khách hàng';

      await submitReportOnBackend({
        idToken,
        reportType: 1,
        reviewId: String(review.id || review._id),
        reviewerName,
        shopId: review.shopId || review.storeId || '',
        shopName: shopName || review.storeName || '',
        title,
        content,
        images,
      });

      setComposeVisible(false);
      setReportReason('');
      Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn. Chúng tôi đã ghi nhận tố cáo.');
    } catch (submitError) {
      Alert.alert('Không gửi được báo cáo', submitError.message || 'Vui lòng thử lại sau.');
    }
  }

  if (isLoading && !review) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Chi tiết đánh giá" onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!review) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Chi tiết đánh giá" onBack={onBack} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Không tìm thấy đánh giá.</Text>
        </View>
      </View>
    );
  }

  const buyerName =
    review.buyer?.fullName || review.userName || review.user_name || 'Khách hàng';
  const buyerId = String(review.buyer?.id || review.userId || '').trim();
  const productId = String(review.product?.id || review.productId || '').trim();
  const productName = getProductName(review);
  const productThumbnail = getProductThumbnail(review);
  const variantName = getVariantName(review);
  const reservationId = String(review.reservationId || '').trim();
  const orderCodeLabel = reservationId
    ? getOrderCodeValue(reservationId)
    : getOrderCodeValue(review.id);
  const qty = Number(review.quantity) || 0;
  const unitPrice =
    review.unitPrice != null
      ? Number(review.unitPrice)
      : review.agreedPrice != null
        ? Number(review.agreedPrice)
        : 0;
  const totalAmount = Number(review.totalAmount) || (unitPrice && qty ? unitPrice * qty : 0);
  const depositAmount = Number(review.depositAmount) || 0;
  const depositPercent = Math.max(0, Math.min(100, Number(review.depositPercent) || 0));
  const cashDue =
    review.cashDue != null
      ? Number(review.cashDue)
      : Math.max(0, totalAmount - depositAmount);
  const reviewImages = getReviewImages(review);

  function handleOpenBuyer() {
    if (!buyerId) {
      Alert.alert('Thông báo', 'Không xác định được hồ sơ khách hàng.');
      return;
    }
    onOpenBuyer?.({ userId: buyerId, fullName: buyerName });
  }

  function handleOpenProduct() {
    if (!productId) {
      Alert.alert('Thông báo', 'Không xác định được sản phẩm.');
      return;
    }
    onOpenProduct?.({ productId, productName });
  }

  function handleCallBuyer() {
    const phone = String(review.buyer?.phone || '').trim();
    if (!phone) {
      Alert.alert('Thông báo', 'Khách chưa cung cấp số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không mở được ứng dụng gọi điện.');
    });
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Chi tiết đánh giá" onBack={onBack} />
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: insets.nestedScrollPaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.orderCode} numberOfLines={1}>
            Đơn hàng: {orderCodeLabel}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THÔNG TIN KHÁCH HÀNG</Text>
          <View style={styles.buyerRow}>
            <Pressable
              style={({ pressed }) => [styles.buyerTapArea, pressed && styles.tapAreaPressed]}
              onPress={handleOpenBuyer}
              accessibilityRole="button"
              accessibilityLabel={`Xem hồ sơ ${buyerName}`}
            >
              <AvatarBadge name={buyerName} uri={review.buyer?.avatar || review.avatar || ''} size={52} />
              <View style={styles.buyerInfo}>
                <Text style={styles.buyerName} numberOfLines={1}>
                  {buyerName}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={handleCallBuyer}
              style={({ pressed }) => [styles.callIconBtn, pressed && styles.callIconBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Gọi khách"
              hitSlop={8}
            >
              <Ionicons name="call" size={20} color="#076F32" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THÔNG TIN SẢN PHẨM</Text>
          <Pressable
            style={({ pressed }) => [styles.productRow, pressed && styles.tapAreaPressed]}
            onPress={handleOpenProduct}
            accessibilityRole="button"
            accessibilityLabel={`Xem sản phẩm ${productName}`}
          >
            <View style={styles.productThumbWrap}>
              {productThumbnail ? (
                <Image source={{ uri: productThumbnail }} style={styles.productThumb} />
              ) : (
                <Text style={styles.productThumbEmoji}>📦</Text>
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {productName}
              </Text>
              {variantName ? (
                <Text style={styles.productMeta}>Loại: {variantName}</Text>
              ) : null}
              <View style={styles.productPriceRow}>
                <Text style={styles.productMeta}>Giá: {formatPrice(unitPrice)}</Text>
                <Text style={styles.productQtyMark}>x{qty || 1}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>CHI TIẾT THANH TOÁN</Text>
          <PaymentRow label="Tổng tiền hàng:" value={formatPrice(totalAmount)} />
          <PaymentRow
            label={`Đặt cọc ${depositPercent}%:`}
            value={formatPrice(depositAmount)}
          />
          <PaymentRow
            label="Thanh toán khi nhận hàng:"
            value={formatPrice(cashDue)}
            valueStyle={styles.paymentValueDanger}
          />

          <View style={styles.divider} />

          <View style={styles.reviewHeadingRow}>
            <Text style={styles.sectionHeading}>NỘI DUNG ĐÁNH GIÁ</Text>
            <Pressable
              onPress={() => setReportVisible(true)}
              style={({ pressed }) => [styles.reportBtn, pressed && styles.tapAreaPressed]}
              accessibilityRole="button"
              accessibilityLabel="Tố cáo đánh giá"
              hitSlop={8}
            >
              <Ionicons name="flag-outline" size={16} color="#b45309" />
              <Text style={styles.reportBtnText}>Tố cáo</Text>
            </Pressable>
          </View>

          <View style={styles.reviewBlock}>
            <View style={styles.ratingRow}>
              <StarRating rating={Number(review.rating) || 0} size={16} />
              <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt || review.created_at)}</Text>
            </View>
            {review.comment ? (
              <Text style={styles.comment}>{review.comment}</Text>
            ) : (
              <Text style={styles.commentMuted}>Không có nội dung.</Text>
            )}
            {reviewImages.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.reviewPhotos}
              >
                {reviewImages.map((uri, index) => (
                  <Image
                    key={`${review.id}-photo-${index}`}
                    source={{ uri }}
                    style={styles.reviewPhoto}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        title="Tố cáo đánh giá"
        reasons={REVIEW_REPORT_REASONS}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportReason}
      />
      <ReportComposeModal
        visible={composeVisible}
        headerTitle="Chi tiết tố cáo đánh giá"
        reasonTitle={reportReason}
        onClose={() => {
          setComposeVisible(false);
          setReportReason('');
        }}
        onSubmit={handleReportComposeSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buyerTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  tapAreaPressed: {
    opacity: 0.82,
  },
  buyerInfo: {
    flex: 1,
    minWidth: 0,
  },
  buyerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  callIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconBtnPressed: {
    opacity: 0.8,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  productThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  productThumbEmoji: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 21,
  },
  productMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  productQtyMark: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  paymentLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentValueDanger: {
    color: '#dc2626',
  },
  reviewHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 0,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  reviewBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  comment: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '600',
  },
  commentMuted: {
    marginTop: 8,
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  reviewPhotos: {
    marginTop: 10,
  },
  reviewPhoto: {
    width: 88,
    height: 88,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
});
