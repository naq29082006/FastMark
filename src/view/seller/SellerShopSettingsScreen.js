import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  getSellerShopSettingsOnBackend,
  updateSellerShopSettingsOnBackend,
  uploadShopAvatarOnBackend,
  checkSellerShopUsernameAvailabilityOnBackend,
} from '../../api/sellerOpsApi';
import { syncSellerAccess, applyShopSettingsToProfile } from '../../viewmodel/auth/authSlice';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import { reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import SellerLocationPickerScreen from './SellerLocationPickerScreen';
import TimePickerField from '../shared/components/TimePickerField';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';
import { getAvatarInitial, isRemoteAvatarUrl } from '../../core/utils/avatarInitial';

const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function normalizeShopUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function getShopNameError(value) {
  const normalized = String(value || '').trim();
  if (normalized.length < 2) {
    return 'Tên gian hàng phải có ít nhất 2 ký tự.';
  }
  return '';
}

function getShopUsernameFormatError(value) {
  const normalized = normalizeShopUsername(value);
  if (!normalized) {
    return 'Vui lòng nhập username gian hàng.';
  }
  if (!SHOP_USERNAME_PATTERN.test(normalized)) {
    return 'Username shop: 3-30 ký tự, chữ thường, số và dấu _.';
  }
  return '';
}

function parseAvatarAsset(result) {
  if (result.canceled || !result.assets?.[0]?.base64) {
    return null;
  }
  const asset = result.assets[0];
  return {
    imageBase64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
  };
}

async function pickAvatarFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập thư viện ảnh.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  return parseAvatarAsset(result);
}

async function takeAvatarPhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập camera.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  return parseAvatarAsset(result);
}

