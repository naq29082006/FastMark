import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function formatSubmittedAt(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('vi-VN');
}

export default function SellerVerificationStatusScreen({
  verification,
  onBack,
  onEdit,
  onViewAttp,
  onViewRegistration,
}) {
  const isPending = verification?.status === SELLER_VERIFICATION_STATUS.PENDING;
  const isRejected = verification?.status === SELLER_VERIFICATION_STATUS.REJECTED;
  const isPendingReReview = Boolean(verification?.isPendingReReview);

  const screenTitle = isPendingReReview
    ? 'Giấy phép chờ duyệt'
    : isPending
      ? 'Hồ sơ chờ duyệt'
      : 'Hồ sơ đăng ký';

  const statusTitle = isPendingReReview
    ? 'Giấy phép mới đang được xem xét'
    : isPending
      ? 'Hồ sơ đăng ký đang được xem xét'
      : 'Hồ sơ chưa được duyệt';

  const statusDescription = isPendingReReview
    ? 'Gian hàng tạm ẩn trên bản đồ và danh sách sản phẩm cho đến khi admin duyệt giấy phép mới. Bạn có thể xem lại nội dung đã gửi.'
    : isPending
      ? 'Admin đang duyệt hồ sơ đăng ký của bạn. Gian hàng sẽ hiển thị sau khi được phê duyệt.'
      : verification?.lyDoTuChoi ||
        'Hồ sơ đăng ký người bán chưa đạt yêu cầu. Vui lòng chỉnh sửa và gửi lại.';

  const badgeLabel = isPendingReReview ? 'Đang chờ duyệt lại' : isPending ? 'Đang chờ duyệt' : 'Bị từ chối';

  return (
    <ProfileSubScreen title={screenTitle} onBack={onBack}>
      <View style={styles.card}>
        <View style={[styles.badge, isRejected ? styles.badgeRejected : styles.badgePending]}>
          <Text style={[styles.badgeText, isRejected && styles.badgeTextRejected]}>{badgeLabel}</Text>
        </View>

        <Text style={styles.title}>{statusTitle}</Text>
        <Text style={styles.description}>{statusDescription}</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Gửi lúc</Text>
          <Text style={styles.metaValue}>
            {formatSubmittedAt(
              isPendingReReview ? verification?.reReviewSubmittedAt : verification?.submittedAt
            )}
          </Text>
        </View>

        {isPendingReReview && verification?.reReviewChangeReason ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Lý do thay đổi</Text>
            <Text style={styles.metaValue}>{verification.reReviewChangeReason}</Text>
          </View>
        ) : null}

        {!isPendingReReview && verification?.shopName ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Tên shop</Text>
            <Text style={styles.metaValue}>{verification.shopName}</Text>
          </View>
        ) : null}

        {!isPendingReReview && verification?.shopUsername ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Username shop</Text>
            <Text style={styles.metaValue}>@{verification.shopUsername}</Text>
          </View>
        ) : null}

        {!isPendingReReview && verification?.categoryName ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Danh mục kinh doanh</Text>
            <Text style={styles.metaValue}>{verification.categoryName}</Text>
          </View>
        ) : null}

        {!isPendingReReview &&
        (verification?.addressHeThong ||
          verification?.systemAddress ||
          verification?.DiaChiHeThong ||
          verification?.address) ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Địa chỉ</Text>
            <Text style={styles.metaValue}>
              {verification.addressHeThong ||
                verification.systemAddress ||
                verification.DiaChiHeThong ||
                verification.address}
            </Text>
          </View>
        ) : null}

        {isPending && isPendingReReview && onViewAttp ? (
          <Pressable
            onPress={onViewAttp}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Xem giấy phép</Text>
          </Pressable>
        ) : null}

        {isPending && !isPendingReReview && onViewRegistration ? (
          <Pressable
            onPress={onViewRegistration}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Xem hồ sơ đăng ký</Text>
          </Pressable>
        ) : null}

        {isRejected && onEdit ? (
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Chỉnh sửa và gửi lại</Text>
          </Pressable>
        ) : null}
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgePending: {
    backgroundColor: '#fef3c7',
  },
  badgeRejected: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  badgeTextRejected: {
    color: '#b91c1c',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
  },
  metaBlock: {
    gap: 4,
    paddingTop: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#076F32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
