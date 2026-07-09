import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { useDispatch } from 'react-redux';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { submitSellerVerificationOnBackend } from '../../api/sellerApi';
import { reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { loadUserProfile } from '../../viewmodel/auth/authSlice';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import SellerLocationPickerScreen from './SellerLocationPickerScreen';

async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập thư viện ảnh.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]?.base64) {
    return null;
  }

  const asset = result.assets[0];
  return {
    base64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
    uri: asset.uri,
  };
}

function ImagePickerField({ label, value, onPick }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {value?.uri ? (
        <Image source={{ uri: value.uri }} style={styles.previewImage} />
      ) : (
        <View style={styles.previewPlaceholder}>
          <Text style={styles.previewPlaceholderText}>Chưa chọn ảnh</Text>
        </View>
      )}
      <Pressable onPress={onPick} style={({ pressed }) => [styles.pickButton, pressed && styles.pickButtonPressed]}>
        <Text style={styles.pickButtonText}>Chọn ảnh</Text>
      </Pressable>
    </View>
  );
}

export default function SellerRegistrationScreen({ onBack, onSubmitted, initialVerification = null }) {
  const dispatch = useDispatch();
  const [cccdFront, setCccdFront] = useState(null);
  const [cccdBack, setCccdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [address, setAddress] = useState('');
  const [systemAddress, setSystemAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  const isEditing = useMemo(
    () =>
      initialVerification?.status === SELLER_VERIFICATION_STATUS.PENDING ||
      initialVerification?.status === SELLER_VERIFICATION_STATUS.REJECTED,
    [initialVerification?.status]
  );

  const isRejected = initialVerification?.status === SELLER_VERIFICATION_STATUS.REJECTED;

  useEffect(() => {
    if (!initialVerification) {
      return;
    }

    setAddress(initialVerification.address || '');
    setSystemAddress(initialVerification.DiaChiHeThong || '');
    setLatitude(
      Number.isFinite(Number(initialVerification.latitude))
        ? Number(initialVerification.latitude)
        : null
    );
    setLongitude(
      Number.isFinite(Number(initialVerification.longitude))
        ? Number(initialVerification.longitude)
        : null
    );
    setNote(initialVerification.note || '');

    if (initialVerification.cccdFrontImage) {
      setCccdFront({ uri: initialVerification.cccdFrontImage });
    }
    if (initialVerification.cccdBackImage) {
      setCccdBack({ uri: initialVerification.cccdBackImage });
    }
    if (initialVerification.selfieImage) {
      setSelfie({ uri: initialVerification.selfieImage });
    }
  }, [initialVerification]);

  async function handlePickImage(setter) {
    try {
      setError('');
      const image = await pickImage();
      if (image) {
        setter(image);
      }
    } catch (pickError) {
      setError(pickError.message || 'Không chọn được ảnh.');
    }
  }

  async function handleUseCurrentLocation() {
    setIsLocating(true);
    setError('');

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Cần quyền truy cập vị trí để lấy tọa độ.');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;
      setLatitude(nextLat);
      setLongitude(nextLng);

      const displayName = await reverseGeocodeLocation(nextLat, nextLng);
      setSystemAddress(displayName || '');
    } catch (locationError) {
      setError(locationError.message || 'Không lấy được vị trí hiện tại.');
    } finally {
      setIsLocating(false);
    }
  }

  function handleLocationPicked({ latitude: lat, longitude: lng, systemAddress: picked }) {
    setLatitude(lat);
    setLongitude(lng);
    setSystemAddress(picked || '');
    setIsPickingLocation(false);
    setError('');
  }

  async function handleSubmit() {
    if (!cccdFront || !cccdBack || !selfie) {
      setError('Vui lòng chọn đủ ảnh CCCD mặt trước, mặt sau và ảnh chân dung.');
      return;
    }

    if (!address.trim()) {
      setError('Vui lòng nhập địa chỉ.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Vui lòng lấy vị trí hiện tại trước khi gửi hồ sơ.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      await submitSellerVerificationOnBackend({
        idToken,
        payload: {
          cccdFrontImageBase64: cccdFront.base64 || null,
          cccdFrontMimeType: cccdFront.mimeType,
          cccdBackImageBase64: cccdBack.base64 || null,
          cccdBackMimeType: cccdBack.mimeType,
          selfieImageBase64: selfie.base64 || null,
          selfieMimeType: selfie.mimeType,
          address: address.trim(),
          systemAddress: systemAddress.trim(),
          latitude,
          longitude,
          note: note.trim(),
        },
      });

      await dispatch(loadUserProfile()).unwrap();
      setSuccessMessage(
        isEditing
          ? 'Đã cập nhật hồ sơ. Vui lòng chờ admin duyệt.'
          : 'Đã gửi hồ sơ đăng ký. Vui lòng chờ admin duyệt.'
      );
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError.message || 'Không gửi được hồ sơ đăng ký.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPickingLocation) {
    return (
      <SellerLocationPickerScreen
        initialLocation={
          Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude }
            : null
        }
        onBack={() => setIsPickingLocation(false)}
        onConfirm={handleLocationPicked}
      />
    );
  }

  return (
    <ProfileSubScreen title={isEditing ? 'Hồ sơ đăng ký người bán' : 'Đăng ký người bán'} onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {isEditing ? 'Xem và chỉnh sửa hồ sơ' : 'Hồ sơ xác minh người bán'}
        </Text>
        <Text style={styles.subtitle}>
          {isRejected
            ? 'Hồ sơ trước đó bị từ chối. Hãy chỉnh sửa và gửi lại để admin xem xét.'
            : isEditing
              ? 'Bạn có thể cập nhật hồ sơ khi đang chờ duyệt. Sau khi admin duyệt, bạn mới có thể đăng tin.'
              : 'Tải ảnh giấy tờ, chọn địa chỉ và gửi hồ sơ. Sau khi admin duyệt, bạn mới có thể đăng tin bán hàng.'}
        </Text>

        {isRejected && initialVerification?.lyDoTuChoi ? (
          <View style={styles.rejectReasonBox}>
            <Text style={styles.rejectReasonLabel}>Lý do từ chối</Text>
            <Text style={styles.rejectReasonText}>{initialVerification.lyDoTuChoi}</Text>
          </View>
        ) : null}

        <ImagePickerField
          label="Ảnh CCCD mặt trước"
          value={cccdFront}
          onPick={() => handlePickImage(setCccdFront)}
        />
        <ImagePickerField
          label="Ảnh CCCD mặt sau"
          value={cccdBack}
          onPick={() => handlePickImage(setCccdBack)}
        />
        <ImagePickerField
          label="Ảnh chân dung"
          value={selfie}
          onPick={() => handlePickImage(setSelfie)}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Địa chỉ cụ thể</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Số nhà, ngõ, tên đường, phường/xã..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>Vị trí gian hàng</Text>
          <Text style={styles.locationValue}>
            {Number.isFinite(latitude) && Number.isFinite(longitude)
              ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : 'Chưa lấy vị trí'}
          </Text>

          {systemAddress ? (
            <View style={styles.systemAddressBox}>
              <Text style={styles.systemAddressLabel}>Địa chỉ hệ thống</Text>
              <Text style={styles.systemAddressText}>{systemAddress}</Text>
            </View>
          ) : null}

          <View style={styles.locationButtonRow}>
            <Pressable
              disabled={isLocating}
              onPress={handleUseCurrentLocation}
              style={({ pressed }) => [
                styles.pickButton,
                styles.locationButton,
                pressed && styles.pickButtonPressed,
                isLocating && styles.buttonDisabled,
              ]}
            >
              {isLocating ? (
                <ActivityIndicator color="#0d7377" />
              ) : (
                <Text style={styles.pickButtonText}>📍 Vị trí hiện tại</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setIsPickingLocation(true)}
              style={({ pressed }) => [
                styles.pickButton,
                styles.locationButton,
                pressed && styles.pickButtonPressed,
              ]}
            >
              <Text style={styles.pickButtonText}>🗺️ Chọn trên bản đồ</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Thông tin thêm (tuỳ chọn)"
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.noteInput]}
            multiline
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>
              {isEditing ? 'Cập nhật hồ sơ' : 'Gửi hồ sơ đăng ký'}
            </Text>
          )}
        </Pressable>
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 21,
    marginBottom: 16,
  },
  rejectReasonBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  rejectReasonLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  rejectReasonText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 21,
    fontWeight: '600',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#f1f5f9',
  },
  previewPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  pickButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f3f1',
    borderWidth: 1,
    borderColor: '#b7dfd8',
  },
  pickButtonPressed: {
    opacity: 0.85,
  },
  pickButtonText: {
    color: '#0d7377',
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontSize: 15,
  },
  noteInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  locationBox: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  locationValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 10,
  },
  systemAddressBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  systemAddressLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  systemAddressText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 19,
  },
  locationButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  locationButton: {
    flex: 1,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  successText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d7377',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
