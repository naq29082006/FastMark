import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  getMySellerVerificationOnBackend,
  submitSellerVerificationReReviewOnBackend,
} from '../../api/sellerApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import DatePickerField from '../shared/components/DatePickerField';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

const PENDING_REVIEW_MESSAGE =
  'Hồ sơ xác thực của gian hàng đang được xét duyệt lại. Bạn tạm thời không thể bán hàng cho đến khi được phê duyệt.';

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
  return parseImageAsset(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    })
  );
}

async function takePhotoWithCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập camera.');
  }
  return parseImageAsset(
    await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    })
  );
}

function chooseImageSource() {
  if (Platform.OS === 'web') {
    return pickImageFromLibrary();
  }
  return new Promise((resolve, reject) => {
    Alert.alert('Chọn ảnh', 'Bạn muốn chụp ảnh bằng camera hay chọn từ thư viện?', [
      { text: 'Huỷ', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Chụp ảnh', onPress: () => takePhotoWithCamera().then(resolve).catch(reject) },
      { text: 'Thư viện ảnh', onPress: () => pickImageFromLibrary().then(resolve).catch(reject) },
    ]);
  });
}

function ImagePickerField({ label, value, onPick }) {
  const previewUri =
    value?.uri || (typeof value === 'string' && value.startsWith('http') ? value : '') || '';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.previewImage} />
      ) : (
        <View style={styles.previewPlaceholder}>
          <Text style={styles.previewPlaceholderText}>Chưa chọn ảnh</Text>
        </View>
      )}
      <Pressable onPress={onPick} style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}>
        <Text style={styles.pickButtonText}>Chọn ảnh / Chụp camera</Text>
      </Pressable>
    </View>
  );
}

function buildVerificationImagePayload(localImage, existingUrl = '') {
  if (localImage?.base64) {
    return {
      base64: localImage.base64,
      mimeType: localImage.mimeType || 'image/jpeg',
      existingUrl: '',
    };
  }
  const url = String(existingUrl || localImage?.uri || '').trim();
  if (url.startsWith('http')) {
    return { base64: '', mimeType: '', existingUrl: url };
  }
  return null;
}

