import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { submitReportOnBackend } from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import ProfileSubScreen from './ProfileSubScreen';

const MAX_IMAGES = 5;

export const ACCOUNT_REPORT_TYPE_OPTIONS = [
  { value: 4, label: 'Hệ thống lỗi' },
  { value: 5, label: 'Khác' },
];

async function assetToDataUri(asset) {
  const mimeType = asset?.mimeType || 'image/jpeg';
  if (asset?.base64) {
    return `data:${mimeType};base64,${asset.base64}`;
  }
  return '';
}

async function assetsToDataUris(assets = []) {
  const results = [];
  for (const asset of assets) {
    const dataUri = await assetToDataUri(asset);
    if (dataUri) {
      results.push(dataUri);
    }
  }
  return results;
}

export default function AccountReportScreen({ onBack }) {
  const [reportType, setReportType] = useState(4);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [content, setContent] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = useMemo(
    () => ACCOUNT_REPORT_TYPE_OPTIONS.find((item) => item.value === reportType),
    [reportType]
  );

  async function pickFromLibrary() {
    const remaining = MAX_IMAGES - imageUris.length;
    if (remaining <= 0) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền thư viện ảnh để đính kèm.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    const next = await assetsToDataUris(result.assets);
    if (!next.length) {
      Alert.alert('Lỗi ảnh', 'Không đọc được ảnh. Vui lòng chọn lại.');
      return;
    }
    setImageUris((current) => [...current, ...next].slice(0, MAX_IMAGES));
  }

  async function pickFromCamera() {
    if (imageUris.length >= MAX_IMAGES) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền camera để chụp ảnh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const next = await assetsToDataUris([result.assets[0]]);
    if (!next.length) {
      Alert.alert('Lỗi ảnh', 'Không đọc được ảnh. Vui lòng chụp lại.');
      return;
    }
    setImageUris((current) => [...current, ...next].slice(0, MAX_IMAGES));
  }

  function handleAddPhoto() {
    Alert.alert('Thêm ảnh', 'Chọn nguồn ảnh', [
      { text: 'Chụp ảnh', onPress: () => pickFromCamera() },
      { text: 'Thư viện', onPress: () => pickFromLibrary() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  function removeImage(index) {
    setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập nội dung tố cáo.');
      return;
    }

    const validImages = imageUris.filter((uri) => String(uri || '').startsWith('data:image/'));
    if (imageUris.length > 0 && validImages.length === 0) {
      Alert.alert('Lỗi ảnh', 'Ảnh đính kèm không hợp lệ. Vui lòng chọn lại ảnh.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi tố cáo.');
        return;
      }

      await submitReportOnBackend({
        idToken,
        reportType,
        title: selectedType?.label || 'Báo cáo',
        content: trimmed,
        images: validImages,
      });

      setContent('');
      setImageUris([]);
      Alert.alert('Đã gửi tố cáo', 'Cảm ơn bạn. Hệ thống đã ghi nhận báo cáo.', [
        { text: 'OK', onPress: () => onBack?.() },
      ]);
    } catch (error) {
      Alert.alert('Không gửi được', error.message || 'Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ProfileSubScreen title="Báo cáo" onBack={onBack}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Loại tố cáo</Text>
        <Pressable
          style={styles.selectField}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
        >
          <Text style={styles.selectValue}>{selectedType?.label || 'Chọn loại'}</Text>
          <Ionicons name="chevron-down" size={18} color="#64748b" />
        </Pressable>

        <Text style={styles.hint}>
          Báo cáo gian hàng / người dùng hãy mở trang gian hàng hoặc hồ sơ tương ứng rồi bấm Báo cáo.
          Tại đây chỉ gửi tố cáo hệ thống hoặc loại khác.
        </Text>

        <Text style={styles.label}>Nội dung</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          style={styles.textArea}
          multiline
          placeholder="Mô tả chi tiết vấn đề..."
          placeholderTextColor="#94a3b8"
          textAlignVertical="top"
        />

        <View style={styles.imagesHeader}>
          <Text style={styles.label}>Ảnh đính kèm (tối đa {MAX_IMAGES})</Text>
          <Text style={styles.imageCount}>
            {imageUris.length}/{MAX_IMAGES}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imagesRow}
        >
          {imageUris.map((uri, index) => (
            <View key={`${index}-${uri.slice(0, 24)}`} style={styles.imageWrap}>
              <Image source={{ uri }} style={styles.image} />
              <Pressable style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                <Ionicons name="close" size={14} color="#ffffff" />
              </Pressable>
            </View>
          ))}
          {imageUris.length < MAX_IMAGES ? (
            <Pressable style={styles.addImageBtn} onPress={handleAddPhoto}>
              <Ionicons name="camera-outline" size={22} color="#076F32" />
              <Text style={styles.addImageText}>Thêm</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <Pressable
          style={[styles.submitBtn, isSubmitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitBtnText}>{isSubmitting ? 'Đang gửi...' : 'Gửi tố cáo'}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Chọn loại tố cáo</Text>
            {ACCOUNT_REPORT_TYPE_OPTIONS.map((option) => {
              const active = option.value === reportType;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    setReportType(option.value);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color="#076F32" /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    marginTop: 8,
  },
  selectField: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  imagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
  },
  imagesRow: {
    gap: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  imageWrap: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderStyle: 'dashed',
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#076F32',
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 10,
  },
  optionRow: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  optionRowActive: {
    backgroundColor: '#E6F4EC',
    borderColor: '#076F32',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  optionTextActive: {
    color: '#076F32',
  },
});
