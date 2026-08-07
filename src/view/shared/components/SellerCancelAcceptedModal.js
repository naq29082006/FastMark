import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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

import { BottomSheetHandle } from './bottomSheetChrome';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import KeyboardAwareTextInput from './KeyboardAwareTextInput';
import { FormSheetActions, FormSheetBackdrop, FormSheetHeader, FormSheetShell, FORM_SHEET_SCROLL_STYLE } from './formSheetLayout';

const MAX_IMAGES = 5;
const MIN_REASON_LENGTH = 5;

function assetToDataUri(asset) {
  if (asset?.base64) {
    const mimeType = asset.mimeType || 'image/jpeg';
    return `data:${mimeType};base64,${asset.base64}`;
  }
  return asset?.uri || '';
}

/**
 * Modal hủy đơn sau khi seller đã xác nhận giữ hàng.
 * Bắt buộc lý do cụ thể + 1–5 ảnh chứng minh.
 */
export default function SellerCancelAcceptedModal({ visible, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason('');
      setImageUris([]);
      setIsSubmitting(false);
    }
  }, [visible]);

  async function pickFromLibrary() {
    const remaining = MAX_IMAGES - imageUris.length;
    if (remaining <= 0) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh chứng minh.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền thư viện ảnh để đính kèm chứng minh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    const next = result.assets.map(assetToDataUri).filter(Boolean);
    setImageUris((current) => [...current, ...next].slice(0, MAX_IMAGES));
  }

  async function pickFromCamera() {
    if (imageUris.length >= MAX_IMAGES) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh chứng minh.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền camera để chụp ảnh chứng minh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const uri = assetToDataUri(result.assets[0]);
    if (!uri) {
      return;
    }
    setImageUris((current) => [...current, uri].slice(0, MAX_IMAGES));
  }

  function handleAddPhoto() {
    Alert.alert('Thêm ảnh chứng minh', 'Chọn nguồn ảnh', [
      { text: 'Chụp ảnh', onPress: () => pickFromCamera() },
      { text: 'Thư viện', onPress: () => pickFromLibrary() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  function removeImage(index) {
    setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function handleSubmit() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < MIN_REASON_LENGTH) {
      Alert.alert(
        'Thiếu lý do',
        `Vui lòng nhập lý do hủy cụ thể (ít nhất ${MIN_REASON_LENGTH} ký tự).`
      );
      return;
    }
    if (!imageUris.length) {
      Alert.alert('Thiếu ảnh', 'Vui lòng đính kèm ít nhất 1 ảnh chứng minh.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        reason: trimmedReason,
        images: imageUris,
      });
    } catch {
      // Parent shows Alert; keep modal open.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <FormSheetBackdrop onClose={onClose} />
        <FormSheetShell panelStyle={styles.sheet}>
            <BottomSheetHandle />
            <FormSheetHeader
              title="Hủy đơn đã xác nhận"
              onClose={onClose}
              disabled={isSubmitting}
            />

            <KeyboardAwareScrollView
              style={FORM_SHEET_SCROLL_STYLE}
              contentContainerStyle={styles.body}
              nestedScrollPadding={false}
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.warning}>
              Tiền cọc sẽ được hoàn cho người mua. Cần lý do cụ thể và ảnh chứng minh.
            </Text>

            <Text style={styles.label}>Lý do hủy *</Text>
            <KeyboardAwareTextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="Ví dụ: Hết hàng / Sự cố cửa hàng / Không giao được..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              editable={!isSubmitting}
            />

            <View style={styles.photoHeader}>
              <Text style={styles.label}>
                Ảnh chứng minh ({imageUris.length}/{MAX_IMAGES})
              </Text>
              <Pressable
                style={styles.addPhotoBtn}
                onPress={handleAddPhoto}
                disabled={isSubmitting}
              >
                <Ionicons name="camera-outline" size={16} color="#076F32" />
                <Text style={styles.addPhotoText}>Thêm ảnh</Text>
              </Pressable>
            </View>
            {imageUris.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {imageUris.map((uri, index) => (
                  <View key={`${index}-${uri.slice(0, 24)}`} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => removeImage(index)}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="close" size={14} color="#ffffff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>
                Cần ít nhất 1 ảnh. Có thể chụp hoặc chọn từ thư viện.
              </Text>
            )}

              <FormSheetActions style={styles.footer}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Đóng</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Xác nhận hủy</Text>
                  )}
                </Pressable>
              </FormSheetActions>
            </KeyboardAwareScrollView>
        </FormSheetShell>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    paddingTop: 10,
  },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  warning: {
    fontSize: 13,
    lineHeight: 18,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 4 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
  },
  addPhotoText: { fontSize: 13, fontWeight: '700', color: '#076F32' },
  photoRow: { marginTop: 4 },
  photoWrap: { marginRight: 8, position: 'relative' },
  photo: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#e2e8f0' },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  footer: {
    paddingHorizontal: 0,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  submitBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});
