import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { validateSellerPickupQrOnBackend } from '../../api/sellerOpsApi';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { parsePickupQrPayload } from '../../core/utils/pickupQr';
import SubScreenHeader from '../shared/components/SubScreenHeader';

export default function SellerBuyerQrScanScreen({ onBack, onValidated }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef('');
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScannedPayload = useCallback(
    async (rawPayload) => {
      if (!rawPayload || lockRef.current) {
        return;
      }

      const reservationId = parsePickupQrPayload(rawPayload);
      if (!reservationId) {
        Alert.alert('Mã không hợp lệ', 'Không đọc được mã QR đơn hàng. Vui lòng thử lại.');
        lastScanRef.current = '';
        return;
      }

      lockRef.current = true;
      setIsSubmitting(true);
      try {
        const idToken = await getCurrentUserIdToken();
        const reservation = await validateSellerPickupQrOnBackend(idToken, {
          qrPayload: rawPayload,
        });
        onValidated?.(reservation);
      } catch (scanError) {
        Alert.alert('Không quét được', scanError.message || 'Mã QR không hợp lệ.');
        lastScanRef.current = '';
        lockRef.current = false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onValidated]
  );

  function handleBarcodeScanned({ data }) {
    const payload = String(data || '').trim();
    if (!payload || payload === lastScanRef.current || lockRef.current || isSubmitting) {
      return;
    }
    lastScanRef.current = payload;
    handleScannedPayload(payload);
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Quét mã giao hàng" onBack={onBack} />

      <View style={styles.body}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Bước 1/2 · Quét QR trên điện thoại khách</Text>
        </View>

        <View style={styles.cameraCard}>
          {!permission ? (
            <View style={styles.cameraPlaceholder}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : !permission.granted ? (
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="camera-outline" size={42} color="#94a3b8" />
              <Text style={styles.permissionText}>Cần quyền camera để quét mã QR.</Text>
              <Pressable style={styles.secondaryBtn} onPress={requestPermission}>
                <Text style={styles.secondaryBtnText}>Cấp quyền camera</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={isSubmitting ? undefined : handleBarcodeScanned}
              />
              <View style={styles.scanFrame} pointerEvents="none">
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
              {isSubmitting ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color="#ffffff" size="large" />
                  <Text style={styles.loadingText}>Đang mở đơn hàng...</Text>
                </View>
              ) : null}
              <Pressable
                style={styles.torchBtn}
                onPress={() => setTorch((current) => !current)}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-outline'}
                  size={20}
                  color="#ffffff"
                />
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={20} color="#076F32" />
          <Text style={styles.tipText}>
            Khách mở đơn hàng → bấm <Text style={styles.tipStrong}>Mã nhận hàng</Text> → đưa màn
            hình QR cho bạn quét. Sau khi quét xong sẽ sang bước xác nhận giao hàng.
          </Text>
        </View>
      </View>
    </View>
  );
}

const CORNER = 22;
const CORNER_BORDER = 4;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  cameraCard: {
    flex: 1,
    minHeight: 360,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  camera: { flex: 1 },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  permissionText: {
    color: '#e2e8f0',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  scanFrame: {
    position: 'absolute',
    top: '18%',
    left: '12%',
    right: '12%',
    bottom: '18%',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#ffffff',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderBottomRightRadius: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  torchBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    fontWeight: '500',
  },
  tipStrong: {
    color: '#0f172a',
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  secondaryBtnText: {
    color: t.primary,
    fontWeight: '800',
  },
});