export default function SellerVerificationReReviewScreen({ onBack, onSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [attpImage, setAttpImage] = useState(null);
  const [extraDocs, setExtraDocs] = useState([]);
  const [error, setError] = useState('');

  const attpExistingUrl = useMemo(() => verification?.anhKD || '', [verification]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idToken = await getCurrentUserIdToken();
        const data = await getMySellerVerificationOnBackend(idToken);
        const row = data?.verification || data;
        if (cancelled) {
          return;
        }
        setVerification(row);
        const meta = row?.attpMeta || {};
        setLicenseNumber(meta.licenseNumber || '');
        setIssuedAt(meta.issuedAt || '');
        setExpiresAt(meta.expiresAt || '');
        if (row?.anhKD) {
          setAttpImage({ uri: row.anhKD });
        }
        if (Array.isArray(meta.extraDocUrls)) {
          setExtraDocs(meta.extraDocUrls.map((url) => ({ uri: url, existingUrl: url })));
        }
      } catch (loadError) {
        if (!cancelled) {
          showErrorAlert(loadError.message || 'Không tải được hồ sơ xác thực.');
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
  }, []);

  async function handlePickAttp() {
    try {
      const asset = await chooseImageSource();
      if (asset) {
        setAttpImage(asset);
        setError('');
      }
    } catch (pickError) {
      showErrorAlert(pickError.message || 'Không chọn được ảnh.');
    }
  }

  async function handlePickExtraDoc(index = null) {
    try {
      const asset = await chooseImageSource();
      if (!asset) {
        return;
      }
      setExtraDocs((current) => {
        if (index == null || index >= current.length) {
          return [...current, asset].slice(0, 5);
        }
        const next = [...current];
        next[index] = asset;
        return next;
      });
    } catch (pickError) {
      showErrorAlert(pickError.message || 'Không chọn được ảnh.');
    }
  }

  async function handleSubmit() {
    if (verification?.isPendingReReview) {
      showErrorAlert(PENDING_REVIEW_MESSAGE);
      return;
    }

    const attpPayload = buildVerificationImagePayload(attpImage, attpExistingUrl);
    if (!attpPayload) {
      setError('Vui lòng tải ảnh giấy phép an toàn thực phẩm.');
      return;
    }
    if (!licenseNumber.trim()) {
      setError('Vui lòng nhập số giấy phép an toàn thực phẩm.');
      return;
    }
    if (!issuedAt.trim() || !expiresAt.trim()) {
      setError('Vui lòng nhập ngày cấp và ngày hết hạn.');
      return;
    }
    if (changeReason.trim().length < 5) {
      setError('Vui lòng nhập lý do thay đổi (ít nhất 5 ký tự).');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      await submitSellerVerificationReReviewOnBackend({
        idToken,
        payload: {
          licenseNumber: licenseNumber.trim(),
          issuedAt: issuedAt.trim(),
          expiresAt: expiresAt.trim(),
          changeReason: changeReason.trim(),
          anhKDBase64: attpPayload.base64,
          anhKDMimeType: attpPayload.mimeType,
          anhKDUrl: attpPayload.existingUrl,
          extraDocUrls: extraDocs
            .map((doc, index) => {
              const built = buildVerificationImagePayload(doc, doc?.existingUrl || doc?.uri);
              if (!built) {
                return null;
              }
              if (built.existingUrl) {
                return built.existingUrl;
              }
              return {
                base64: built.base64,
                mimeType: built.mimeType,
                index,
              };
            })
            .filter(Boolean),
        },
      });
      Alert.alert(
        'Đã gửi hồ sơ',
        'Hồ sơ xác thực đã được gửi duyệt lại. Gian hàng tạm dừng đăng/sửa sản phẩm và nhận đơn mới cho đến khi admin phê duyệt.',
        [{ text: 'Đóng', onPress: () => onSubmitted?.() || onBack?.() }]
      );
    } catch (submitError) {
      showErrorAlert(submitError.message || 'Không gửi được hồ sơ xác thực.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ProfileSubScreen title="Chỉnh sửa hồ sơ xác thực" onBack={onBack}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  const isPendingReReview =
    verification?.isPendingReReview ||
    (verification?.status === SELLER_VERIFICATION_STATUS.PENDING &&
      Boolean(verification?.reReviewChangeReason));

  const lastRejection = verification?.attpMeta?.lastReReviewRejection?.reason;

  return (
    <ProfileSubScreen title="Chỉnh sửa hồ sơ xác thực" onBack={onBack}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Cập nhật giấy phép an toàn thực phẩm khi hết hạn hoặc được cấp mới. Sau khi gửi, gian hàng
          vẫn hiển thị sản phẩm và xử lý đơn đang có — nhưng tạm dừng đăng/sửa sản phẩm và nhận đơn
          mới.
        </Text>

        {isPendingReReview ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Đang chờ duyệt lại</Text>
            <Text style={styles.noticeBody}>{PENDING_REVIEW_MESSAGE}</Text>
          </View>
        ) : null}

        {lastRejection ? (
          <View style={styles.rejectBox}>
            <Text style={styles.rejectLabel}>Lý do từ chối lần trước</Text>
            <Text style={styles.rejectText}>{lastRejection}</Text>
          </View>
        ) : null}

        <ImagePickerField
          label="Hình ảnh giấy phép an toàn thực phẩm"
          value={attpImage || attpExistingUrl}
          onPick={handlePickAttp}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Số giấy phép ATTP</Text>
          <KeyboardAwareTextInput
            value={licenseNumber}
            onChangeText={(value) => {
              setLicenseNumber(value);
              setError('');
            }}
            placeholder="Nhập số giấy phép"
            editable={!isPendingReReview}
          />
        </View>

        <DatePickerField
          label="Ngày cấp"
          value={issuedAt}
          onChange={(value) => {
            setIssuedAt(value);
            setError('');
          }}
        />

        <DatePickerField
          label="Ngày hết hạn"
          value={expiresAt}
          onChange={(value) => {
            setExpiresAt(value);
            setError('');
          }}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Giấy tờ liên quan khác (tuỳ chọn)</Text>
          {extraDocs.map((doc, index) => (
            <ImagePickerField
              key={`extra-${index}`}
              label={`Ảnh bổ sung ${index + 1}`}
              value={doc}
              onPick={() => handlePickExtraDoc(index)}
            />
          ))}
          {extraDocs.length < 5 && !isPendingReReview ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => handlePickExtraDoc()}
            >
              <Text style={styles.secondaryBtnText}>+ Thêm giấy tờ</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Lý do thay đổi</Text>
          <KeyboardAwareTextInput
            value={changeReason}
            onChangeText={(value) => {
              setChangeReason(value);
              setError('');
            }}
            placeholder="Ví dụ: Giấy phép hết hạn, đã được cấp giấy phép mới..."
            multiline
            editable={!isPendingReReview}
            style={styles.textArea}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!isPendingReReview ? (
          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              submitting && styles.submitBtnDisabled,
            ]}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Đang gửi...' : 'Gửi duyệt lại hồ sơ xác thực'}
            </Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  intro: { fontSize: 14, lineHeight: 21, color: '#64748b', marginBottom: 16 },
  noticeBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: '#c2410c', marginBottom: 4 },
  noticeBody: { fontSize: 13, lineHeight: 19, color: '#9a3412' },
  rejectBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  rejectLabel: { fontSize: 12, fontWeight: '800', color: '#b91c1c', marginBottom: 4 },
  rejectText: { fontSize: 13, lineHeight: 19, color: '#991b1b' },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  previewImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 8 },
  previewPlaceholder: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  previewPlaceholderText: { color: '#94a3b8', fontWeight: '600' },
  pickButton: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: { color: '#076F32', fontWeight: '800' },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryBtnText: { color: '#334155', fontWeight: '700' },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  submitBtn: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.88 },
});
