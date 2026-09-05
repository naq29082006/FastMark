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
import { validateAttpDates, parseAttpDateValue } from '../../core/utils/attpDateValidation';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import DatePickerField from '../shared/components/DatePickerField';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';
import { FormSheetKeyboardAvoid } from '../shared/components/formSheetLayout';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

const PENDING_REVIEW_MESSAGE =
  'Hồ sơ xác thực của gian hàng đang được xét duyệt lại. Bạn tạm thời không thể bán hàng cho đến khi được phê duyệt.';

const ATTP_CROP_ASPECT = [3, 4];

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
      aspect: ATTP_CROP_ASPECT,
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
      aspect: ATTP_CROP_ASPECT,
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

function ImagePickerField({ label, value, onPick, hint = '' }) {
  const previewUri =
    value?.uri || (typeof value === 'string' && value.startsWith('http') ? value : '') || '';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={styles.previewFrame}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>Chưa chọn ảnh</Text>
          </View>
        )}
      </View>
      {onPick ? (
        <Pressable onPress={onPick} style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}>
          <Text style={styles.pickButtonText}>Chọn ảnh / Chụp camera</Text>
        </Pressable>
      ) : null}
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
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [attpImage, setAttpImage] = useState(null);
  const [error, setError] = useState('');

  const attpExistingUrl = useMemo(() => verification?.anhKD || '', [verification]);
  const expiresMinimumDate = useMemo(() => {
    const issuedDate = parseAttpDateValue(issuedAt);
    return issuedDate || undefined;
  }, [issuedAt]);

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
        setIssuedAt(meta.issuedAt || row?.attpIssuedAt || '');
        setExpiresAt(meta.expiresAt || row?.attpExpiresAt || '');
        if (row?.anhKD) {
          setAttpImage({ uri: row.anhKD });
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
    if (!issuedAt.trim()) {
      setError('Vui lòng nhập ngày cấp giấy phép.');
      return;
    }
    if (!expiresAt.trim()) {
      setError('Vui lòng nhập ngày hết hạn giấy phép.');
      return;
    }
    const attpDates = validateAttpDates(issuedAt, expiresAt);
    if (!attpDates.ok) {
      setError(attpDates.error);
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
          issuedAt: attpDates.issuedAt,
          expiresAt: attpDates.expiresAt,
          changeReason: changeReason.trim(),
          anhKDBase64: attpPayload.base64,
          anhKDMimeType: attpPayload.mimeType,
          anhKDUrl: attpPayload.existingUrl,
        },
      });
      Alert.alert(
        'Đã gửi hồ sơ',
        'Hồ sơ xác thực đã được gửi duyệt lại. Admin sẽ xem xét giấy phép mới.',
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
    <ProfileSubScreen title="Chỉnh sửa hồ sơ xác thực" onBack={onBack} scroll={false}>
      <FormSheetKeyboardAvoid style={styles.avoid}>
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          extraBottomInset={72}
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.intro}>
          Cập nhật giấy phép kinh doanh hoặc chứng nhận an toàn thực phẩm. Vui lòng nhập đúng ngày
          cấp và ngày hết hạn trên giấy phép mới.
        </Text>

        {verification?.isAttpExpired ? (
          <View style={styles.expiredBox}>
            <Text style={styles.expiredTitle}>Giấy phép đã hết hạn</Text>
            <Text style={styles.expiredBody}>
              Gian hàng đang tạm ẩn. Vui lòng gửi hồ sơ mới để admin duyệt và gia hạn hiển thị.
            </Text>
          </View>
        ) : null}

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
          hint="Khung dọc 3:4 — chụp toàn bộ giấy phép, không dùng khung ngang banner."
          value={attpImage || attpExistingUrl}
          onPick={isPendingReReview ? undefined : handlePickAttp}
        />

        <DatePickerField
          label="Ngày cấp"
          value={issuedAt}
          onChange={(value) => {
            setIssuedAt(value);
            setError('');
          }}
          disabled={isPendingReReview}
        />
        <Text style={styles.fieldHint}>Chọn đúng ngày cấp in trên giấy phép mới.</Text>

        <DatePickerField
          label="Ngày hết hạn"
          value={expiresAt}
          minimumDate={expiresMinimumDate}
          onChange={(value) => {
            setExpiresAt(value);
            setError('');
          }}
          disabled={isPendingReReview}
        />
        <Text style={[styles.fieldHint, styles.fieldHintSpaced]}>
          Giấy phép phải còn hiệu lực (ngày hết hạn từ hôm nay trở đi).
        </Text>

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
            scrollGap={96}
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
      </FormSheetKeyboardAvoid>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  avoid: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  intro: { fontSize: 14, lineHeight: 21, color: '#64748b', marginBottom: 16 },
  expiredBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  expiredTitle: { fontSize: 14, fontWeight: '800', color: '#b91c1c', marginBottom: 4 },
  expiredBody: { fontSize: 13, lineHeight: 19, color: '#991b1b' },
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
  fieldHint: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
  },
  fieldHintSpaced: {
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  fieldHint: { fontSize: 12, lineHeight: 18, color: '#64748b', marginBottom: 8 },
  previewFrame: {
    alignSelf: 'center',
    width: '72%',
    maxWidth: 280,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  readonlyDateBox: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  readonlyDateValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  readonlyDatePlaceholder: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
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
