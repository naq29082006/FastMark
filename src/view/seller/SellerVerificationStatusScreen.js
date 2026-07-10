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
}) {
  const isPending = verification?.status === SELLER_VERIFICATION_STATUS.PENDING;
  const isRejected = verification?.status === SELLER_VERIFICATION_STATUS.REJECTED;

  return (
    <ProfileSubScreen
      title={isPending ? 'Hồ sơ chờ duyệt' : 'Hồ sơ đăng ký'}
      onBack={onBack}
    >
      <View style={styles.card}>
        <View style={[styles.badge, isRejected ? styles.badgeRejected : styles.badgePending]}>
          <Text style={[styles.badgeText, isRejected && styles.badgeTextRejected]}>
            {isPending ? 'Đang chờ duyệt' : 'Bị từ chối'}
          </Text>
        </View>

        <Text style={styles.title}>
          {isPending
            ? 'Hồ sơ đang được xem xét'
            : 'Hồ sơ chưa được duyệt'}
        </Text>

        <Text style={styles.description}>
          {isPending
            ? 'Admin đang duyệt hồ sơ của bạn. Bạn có thể xem lại và chỉnh sửa trước khi được phê duyệt.'
            : verification?.lyDoTuChoi ||
              'Hồ sơ đăng ký người bán chưa đạt yêu cầu. Vui lòng chỉnh sửa và gửi lại.'}
        </Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Gửi lúc</Text>
          <Text style={styles.metaValue}>{formatSubmittedAt(verification?.submittedAt)}</Text>
        </View>

        {verification?.shopName ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Tên shop</Text>
            <Text style={styles.metaValue}>{verification.shopName}</Text>
          </View>
        ) : null}

        {verification?.shopUsername ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Username shop</Text>
            <Text style={styles.metaValue}>@{verification.shopUsername}</Text>
          </View>
        ) : null}

        {verification?.categoryName ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Danh mục kinh doanh</Text>
            <Text style={styles.metaValue}>{verification.categoryName}</Text>
          </View>
        ) : null}

        {verification?.address ? (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Địa chỉ</Text>
            <Text style={styles.metaValue}>{verification.address}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.primaryButtonText}>
            {isPending ? 'Xem và chỉnh sửa' : 'Chỉnh sửa và gửi lại'}
          </Text>
        </Pressable>
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
    backgroundColor: '#0f766e',
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
