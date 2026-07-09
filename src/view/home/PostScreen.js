import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import { ROLE_SELLER } from '../../model/profileModel';
import {
  selectSellerAccessSyncedAt,
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { LockIcon } from '../shared/components/LockIcon';
import SellerPostForm from './SellerPostForm';

function PendingPostScreen({ onViewProfile }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Hồ sơ người bán đang chờ duyệt</Text>
      </View>

      <View style={[styles.card, styles.lockedCard]}>
        <View style={styles.statusBadgePending}>
          <Text style={styles.statusBadgeText}>Đang chờ duyệt</Text>
        </View>
        <View style={styles.lockIconWrap}>
          <LockIcon color="#3a7d74" size={88} />
        </View>
        <Text style={styles.lockedTitle}>Chưa thể đăng tin</Text>
        <Text style={styles.lockedText}>
          Hồ sơ đăng ký người bán của bạn đang được admin xem xét. Sau khi được duyệt và cấp quyền người bán, bạn mới có thể đăng tin.
        </Text>
        <Pressable
          onPress={onViewProfile}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Xem và chỉnh sửa hồ sơ</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RejectedPostScreen({ reason, onViewProfile }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Hồ sơ người bán bị từ chối</Text>
      </View>

      <View style={[styles.card, styles.lockedCard]}>
        <View style={styles.statusBadgeRejected}>
          <Text style={styles.statusBadgeText}>Bị từ chối</Text>
        </View>
        <View style={styles.lockIconWrap}>
          <LockIcon color="#3a7d74" size={88} />
        </View>
        <Text style={styles.lockedTitle}>Chưa thể đăng tin</Text>
        <Text style={styles.lockedText}>
          {reason || 'Hồ sơ đăng ký người bán chưa đạt yêu cầu. Vui lòng chỉnh sửa và gửi lại.'}
        </Text>
        <Pressable
          onPress={onViewProfile}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Chỉnh sửa và gửi lại hồ sơ</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LockedPostScreen({ onStartSellerRegister }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Tính năng dành cho người bán hàng</Text>
      </View>

      <View style={[styles.card, styles.lockedCard]}>
        <View style={styles.lockIconWrap}>
          <LockIcon color="#3a7d74" size={88} />
        </View>
        <Text style={styles.lockedTitle}>Tính năng đang khóa</Text>
        <Text style={styles.lockedText}>
          Bạn cần đăng ký người bán và được admin duyệt để mở khóa tính năng đăng tin.
        </Text>
        <Pressable
          onPress={onStartSellerRegister}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Đăng ký người bán hàng</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PostScreen({ onStartSellerRegister, onProductCreated }) {
  const role = useSelector(selectUserRole);
  const verification = useSelector(selectSellerVerification);
  const syncedAt = useSelector(selectSellerAccessSyncedAt);

  if (!syncedAt) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loadingText}>Đang kiểm tra quyền đăng tin...</Text>
      </View>
    );
  }

  if (Number(role) === ROLE_SELLER) {
    return <SellerPostForm onProductCreated={onProductCreated} />;
  }

  if (verification?.status === SELLER_VERIFICATION_STATUS.PENDING) {
    return <PendingPostScreen onViewProfile={onStartSellerRegister} />;
  }

  if (verification?.status === SELLER_VERIFICATION_STATUS.REJECTED) {
    return (
      <RejectedPostScreen
        reason={verification.lyDoTuChoi}
        onViewProfile={onStartSellerRegister}
      />
    );
  }

  return <LockedPostScreen onStartSellerRegister={onStartSellerRegister} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    lineHeight: 22,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  lockedCard: {
    paddingTop: 32,
    paddingBottom: 28,
  },
  statusBadgePending: {
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statusBadgeRejected: {
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statusBadgeText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  lockIconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockedText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0d7377',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
