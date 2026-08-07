import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { showErrorAlert } from '../../core/utils/appAlert';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function buildQrImageUrl(payload, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    payload
  )}`;
}

/**
 * QR cố định của gian hàng — khách mở đơn và quét mã này để xác nhận đã nhận hàng.
 */
export default function SellerShopQrScreen({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [qrPayload, setQrPayload] = useState('');
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [shopName, setShopName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      const shop = await getSellerShopSettingsOnBackend(idToken);
      const shopId = String(shop?.id || shop?.shopId || '');
      const payload =
        shop?.qrPayload ||
        (shopId ? JSON.stringify({ shopId }) : '');
      setQrPayload(payload);
      setQrCodeValue(shopId);
      setShopName(shop?.shopName || shop?.name || 'Gian hàng');
    } catch (loadError) {
      showErrorAlert(loadError.message || 'Không tải được QR gian hàng.');
      setQrPayload('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ProfileSubScreen title="QR nhận hàng" onBack={onBack}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} size="large" />
        </View>
      ) : !qrPayload ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Không tải được QR gian hàng.</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>{shopName}</Text>
          <Text style={styles.hint}>
            Đưa mã này cho khách khi họ đến lấy hàng. Khách mở đơn → Quét QR → xác nhận đã nhận
            hàng.
          </Text>

          {qrPayload ? (
            <View style={styles.qrCard}>
              <Image source={{ uri: buildQrImageUrl(qrPayload) }} style={styles.qrImage} />
            </View>
          ) : (
            <Text style={styles.hint}>Chưa có mã QR.</Text>
          )}

          <Text style={styles.codeLabel}>Mã shop</Text>
          <Text style={styles.codeValue} selectable>
            {qrCodeValue || '—'}
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              onPress={async () => {
                if (!qrPayload) return;
                try {
                  await Linking.openURL(buildQrImageUrl(qrPayload, 512));
                } catch {
                  Alert.alert('Lỗi', 'Không mở được liên kết tải QR.');
                }
              }}
            >
              <Text style={styles.actionText}>Tải QR</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={async () => {
                if (!qrPayload) return;
                try {
                  await Share.share({
                    message: `FastMark — QR nhận hàng\n${shopName}\n${qrPayload}`,
                    title: 'QR nhận hàng',
                  });
                } catch {
                  Alert.alert('Lỗi', 'Không chia sẻ được QR.');
                }
              }}
            >
              <Text style={styles.actionText}>Chia sẻ</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  content: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrImage: {
    width: 280,
    height: 280,
  },
  codeLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: t.primarySoft,
  },
  actionText: {
    color: t.primaryDark,
    fontWeight: '800',
    fontSize: 14,
  },
  errorText: {
    color: t.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.primarySoft,
  },
  retryText: {
    color: t.primaryDark,
    fontWeight: '800',
  },
});