function chooseShopAvatarSource() {
  if (Platform.OS === 'web') {
    return pickAvatarFromLibrary();
  }

  return new Promise((resolve, reject) => {
    Alert.alert(
      'Đổi ảnh gian hàng',
      'Bạn muốn chụp ảnh bằng camera hay chọn từ thư viện?',
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => resolve(null) },
        {
          text: 'Chụp ảnh',
          onPress: () => {
            takeAvatarPhoto().then(resolve).catch(reject);
          },
        },
        {
          text: 'Thư viện ảnh',
          onPress: () => {
            pickAvatarFromLibrary().then(resolve).catch(reject);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

const SHOP_AVATAR_PREVIEW_HEIGHT = 148;

function ShopAvatarField({ name, photoUrl, isUploading, onPress }) {
  const previewUrl = isRemoteAvatarUrl(photoUrl) ? String(photoUrl).trim() : '';
  const initial = getAvatarInitial(name || 'Shop');

  return (
    <View style={styles.avatarSection}>
      <Pressable
        onPress={onPress}
        disabled={isUploading}
        style={({ pressed }) => [styles.avatarPreviewPress, pressed && styles.buttonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Đổi ảnh đại diện gian hàng"
      >
        <View style={styles.avatarPreviewFrame}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.avatarPreviewImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPreviewFallback}>
              <Text style={styles.avatarPreviewInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.avatarPreviewOverlay}>
            {isUploading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="camera" size={18} color="#ffffff" />
                <Text style={styles.avatarPreviewOverlayText}>Đổi ảnh</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
      <Text style={styles.avatarHint}>Ảnh đại diện gian hàng</Text>
      <Text style={styles.avatarSubHint}>
        Hiển thị dạng banner ngang trên trang gian hàng — nên dùng ảnh rộng, không cắt tròn.
      </Text>
    </View>
  );
}

export default function SellerShopSettingsScreen({
  onBack,
  onChangePhone,
  onSaved,
  onEditVerification,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  const [systemAddress, setSystemAddress] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopUsername, setShopUsername] = useState('');
  const [shopAvatar, setShopAvatar] = useState('');
  const [initialShopUsername, setInitialShopUsername] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isCheckingShopUsername, setIsCheckingShopUsername] = useState(false);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [description, setDescription] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [depositPercent, setDepositPercent] = useState('0');

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const shop = await getSellerShopSettingsOnBackend(idToken);
      setShopName(shop.shopName || '');
      setShopUsername(shop.shopUsername || '');
      setShopAvatar(shop.shopAvatar || shop.avatar || profile?.shopAvatar || '');
      setInitialShopUsername(normalizeShopUsername(shop.shopUsername || ''));
      setSystemAddress(shop.systemAddress || shop.addressHeThong || '');
      setLatitude(
        Number.isFinite(Number(shop.latlong?.lat))
          ? Number(shop.latlong.lat)
          : Number.isFinite(Number(shop.latitude))
            ? Number(shop.latitude)
            : null
      );
      setLongitude(
        Number.isFinite(Number(shop.latlong?.long))
          ? Number(shop.latlong.long)
          : Number.isFinite(Number(shop.longitude))
            ? Number(shop.longitude)
            : null
      );
      setDescription(shop.description || '');
      setOpenTime(shop.openTime || '08:00');
      setCloseTime(shop.closeTime || '21:00');
      setIsOpen(Number(shop.isOpen) === 1);
      setDepositPercent(String(Math.max(0, Math.min(100, Number(shop.depositPercent) || 0))));
      dispatch(applyShopSettingsToProfile(shop));
    } catch (loadError) {
      Alert.alert('Lỗi', loadError.message || 'Không tải được cài đặt cửa hàng.');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, profile?.shopAvatar]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handlePickShopAvatar() {
    try {
      const picked = await chooseShopAvatarSource();
      if (!picked?.imageBase64) {
        return;
      }

      setIsUploadingAvatar(true);
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const updated = await uploadShopAvatarOnBackend({
        idToken,
        imageBase64: picked.imageBase64,
        mimeType: picked.mimeType,
      });

      const nextAvatar =
        updated?.shopAvatar || updated?.avatar || profile?.shopAvatar || '';
      setShopAvatar(nextAvatar);
      if (updated) {
        dispatch(applyShopSettingsToProfile(updated));
        onSaved?.(updated);
      }
      await dispatch(syncSellerAccess());
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện gian hàng.');
    } catch (pickError) {
      Alert.alert('Lỗi', pickError.message || 'Không upload được ảnh gian hàng.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleUseCurrentLocation() {
    setIsLocating(true);
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
      Alert.alert('Lỗi', locationError.message || 'Không lấy được vị trí hiện tại.');
    } finally {
      setIsLocating(false);
    }
  }

  function handleLocationPicked({ latitude: lat, longitude: lng, systemAddress: picked }) {
    setLatitude(lat);
    setLongitude(lng);
    setSystemAddress(picked || '');
    setIsPickingLocation(false);
  }

  async function handleShopUsernameBlur() {
    const normalized = normalizeShopUsername(shopUsername);
    setShopUsername(normalized);

    const formatError = getShopUsernameFormatError(normalized);
    if (formatError) {
      setFieldErrors((current) => ({ ...current, shopUsername: formatError }));
      return;
    }

    if (normalized === initialShopUsername) {
      setFieldErrors((current) => ({ ...current, shopUsername: '' }));
      return;
    }

    await verifyShopUsernameAvailability(normalized);
  }

  function handleShopNameBlur() {
    const normalized = String(shopName || '').trim();
    setShopName(normalized);
    setFieldErrors((current) => ({ ...current, shopName: getShopNameError(normalized) }));
  }

  async function verifyShopUsernameAvailability(nextUsername) {
    const normalized = normalizeShopUsername(nextUsername);
    const formatError = getShopUsernameFormatError(normalized);
    if (formatError) {
      setFieldErrors((current) => ({ ...current, shopUsername: formatError }));
      return false;
    }
    if (normalized === initialShopUsername) {
      setFieldErrors((current) => ({ ...current, shopUsername: '' }));
      return true;
    }

    setIsCheckingShopUsername(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const result = await checkSellerShopUsernameAvailabilityOnBackend({
        idToken,
        shopUsername: normalized,
      });
      if (!result?.available) {
        setFieldErrors((current) => ({
          ...current,
          shopUsername: result?.message || 'Username shop đã được sử dụng.',
        }));
        return false;
      }
      setFieldErrors((current) => ({ ...current, shopUsername: '' }));
      return true;
    } catch (checkError) {
      setFieldErrors((current) => ({
        ...current,
        shopUsername: checkError.message || 'Không kiểm tra được username shop.',
      }));
      return false;
    } finally {
      setIsCheckingShopUsername(false);
    }
  }

  async function handleSave() {
    const shopNameError = getShopNameError(shopName);
    if (shopNameError) {
      setFieldErrors((current) => ({ ...current, shopName: shopNameError }));
      Alert.alert('Lỗi', shopNameError);
      return;
    }

    const usernameFormatError = getShopUsernameFormatError(shopUsername);
    if (usernameFormatError || fieldErrors.shopUsername || isCheckingShopUsername) {
      Alert.alert('Lỗi', usernameFormatError || fieldErrors.shopUsername || 'Đang kiểm tra username shop...');
      return;
    }

    const usernameOk = await verifyShopUsernameAvailability(shopUsername);
    if (!usernameOk) {
      Alert.alert('Lỗi', fieldErrors.shopUsername || 'Username shop không hợp lệ.');
      return;
    }

    if (!systemAddress.trim()) {
      Alert.alert('Lỗi', 'Vui lòng chọn vị trí cửa hàng để lấy địa chỉ hệ thống.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Lỗi', 'Vui lòng chọn vị trí trên bản đồ hoặc lấy vị trí hiện tại.');
      return;
    }

    const nextOpenTime = String(openTime || '').trim() || '08:00';
    const nextCloseTime = String(closeTime || '').trim() || '21:00';
    const timePattern = /^\d{1,2}:\d{2}$/;
    if (!timePattern.test(nextOpenTime) || !timePattern.test(nextCloseTime)) {
      Alert.alert('Lỗi', 'Giờ mở/đóng cửa phải theo định dạng HH:mm.');
      return;
    }

    const parsedDepositPercent = Number(String(depositPercent).trim());
    if (!Number.isFinite(parsedDepositPercent) || parsedDepositPercent < 0 || parsedDepositPercent > 100) {
      Alert.alert('Lỗi', 'Phần trăm đặt cọc phải từ 0 đến 100.');
      return;
    }
    const normalizedDepositPercent = Math.round(parsedDepositPercent);

    setIsSaving(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const updated = await updateSellerShopSettingsOnBackend({
        idToken,
        payload: {
          shopName: String(shopName).trim(),
          shopUsername: normalizeShopUsername(shopUsername),
          description: description.trim(),
          systemAddress: systemAddress.trim(),
          addressHeThong: systemAddress.trim(),
          latlong: { lat: latitude, long: longitude },
          latitude,
          longitude,
          openTime: nextOpenTime,
          closeTime: nextCloseTime,
          isOpen: isOpen ? 1 : 0,
          depositPercent: normalizedDepositPercent,
        },
      });

      if (updated) {
        setShopName(updated.shopName || shopName);
        setShopUsername(updated.shopUsername || shopUsername);
        setInitialShopUsername(normalizeShopUsername(updated.shopUsername || shopUsername));
        setSystemAddress(updated.systemAddress || updated.addressHeThong || systemAddress);
        setDescription(updated.description || '');
        setOpenTime(updated.openTime || nextOpenTime);
        setCloseTime(updated.closeTime || nextCloseTime);
        setIsOpen(Number(updated.isOpen) === 1);
        setDepositPercent(String(Math.max(0, Math.min(100, Number(updated.depositPercent) || 0))));
        dispatch(applyShopSettingsToProfile(updated));
        onSaved?.(updated);
      } else {
        await loadSettings();
        onSaved?.();
      }

      await dispatch(syncSellerAccess());
      Alert.alert('Thành công', 'Đã lưu cài đặt gian hàng.');
    } catch (saveError) {
      Alert.alert('Lỗi', saveError.message || 'Không lưu được cài đặt.');
    } finally {
      setIsSaving(false);
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

  if (isLoading) {
    return (
      <View style={styles.screenWrap}>
        <ProfileSubScreen title="Chỉnh sửa thông tin gian hàng" onBack={onBack}>
          <View style={styles.centered}>
            <ActivityIndicator color="#076F32" size="large" />
          </View>
        </ProfileSubScreen>
      </View>
    );
  }

  const displayPhone = profile?.shopPhone || profile?.phone || 'Chưa cập nhật';

  return (
    <View style={styles.screenWrap}>
      <ProfileSubScreen title="Chỉnh sửa thông tin gian hàng" onBack={onBack}>
        <View style={styles.card}>
          <ShopAvatarField
            name={shopName || profile?.shopName}
            photoUrl={shopAvatar}
            isUploading={isUploadingAvatar}
            onPress={handlePickShopAvatar}
          />

          <View style={styles.divider} />

          <Field
            label="Tên gian hàng"
            value={shopName}
            onChangeText={(value) => {
              setShopName(value);
              setFieldErrors((current) => ({ ...current, shopName: '' }));
            }}
            onFocus={() => setFieldErrors((current) => ({ ...current, shopName: '' }))}
            onBlur={handleShopNameBlur}
            placeholder="Tên hiển thị công khai"
            error={fieldErrors.shopName}
            hint="Tối thiểu 2 ký tự."
            identity
          />
          <Field
            label="Username"
            value={shopUsername}
            onChangeText={(value) => {
              setShopUsername(normalizeShopUsername(value));
              setFieldErrors((current) => ({ ...current, shopUsername: '' }));
            }}
            onFocus={() => {
              setFieldErrors((current) => ({ ...current, shopUsername: '' }));
              const normalized = normalizeShopUsername(shopUsername);
              if (!normalized || normalized === initialShopUsername) {
                return;
              }
              if (getShopUsernameFormatError(normalized)) {
                return;
              }
              verifyShopUsernameAvailability(normalized);
            }}
            onBlur={handleShopUsernameBlur}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="vd: tiembanh_123"
            error={fieldErrors.shopUsername}
            hint="3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới."
            identity
            spaced
          />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>SĐT</Text>
          <Text style={styles.readOnlyValue}>{displayPhone}</Text>
          <Pressable
            onPress={onChangePhone}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Đổi SĐT</Text>
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Địa chỉ</Text>
          <View style={styles.locationBox}>
            <Text style={styles.locationLabel}>Vị trí cửa hàng</Text>
            <Text style={styles.locationValue}>
              {Number.isFinite(latitude) && Number.isFinite(longitude)
                ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                : 'Chưa chọn vị trí'}
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
                  styles.locationButton,
                  pressed && styles.buttonPressed,
                  isLocating && styles.buttonDisabled,
                ]}
              >
                {isLocating ? (
                  <ActivityIndicator color="#076F32" />
                ) : (
                  <Text style={styles.locationButtonText}>Vị trí hiện tại</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setIsPickingLocation(true)}
                style={({ pressed }) => [styles.locationButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.locationButtonText}>Chọn trên bản đồ</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.divider} />

          <Field
            label="Mô tả cửa hàng"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Giờ hoạt động</Text>
          <TimePickerField
            label="Giờ mở cửa"
            value={openTime}
            onChange={setOpenTime}
            placeholder="08:00"
            minuteInterval={5}
            compact
          />
          <View style={styles.divider} />
          <TimePickerField
            label="Giờ đóng cửa"
            value={closeTime}
            onChange={setCloseTime}
            placeholder="21:00"
            minuteInterval={5}
            compact
          />
          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Đang mở cửa</Text>
              <Text style={styles.switchHint}>Bật/tắt trạng thái mở cửa hiện tại</Text>
            </View>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ false: '#cbd5e1', true: '#7dd3c7' }}
              thumbColor={isOpen ? '#076F32' : '#f8fafc'}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Giữ hàng & đặt cọc</Text>
          <Field
            label="Phần trăm đặt cọc (%)"
            value={depositPercent}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '');
              if (!digits) {
                setDepositPercent('');
                return;
              }
              setDepositPercent(String(Math.min(100, Number(digits))));
            }}
            placeholder="0"
            keyboardType="number-pad"
            hint="Nhập từ 0 đến 100. 0 = không yêu cầu đặt cọc."
          />
        </View>

        <View style={styles.saveSection}>
        <Pressable
          disabled={isSaving || isCheckingShopUsername}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.buttonPressed,
            (isSaving || isCheckingShopUsername) && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.saveButtonText}>
            {isSaving
              ? 'Đang lưu...'
              : isCheckingShopUsername
                ? 'Đang kiểm tra...'
                : 'Lưu thay đổi'}
          </Text>
        </Pressable>
        {onEditVerification ? (
          <Pressable
            onPress={onEditVerification}
            style={({ pressed }) => [styles.secondarySaveButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondarySaveButtonText}>Chỉnh sửa hồ sơ xác thực</Text>
          </Pressable>
        ) : null}
      </View>
      </ProfileSubScreen>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onFocus,
  onBlur,
  multiline,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  error,
  hint,
  identity = false,
  spaced = false,
}) {
  return (
    <View style={[styles.field, spaced && styles.fieldSpaced]}>
      <Text style={[styles.label, identity && styles.identityLabel]}>{label}</Text>
      <KeyboardAwareTextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[
          identity ? styles.identityInput : styles.input,
          multiline && styles.textArea,
          error ? styles.inputError : null,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
  },
  centered: { alignItems: 'center', paddingVertical: 40 },
  avatarSection: {
    alignItems: 'stretch',
    paddingVertical: 4,
  },
  avatarPreviewPress: {
    alignSelf: 'stretch',
  },
  avatarPreviewFrame: {
    width: '100%',
    height: SHOP_AVATAR_PREVIEW_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#076F32',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
  },
  avatarPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  avatarPreviewInitial: {
    fontSize: 56,
    fontWeight: '800',
    color: '#ffffff',
  },
  avatarPreviewOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  avatarPreviewOverlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  avatarSubHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  readOnlyValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  secondaryButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#076F32', fontWeight: '800' },
  field: { marginBottom: 0 },
  fieldSpaced: { marginTop: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  identityLabel: { color: '#334155' },
  identityInput: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontSize: 15,
  },
  input: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#fca5a5',
  },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  fieldError: {
    marginTop: 6,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldHint: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  locationBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 4 },
  locationValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  systemAddressBox: { marginTop: 10 },
  systemAddressLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  systemAddressText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  locationButtonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  locationButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b7dfd8',
  },
  locationButtonText: { color: '#076F32', fontWeight: '800', fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: { flex: 1, paddingRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  switchHint: { fontSize: 12, color: '#64748b', marginTop: 2 },
  saveSection: {
    paddingBottom: 24,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  secondarySaveButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#076F32',
  },
  secondarySaveButtonText: { color: '#076F32', fontWeight: '800', fontSize: 15 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
});
