import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { scanCompleteSellerReservationOnBackend } from '../../api/sellerOpsApi';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import ProfileSubScreen from '../profile/ProfileSubScreen';

export default function SellerPickupScanScreen({ onBack, onCompleted }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef('');
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const completeWithCode = useCallback(
    async (raw) => {
      const code = String(raw || '').trim();
      if (!code || lockRef.current) {
        return;
      }

      lockRef.current = true;
      setIsSubmitting(true);
      try {
        const idToken = await getCurrentUserIdToken();
        const reservation = await scanCompleteSellerReservationOnBackend(idToken, code);
        const productName = reservation?.product?.productName || 'đơn hàng';
        Alert.alert('Hoàn thành', `Đã xác nhận nhận hàng: ${productName}`, [
          {
            text: 'OK',
            onPress: () => {
              onCompleted?.(reservation);
              onBack?.();
            },
          },
        ]);
      } catch (error) {
        Alert.alert('Không hoàn thành được', error.message || 'Mã không hợp lệ.');
        lastScanRef.current = '';
        lockRef.current = false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onBack, onCompleted]
  );

  function handleBarcodeScanned({ data }) {
    const payload = String(data || '').trim();
    if (!payload || payload === lastScanRef.current || lockRef.current) {
      return;
    }
    lastScanRef.current = payload;
    completeWithCode(payload);
  }

  function handleManualSubmit() {
    completeWithCode(manualCode);
  }

  return (
    <ProfileSubScreen title="Quét đơn nhận hàng" onBack={onBack}>
      <View style={styles.wrap}>
        <Text style={styles.hint}>
          Quét QR trên đơn của khách (trạng thái Đã xác nhận) để báo hoàn thành khi họ đến lấy.
        </Text>

        <View style={styles.cameraCard}>
          {!permission ? (
            <View style={styles.cameraPlaceholder}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : !permission.granted ? (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.permissionText}>Cần quyền camera để quét mã.</Text>
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
              <View style={styles.scanFrame} pointerEvents="none" />
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

        <Text style={styles.orLabel}>Hoặc nhập mã nhận hàng</Text>
        <TextInput
          value={manualCode}
          onChangeText={(value) => setManualCode(value.toUpperCase())}
          placeholder="VD: A3K9P2"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          editable={!isSubmitting}
        />
        <Pressable
          style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
          onPress={handleManualSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryBtnText}>Xác nhận hoàn thành</Text>
          )}
        </Pressable>
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 24,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    marginBottom: 14,
    fontWeight: '600',
  },
  cameraCard: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  permissionText: {
    color: '#e2e8f0',
    textAlign: 'center',
    fontWeight: '600',
  },
  scanFrame: {
    position: 'absolute',
    top: '22%',
    left: '16%',
    right: '16%',
    bottom: '22%',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 16,
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
  orLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
