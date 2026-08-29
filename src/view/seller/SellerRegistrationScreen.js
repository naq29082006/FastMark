import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getShopCategoriesOnBackend } from '../../api/productApi';
import { isValidCategoryId, normalizeCategoryId } from '../../core/utils/categoryId';
import {
  getMySellerVerificationOnBackend,
  submitSellerVerificationOnBackend,
} from '../../api/sellerApi';
import { checkSellerShopUsernameAvailabilityOnBackend } from '../../api/sellerOpsApi';
import { resolveErrorMessage } from '../../core/utils/resolveErrorMessage';
import { logErrorDetails } from '../../core/utils/logger';
import { reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import { showErrorAlert } from '../../core/utils/appAlert';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import { CategoryCombobox } from './SellerProductFormFields';
import SellerLocationPickerScreen from './SellerLocationPickerScreen';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';

const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function normalizeShopUsername(value) {
  return String(value || '').trim().toLowerCase();
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

function normalizeCccdDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function getCccdNumberError(value) {
  const digits = normalizeCccdDigits(value);
  if (!digits) {
    return 'Vui lòng nhập số CCCD/CMND.';
  }
  if (digits.length !== 9 && digits.length !== 12) {
    return 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số.';
  }
  return '';
}

function getCccdFullNameError(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    return 'Vui lòng nhập họ tên trên CCCD.';
  }
  if (name.length > 100) {
    return 'Họ tên không được quá 100 ký tự.';
  }
  return '';
}

export default function SellerRegistrationScreen({ onBack, onSubmitted, initialVerification = null }) {
  const profile = useSelector(selectAuthProfile);
  const [cccdFullName, setCccdFullName] = useState('');
  const [cccdNumber, setCccdNumber] = useState('');
  const [cccdFront, setCccdFront] = useState(null);
  const [cccdBack, setCccdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [anhKD, setBusinessImage] = useState(null);
  const [systemAddress, setSystemAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopUsername, setShopUsername] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isCheckingShopUsername, setIsCheckingShopUsername] = useState(false);
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
        const items = await getShopCategoriesOnBackend();
        if (isMounted) {
          setCategories(items);
        }
      } catch (loadError) {
        if (isMounted) {
          showErrorAlert(loadError.message || 'Không tải được danh mục kinh doanh.');
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

    setSystemAddress(
      initialVerification.addressHeThong ||
        initialVerification.systemAddress ||
        initialVerification.DiaChiHeThong ||
        ''
    );
    setLatitude(
      Number.isFinite(Number(initialVerification.latlong?.lat))
        ? Number(initialVerification.latlong.lat)
        : Number.isFinite(Number(initialVerification.latitude))
          ? Number(initialVerification.latitude)
          : null
    );
    setLongitude(
      Number.isFinite(Number(initialVerification.latlong?.long))
        ? Number(initialVerification.latlong.long)
        : Number.isFinite(Number(initialVerification.longitude))
          ? Number(initialVerification.longitude)
          : null
    );
    setCategoryId((current) =>
      current || normalizeCategoryId(initialVerification.categoryId)
    );
    setShopName((current) => current || initialVerification.shopName || '');
    setShopUsername((current) => current || initialVerification.shopUsername || '');
    setCccdFullName((current) => current || initialVerification.fullName || '');
    setCccdNumber((current) => current || initialVerification.cccdNumber || '');

    if (initialVerification.anhCccdTruoc) {
      setCccdFront({ uri: initialVerification.anhCccdTruoc });
    }
    if (initialVerification.anhCccdSau) {
      setCccdBack({ uri: initialVerification.anhCccdSau });
    }
    if (initialVerification.selfieImage) {
      setSelfie({ uri: initialVerification.selfieImage });
    }
    const existingBusinessImage =
      initialVerification.anhKD || initialVerification.businessDocImage || '';
    if (existingBusinessImage) {
      setBusinessImage({ uri: existingBusinessImage });
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
      showErrorAlert(pickError.message || 'Không chọn được ảnh.');
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
      showErrorAlert(locationError.message || 'Không lấy được vị trí hiện tại.');
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

  async function verifyShopUsernameAvailability(nextUsername) {
    const normalized = normalizeShopUsername(nextUsername);
    const formatError = getShopUsernameFormatError(normalized);
    if (formatError) {
      setFieldErrors((current) => ({ ...current, shopUsername: formatError }));
      return false;
    }

    const initialUsername = normalizeShopUsername(initialVerification?.shopUsername || '');
    if (initialUsername && normalized === initialUsername) {
      setFieldErrors((current) => ({ ...current, shopUsername: '' }));
      return true;
    }

    setIsCheckingShopUsername(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
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

  async function handleSubmit() {
    const fullNameError = getCccdFullNameError(cccdFullName);
    const cccdError = getCccdNumberError(cccdNumber);
    if (fullNameError || cccdError) {
      setFieldErrors((current) => ({
        ...current,
        cccdFullName: fullNameError,
        cccdNumber: cccdError,
      }));
      setError(fullNameError || cccdError);
      return;
    }

    if (!cccdFront || !cccdBack || !selfie) {
      setError('Vui lòng chọn đủ ảnh CCCD mặt trước, mặt sau và ảnh chân dung.');
      return;
    }

    if (
      !hasUsableVerificationImage(cccdFront, initialVerification?.anhCccdTruoc) ||
      !hasUsableVerificationImage(cccdBack, initialVerification?.anhCccdSau) ||
      !hasUsableVerificationImage(selfie, initialVerification?.selfieImage)
    ) {
      setError('Không đọc được ảnh. Vui lòng chọn lại ảnh trước khi gửi.');
      return;
    }

    if (!systemAddress.trim()) {
      setError('Vui lòng chọn vị trí trên bản đồ để lấy địa chỉ hệ thống.');
      return;
    }

    if (!String(shopName || '').trim() || String(shopName).trim().length < 2) {
      setError('Tên gian hàng phải từ 2 ký tự trở lên.');
      return;
    }

    const usernameFormatError = getShopUsernameFormatError(shopUsername);
    if (usernameFormatError || fieldErrors.shopUsername || isCheckingShopUsername) {
      setError(usernameFormatError || fieldErrors.shopUsername || 'Đang kiểm tra username shop...');
      return;
    }

    const usernameOk = await verifyShopUsernameAvailability(shopUsername);
    if (!usernameOk) {
      setError(fieldErrors.shopUsername || 'Username shop không hợp lệ.');
      return;
    }

    const normalizedCategoryId = normalizeCategoryId(categoryId);
    if (!isValidCategoryId(normalizedCategoryId)) {
      setError('Vui lòng chọn danh mục kinh doanh.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Vui lòng lấy vị trí hiện tại trước khi gửi hồ sơ.');
      return;
    }

    if (
      !hasUsableVerificationImage(
        anhKD,
        initialVerification?.anhKD || initialVerification?.businessDocImage
      )
    ) {
      setError('Vui lòng tải ảnh giấy phép kinh doanh hoặc giấy chứng nhận ATTP.');
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
        initialVerification?.anhCccdTruoc
      );
      const backImage = buildVerificationImagePayload(
        cccdBack,
        initialVerification?.anhCccdSau
      );
      const selfieImage = buildVerificationImagePayload(
        selfie,
        initialVerification?.selfieImage
      );
      const anhKDPayload = buildVerificationImagePayload(
        anhKD,
        initialVerification?.anhKD || initialVerification?.businessDocImage
      );

      let verification = null;

      try {
        const response = await submitSellerVerificationOnBackend({
          idToken,
          payload: {
            anhCccdTruocBase64: frontImage.base64,
            cccdFrontMimeType: frontImage.mimeType,
            anhCccdTruocUrl: frontImage.existingUrl,
            anhCccdSauBase64: backImage.base64,
            cccdBackMimeType: backImage.mimeType,
            anhCccdSauUrl: backImage.existingUrl,
            selfieImageBase64: selfieImage.base64,
            selfieMimeType: selfieImage.mimeType,
            selfieImageUrl: selfieImage.existingUrl,
            anhKDBase64: anhKDPayload.base64,
            anhKDMimeType: anhKDPayload.mimeType,
            anhKDUrl: anhKDPayload.existingUrl,
            fullName: String(cccdFullName).trim().replace(/\s+/g, ' '),
            cccdNumber: normalizeCccdDigits(cccdNumber),
            systemAddress: systemAddress.trim(),
            addressHeThong: systemAddress.trim(),
            categoryId: normalizedCategoryId,
            shopName: String(shopName).trim(),
            shopUsername: normalizeShopUsername(shopUsername),
            latlong: { lat: latitude, long: longitude },
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
      showErrorAlert(
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

        <ImagePickerField
          label="Ảnh giấy phép kinh doanh / ATTP"
          value={anhKD}
          onPick={() => handlePickImage(setBusinessImage)}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Họ tên (trên CCCD)</Text>
          <KeyboardAwareTextInput
            value={cccdFullName}
            onChangeText={(value) => {
              setCccdFullName(value);
              setFieldErrors((current) => ({ ...current, cccdFullName: '' }));
              setError('');
            }}
            placeholder="Nhập đúng họ tên trên giấy tờ"
            placeholderTextColor="#94a3b8"
            style={[styles.textInput, fieldErrors.cccdFullName ? styles.textInputError : null]}
          />
          {fieldErrors.cccdFullName ? (
            <Text style={styles.fieldError}>{fieldErrors.cccdFullName}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Số CCCD/CMND</Text>
          <KeyboardAwareTextInput
            value={cccdNumber}
            onChangeText={(value) => {
              setCccdNumber(normalizeCccdDigits(value).slice(0, 12));
              setFieldErrors((current) => ({ ...current, cccdNumber: '' }));
              setError('');
            }}
            keyboardType="number-pad"
            placeholder="9 hoặc 12 chữ số"
            placeholderTextColor="#94a3b8"
            style={[styles.textInput, fieldErrors.cccdNumber ? styles.textInputError : null]}
          />
          {fieldErrors.cccdNumber ? (
            <Text style={styles.fieldError}>{fieldErrors.cccdNumber}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tên gian hàng</Text>
          <KeyboardAwareTextInput
            value={shopName}
            onChangeText={(value) => {
              setShopName(value);
              setError('');
            }}
            placeholder="Tên hiển thị của gian hàng"
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
          />
          <Text style={styles.fieldHint}>Tên công khai trên FastMark, khác họ tên tài khoản.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username gian hàng</Text>
          <KeyboardAwareTextInput
            value={shopUsername}
            onChangeText={(value) => {
              setShopUsername(normalizeShopUsername(value));
              setFieldErrors((current) => ({ ...current, shopUsername: '' }));
              setError('');
            }}
            onBlur={() => {
              if (shopUsername.trim()) {
                verifyShopUsernameAvailability(shopUsername);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="vd: tiembanh_123"
            placeholderTextColor="#94a3b8"
            style={[styles.textInput, fieldErrors.shopUsername ? styles.textInputError : null]}
          />
          {fieldErrors.shopUsername ? (
            <Text style={styles.fieldError}>{fieldErrors.shopUsername}</Text>
          ) : (
            <Text style={styles.fieldHint}>Chỉ chữ thường, số và dấu _. Hiển thị dạng @username.</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Danh mục kinh doanh</Text>
          {isLoadingCategories ? (
            <View style={styles.categoryLoading}>
              <ActivityIndicator color="#076F32" />
              <Text style={styles.fieldHint}>Đang tải danh mục...</Text>
            </View>
          ) : categories.length === 0 ? (
            <Text style={styles.fieldHint}>Chưa có danh mục. Vui lòng liên hệ admin.</Text>
          ) : (
            <>
              <CategoryCombobox
                categories={categories}
                value={categoryId}
                showDetails
                onChange={(value) => {
                  setCategoryId(normalizeCategoryId(value));
                  setError('');
                }}
              />
            </>
          )}
        </View>

        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>Địa chỉ gian hàng</Text>
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
          ) : (
            <Text style={styles.systemAddressLabel}>
              Chọn vị trí trên bản đồ để lấy địa chỉ hệ thống
            </Text>
          )}

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
                <ActivityIndicator color="#076F32" />
              ) : (
                <Text style={styles.pickButtonText}>Vị trí hiện tại</Text>
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
              <Text style={styles.pickButtonText}>Chọn vị trí</Text>
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
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  textInput: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  textInputError: {
    borderColor: '#fca5a5',
  },
  readOnlyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
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
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#b7dfd8',
  },
  pickButtonPressed: {
    opacity: 0.85,
  },
  pickButtonText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
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
    color: '#076F32',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
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
