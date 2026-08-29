import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { BottomSheetDismissOverlay, BottomSheetHandle } from './bottomSheetChrome';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import FormSheetActions from './KeyboardStickyFooter';
import KeyboardAwareTextInput from './KeyboardAwareTextInput';
import { FormSheetHeader, FormSheetShell, FORM_SHEET_SCROLL_STYLE } from './formSheetLayout';

const MAX_IMAGES = 5;

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

export default function ReportComposeModal({
  visible,
  headerTitle = 'Chi tiết tố cáo',
  reasonTitle = '',
  onClose,
  onSubmit,
}) {
  const [content, setContent] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setContent('');
    setImageUris([]);
    setIsSubmitting(false);
  }, [visible, reasonTitle]);

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
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập chi tiết tố cáo.');
      return;
    }

    const validImages = imageUris.filter((uri) => String(uri || '').startsWith('data:image/'));
    if (imageUris.length > 0 && validImages.length === 0) {
      Alert.alert('Lỗi ảnh', 'Ảnh đính kèm không hợp lệ. Vui lòng chọn lại ảnh.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        title: reasonTitle,
        content: trimmed,
        images: validImages,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheetDismissOverlay onClose={onClose}>
        <FormSheetShell panelStyle={styles.sheet}>
            <BottomSheetHandle />
            <FormSheetHeader
              title={headerTitle}
              onClose={onClose}
              disabled={isSubmitting}
            />

            <KeyboardAwareScrollView
              style={FORM_SHEET_SCROLL_STYLE}
              contentContainerStyle={styles.scrollContent}
              nestedScrollPadding={false}
              showsVerticalScrollIndicator={false}
            >
              {reasonTitle ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Lý do</Text>
                  <Text style={styles.reasonText}>{reasonTitle}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Chi tiết tố cáo</Text>
              <KeyboardAwareTextInput
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

              <FormSheetActions style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                  <Text style={styles.cancelText}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, isSubmitting && styles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitText}>{isSubmitting ? 'Đang gửi...' : 'Gửi tố cáo'}</Text>
                </Pressable>
              </FormSheetActions>
            </KeyboardAwareScrollView>
        </FormSheetShell>
      </BottomSheetDismissOverlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  reasonBox: {
    backgroundColor: '#E6F4EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#076F32',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 12,
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
  },
  imagesRow: {
    gap: 10,
    paddingVertical: 8,
    paddingRight: 8,
  },
  imageWrap: {
    width: 84,
    height: 84,
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
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#076F32',
  },
  actions: {
    paddingHorizontal: 0,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '800',
  },
  submitBtn: {
    flex: 1.3,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
