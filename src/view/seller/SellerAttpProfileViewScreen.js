import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getMySellerVerificationOnBackend } from '../../api/sellerApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function ReadOnlyDateField({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readonlyDateBox}>
        <Text style={value ? styles.readonlyDateValue : styles.readonlyDatePlaceholder}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

export default function SellerAttpProfileViewScreen({ verification: verificationProp, onBack }) {
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
          showErrorAlert(loadError.message || 'Không tải được giấy phép.');
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
      <ProfileSubScreen title="Giấy phép đã gửi" onBack={onBack}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  const attpMeta = verification?.attpMeta || {};
  const issuedAt = attpMeta.issuedAt || verification?.attpIssuedAt || '';
  const expiresAt = attpMeta.expiresAt || verification?.attpExpiresAt || '';
  const changeReason = verification?.reReviewChangeReason || '';

  return (
    <ProfileSubScreen title="Giấy phép đã gửi" onBack={onBack}>
      <View style={styles.content}>
        <Text style={styles.intro}>
          Giấy phép kinh doanh hoặc chứng nhận ATTP mới đang chờ admin duyệt. Bạn chỉ có thể xem
          nội dung đã gửi.
        </Text>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Đang chờ duyệt lại</Text>
          <Text style={styles.noticeBody}>
            Admin sẽ xem xét giấy phép mới trước khi gian hàng hoạt động trở lại.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Hình ảnh giấy phép</Text>
          <View style={styles.previewFrame}>
            {verification?.anhKD ? (
              <Image source={{ uri: verification.anhKD }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderText}>Chưa có ảnh</Text>
              </View>
            )}
          </View>
        </View>

        <ReadOnlyDateField label="Ngày cấp" value={issuedAt} />
        <ReadOnlyDateField label="Ngày hết hạn" value={expiresAt} />

        {changeReason ? (
          <View style={styles.field}>
            <Text style={styles.label}>Lý do thay đổi</Text>
            <View style={styles.readonlyDateBox}>
              <Text style={styles.reasonText}>{changeReason}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
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
  noticeBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#c2410c',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9a3412',
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
    alignSelf: 'center',
    width: '72%',
    maxWidth: 280,
    aspectRatio: 3 / 4,
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
  readonlyDateBox: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  readonlyDateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  readonlyDatePlaceholder: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#0f172a',
  },
});
