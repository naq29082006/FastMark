import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getMySellerVerificationOnBackend } from '../../api/sellerApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';

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

function ReadOnlyField({ label, value }) {
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || '—'}</Text>
    </View>
  );
}

function ReadOnlyImageField({ label, uri, portrait = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.previewFrame, portrait && styles.previewFramePortrait]}>
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

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function SellerRegistrationProfileViewScreen({ verification: verificationProp, onBack }) {
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
          showErrorAlert(loadError.message || 'Không tải được hồ sơ đăng ký.');
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
      <ProfileSubScreen title="Hồ sơ đăng ký" onBack={onBack} scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  const attpMeta = verification?.attpMeta || {};
  const issuedAt = attpMeta.issuedAt || verification?.attpIssuedAt || '';
  const expiresAt = attpMeta.expiresAt || verification?.attpExpiresAt || '';
  const latitude = Number(verification?.latlong?.lat ?? verification?.latitude);
  const longitude = Number(verification?.latlong?.long ?? verification?.longitude);
  const systemAddress =
    verification?.addressHeThong ||
    verification?.systemAddress ||
    verification?.DiaChiHeThong ||
    verification?.address ||
    '';

  return (
    <ProfileSubScreen title="Hồ sơ đăng ký" onBack={onBack} scroll={false}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Toàn bộ thông tin bạn đã gửi khi đăng ký gian hàng. Bạn chỉ có thể xem, không chỉnh sửa
          khi hồ sơ đang chờ duyệt.
        </Text>

        <ReadOnlyField label="Gửi lúc" value={formatSubmittedAt(verification?.submittedAt)} />

        <SectionTitle>Thông tin CCCD</SectionTitle>
        <ReadOnlyField label="Họ tên trên CCCD" value={verification?.fullName} />
        <ReadOnlyField label="Số CCCD/CMND" value={formatCccdNumber(verification?.cccdNumber)} />
        <ReadOnlyImageField label="Ảnh CCCD mặt trước" uri={verification?.anhCccdTruoc || ''} />
        <ReadOnlyImageField label="Ảnh CCCD mặt sau" uri={verification?.anhCccdSau || ''} />
        <ReadOnlyImageField label="Ảnh chân dung" uri={verification?.selfieImage || ''} />

        <SectionTitle>Thông tin gian hàng</SectionTitle>
        <ReadOnlyField label="Tên gian hàng" value={verification?.shopName} />
        <ReadOnlyField
          label="Username gian hàng"
          value={verification?.shopUsername ? `@${verification.shopUsername}` : '—'}
        />
        <ReadOnlyField label="Danh mục kinh doanh" value={verification?.categoryName} />

        <SectionTitle>Địa chỉ gian hàng</SectionTitle>
        <ReadOnlyField
          label="Tọa độ"
          value={
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : '—'
          }
        />
        <ReadOnlyField label="Địa chỉ hệ thống" value={systemAddress} />

        <SectionTitle>Giấy phép kinh doanh / ATTP</SectionTitle>
        <ReadOnlyImageField
          label="Ảnh giấy phép"
          uri={verification?.anhKD || ''}
          portrait
        />
        <ReadOnlyField label="Ngày cấp" value={issuedAt} />
        <ReadOnlyField label="Ngày hết hạn" value={expiresAt} />
      </KeyboardAwareScrollView>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 4,
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
    fontSize: 15,
    fontWeight: '600',
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
  previewFramePortrait: {
    alignSelf: 'center',
    width: '72%',
    maxWidth: 280,
    aspectRatio: 3 / 4,
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
