import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getMySellerVerificationOnBackend } from '../../api/sellerApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function formatCccdNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits || '—';
}

function ReadOnlyImageField({ label, uri }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.previewFrame}>
        {uri ? (
          <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>Chưa có ảnh</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function SellerCccdProfileViewScreen({ verification: verificationProp, onBack }) {
  const [loading, setLoading] = useState(!verificationProp);
  const [verification, setVerification] = useState(verificationProp || null);

  useEffect(() => {
    if (verificationProp) {
      setVerification(verificationProp);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const idToken = await getCurrentUserIdToken();
        const data = await getMySellerVerificationOnBackend(idToken);
        if (!cancelled) {
          setVerification(data?.verification || data || null);
        }
      } catch (loadError) {
        if (!cancelled) {
          showErrorAlert(loadError.message || 'Không tải được hồ sơ CCCD.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [verificationProp]);

  if (loading) {
    return (
      <ProfileSubScreen title="Hồ sơ CCCD" onBack={onBack}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  return (
    <ProfileSubScreen title="Hồ sơ CCCD" onBack={onBack}>
      <View style={styles.content}>
        <Text style={styles.intro}>
          Thông tin CCCD đã gửi khi đăng ký. Bạn chỉ có thể xem, không chỉnh sửa tại đây.
        </Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Họ tên trên CCCD</Text>
          <Text style={styles.metaValue}>{verification?.fullName || '—'}</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Số CCCD/CMND</Text>
          <Text style={styles.metaValue}>{formatCccdNumber(verification?.cccdNumber)}</Text>
        </View>

        <ReadOnlyImageField
          label="Ảnh CCCD mặt trước"
          uri={verification?.anhCccdTruoc || ''}
        />
        <ReadOnlyImageField
          label="Ảnh CCCD mặt sau"
          uri={verification?.anhCccdSau || ''}
        />
        <ReadOnlyImageField
          label="Ảnh chân dung"
          uri={verification?.selfieImage || ''}
        />
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748b',
    marginBottom: 12,
  },
  metaBlock: {
    gap: 4,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
});
