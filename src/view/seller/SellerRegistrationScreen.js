import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getProductCategoriesOnBackend } from '../../api/productApi';
import { isValidCategoryId, normalizeCategoryId } from '../../core/utils/categoryId';
import {
  getMySellerVerificationOnBackend,
  submitSellerVerificationOnBackend,
} from '../../api/sellerApi';
import { resolveErrorMessage } from '../../core/utils/resolveErrorMessage';
import { logErrorDetails } from '../../core/utils/logger';
import { reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import { CategoryCombobox } from './SellerProductFormFields';
import SellerLocationPickerScreen from './SellerLocationPickerScreen';

function parseImageAsset(result) {
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    base64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
    uri: asset.uri,
  };
}

async function pickImageFromLibrary() {
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

  return parseImageAsset(result);
}

async function takePhotoWithCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập camera.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });

  return parseImageAsset(result);
}

function chooseImageSource() {
  if (Platform.OS === 'web') {
    return pickImageFromLibrary();
  }

  return new Promise((resolve, reject) => {
    Alert.alert(
      'Chọn ảnh',
      'Bạn muốn chụp ảnh bằng camera hay chọn từ thư viện?',
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => resolve(null) },
        {
          text: 'Chụp ảnh',
          onPress: () => {
            takePhotoWithCamera().then(resolve).catch(reject);
          },
        },
        {
          text: 'Thư viện ảnh',
          onPress: () => {
            pickImageFromLibrary().then(resolve).catch(reject);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
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
        <Text style={styles.pickButtonText}>Chọn ảnh / Chụp camera</Text>
      </Pressable>
    </View>
  );
}

function resolveRemoteImageUrl(image, fallbackUrl = '') {
  if (image?.uri && String(image.uri).startsWith('http')) {
    return image.uri;
  }

  return fallbackUrl || null;
}

function hasUsableVerificationImage(image, fallbackUrl = '') {
  return Boolean(image?.base64 || resolveRemoteImageUrl(image, fallbackUrl));
}

function buildVerificationImagePayload(image, fallbackUrl = '') {
  const remoteUrl = resolveRemoteImageUrl(image, fallbackUrl);

  return {
    base64: image?.base64 || null,
    mimeType: image?.mimeType || 'image/jpeg',
    existingUrl: image?.base64 ? null : remoteUrl,
  };
}

async function recoverSubmittedVerification(idToken) {
  const latest = await getMySellerVerificationOnBackend(idToken);
  const verification = latest?.verification || null;

  if (
    verification?.status === SELLER_VERIFICATION_STATUS.PENDING ||
    verification?.status === SELLER_VERIFICATION_STATUS.REJECTED
  ) {
    return verification;
  }

  return null;
}

export default function SellerRegistrationScreen({ onBack, onSubmitted, initialVerification = null }) {
  const [cccdFront, setCccdFront] = useState(null);
  const [cccdBack, setCccdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [address, setAddress] = useState('');
  const [systemAddress, setSystemAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopUsername, setShopUsername] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
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
    let isMounted = true;

    async function loadCategories() {
      setIsLoadingCategories(true);
      try {
        const items = await getProductCategoriesOnBackend();
        if (isMounted) {
          setCategories(items);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Không tải được danh mục kinh doanh.');
          setCategories([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialVerification?.id) {
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
    setShopName(initialVerification.shopName || '');
    setShopUsername(initialVerification.shopUsername || '');
    setCategoryId((current) =>
      current || normalizeCategoryId(initialVerification.categoryId)
    );
    setShopDescription(initialVerification.shopDescription || '');

    if (initialVerification.cccdFrontImage) {
      setCccdFront({ uri: initialVerification.cccdFrontImage });
    }
    if (initialVerification.cccdBackImage) {
      setCccdBack({ uri: initialVerification.cccdBackImage });
    }
    if (initialVerification.selfieImage) {
      setSelfie({ uri: initialVerification.selfieImage });
    }
  }, [initialVerification?.id]);

  async function handlePickImage(setter) {
    try {
      setError('');
      const image = await chooseImageSource();
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

    if (
      !hasUsableVerificationImage(cccdFront, initialVerification?.cccdFrontImage) ||
      !hasUsableVerificationImage(cccdBack, initialVerification?.cccdBackImage) ||
      !hasUsableVerificationImage(selfie, initialVerification?.selfieImage)
    ) {
      setError('Không đọc được ảnh. Vui lòng chọn lại ảnh trước khi gửi.');
      return;
    }

    if (!address.trim()) {
      setError('Vui lòng nhập địa chỉ.');
      return;
    }

    const normalizedShopName = shopName.trim().replace(/\s+/g, ' ');
    if (normalizedShopName.length < 2 || normalizedShopName.length > 80) {
      setError('Tên gian hàng phải từ 2-80 ký tự.');
      return;
    }

    const normalizedShopUsername = shopUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedShopUsername)) {
      setError('Tên shop phải từ 3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới.');
      return;
    }

    const normalizedCategoryId = normalizeCategoryId(categoryId);
    if (!isValidCategoryId(normalizedCategoryId)) {
      setError('Vui lòng chọn danh mục kinh doanh.');
      return;
    }

    if (!shopDescription.trim()) {
      setError('Vui lòng nhập giới thiệu shop.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Vui lòng lấy vị trí hiện tại trước khi gửi hồ sơ.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    let idToken = null;

    try {
      idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const frontImage = buildVerificationImagePayload(
        cccdFront,
        initialVerification?.cccdFrontImage
      );
      const backImage = buildVerificationImagePayload(
        cccdBack,
        initialVerification?.cccdBackImage
      );
      const selfieImage = buildVerificationImagePayload(
        selfie,
        initialVerification?.selfieImage
      );

      let verification = null;

      try {
        const response = await submitSellerVerificationOnBackend({
          idToken,
          payload: {
            cccdFrontImageBase64: frontImage.base64,
            cccdFrontMimeType: frontImage.mimeType,
            cccdFrontImageUrl: frontImage.existingUrl,
            cccdBackImageBase64: backImage.base64,
            cccdBackMimeType: backImage.mimeType,
            cccdBackImageUrl: backImage.existingUrl,
            selfieImageBase64: selfieImage.base64,
            selfieMimeType: selfieImage.mimeType,
            selfieImageUrl: selfieImage.existingUrl,
            address: address.trim(),
            systemAddress: systemAddress.trim(),
            shopName: normalizedShopName,
            shopUsername: normalizedShopUsername,
            categoryId: normalizedCategoryId,
            shopDescription: shopDescription.trim(),
            latitude,
            longitude,
          },
        });

        verification = response?.verification || null;
      } catch (submitError) {
        const statusCode = Number(submitError?.statusCode) || 0;
        const shouldRecover = statusCode >= 500 || !statusCode;

        if (shouldRecover) {
          verification = await recoverSubmittedVerification(idToken);
        }

        if (!verification) {
          throw submitError;
        }
      }

      setSuccessMessage(
        isEditing
          ? 'Đã cập nhật hồ sơ. Vui lòng chờ admin duyệt.'
          : 'Đã gửi hồ sơ đăng ký. Vui lòng chờ admin duyệt.'
      );

      try {
        await onSubmitted?.(verification);
      } catch (navigationError) {
        logErrorDetails('SellerRegistration', 'onSubmitted failed', navigationError);
      }
    } catch (submitError) {
      logErrorDetails('SellerRegistration', 'submit failed', submitError);
      setError(
        resolveErrorMessage(submitError, 'Không gửi được hồ sơ đăng ký.')
      );
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
          <Text style={styles.label}>Tên cụ thể gian hàng</Text>
          <TextInput
            value={shopName}
            onChangeText={setShopName}
            placeholder="vd: Nông sản Vy, Bánh mì Huỳnh Hoa..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <Text style={styles.fieldHint}>Tên hiển thị công khai của gian hàng (2-80 ký tự).</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username shop</Text>
          <TextInput
            value={shopUsername}
            onChangeText={(value) => setShopUsername(value.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="vd: shop_rau_sach"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <Text style={styles.fieldHint}>Chỉ dùng chữ thường, số và dấu gạch dưới (3-30 ký tự).</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Danh mục kinh doanh</Text>
          {isLoadingCategories ? (
            <View style={styles.categoryLoading}>
              <ActivityIndicator color="#0d7377" />
              <Text style={styles.fieldHint}>Đang tải danh mục...</Text>
            </View>
          ) : categories.length === 0 ? (
            <Text style={styles.fieldHint}>Chưa có danh mục. Vui lòng liên hệ admin.</Text>
          ) : (
            <>
              <CategoryCombobox
                categories={categories}
                value={categoryId}
                onChange={(value) => {
                  setCategoryId(normalizeCategoryId(value));
                  setError('');
                }}
              />
              {isValidCategoryId(categoryId) ? (
                <Text style={styles.fieldHint}>
                  Đã chọn: {categories.find((item) => item.id === categoryId)?.categoryName || 'Danh mục'}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Giới thiệu shop</Text>
          <TextInput
            value={shopDescription}
            onChangeText={setShopDescription}
            placeholder="Mô tả ngắn về gian hàng, sản phẩm chính, phong cách bán hàng..."
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.noteInput]}
            multiline
          />
        </View>

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
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  categoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
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
