import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import FormSheetActions from './KeyboardStickyFooter';
import KeyboardAwareTextInput from './KeyboardAwareTextInput';
import {
  FormSheetBackdrop,
  FormSheetHeader,
  FormSheetShell,
  FORM_SHEET_SCROLL_STYLE,
} from './formSheetLayout';
import { BottomSheetHandle } from './bottomSheetChrome';

const REVIEW_PLACEHOLDER =
  'Hãy chia sẻ trải nghiệm của bạn về dịch vụ và sản phẩm của gian hàng này...';
const MAX_REVIEW_IMAGES = 5;

function assetToDataUri(asset) {
  if (asset?.base64) {
    const mimeType = asset.mimeType || 'image/jpeg';
    return `data:${mimeType};base64,${asset.base64}`;
  }
  return asset?.uri || '';
}

export default function ShopReviewModal({
  visible,
  storeName,
  productName,
  onClose,
  onSubmit,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(0);
      setComment('');
      setImageUris([]);
      setIsSubmitting(false);
    }
  }, [visible]);

  async function handlePickImages() {
    const remaining = MAX_REVIEW_IMAGES - imageUris.length;
    if (remaining <= 0) {
      Alert.alert('Giới hạn ảnh', `Bạn chỉ có thể đính kèm tối đa ${MAX_REVIEW_IMAGES} ảnh.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền truy cập thư viện ảnh để đính kèm hình.');
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
    setImageUris((current) => [...current, ...next].slice(0, MAX_REVIEW_IMAGES));
  }

  function removeImage(index) {
    setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function handleSubmit() {
    if (!rating) {
      Alert.alert('Thiếu đánh giá', 'Vui lòng chọn số sao trước khi gửi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        rating,
        comment: comment.trim(),
        images: imageUris,
        imageUrl: imageUris[0] || '',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <FormSheetBackdrop onClose={onClose} />
        <FormSheetShell panelStyle={styles.sheet}>
            <BottomSheetHandle />
            <FormSheetHeader
              title="Viết đánh giá"
              onClose={onClose}
              disabled={isSubmitting}
            />
            <KeyboardAwareScrollView
              style={FORM_SHEET_SCROLL_STYLE}
              contentContainerStyle={styles.scrollContent}
              nestedScrollPadding={false}
              showsVerticalScrollIndicator={false}
            >
          <View style={styles.card}>
            {storeName ? <Text style={styles.storeName}>🏪 {storeName}</Text> : null}
            {productName ? <Text style={styles.productName}>{productName}</Text> : null}

            <Text style={styles.label}>Chọn số sao</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = rating >= star;
                return (
                  <Pressable key={star} onPress={() => setRating(star)} hitSlop={8}>
                    <Text style={[styles.star, isActive && styles.starActive]}>
                      {isActive ? '★' : '☆'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Nhận xét</Text>
            <KeyboardAwareTextInput
              value={comment}
              onChangeText={setComment}
              style={styles.input}
              multiline
              placeholder={REVIEW_PLACEHOLDER}
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Ảnh sản phẩm (tuỳ chọn, tối đa {MAX_REVIEW_IMAGES})</Text>
            <View style={styles.photoRow}>
              {imageUris.length < MAX_REVIEW_IMAGES ? (
                <Pressable
                  style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
                  onPress={handlePickImages}
                >
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={styles.photoText}>Thêm ảnh</Text>
                </Pressable>
              ) : null}
              {imageUris.map((uri, index) => (
                <View key={`review-img-${index}`} style={styles.previewWrap}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <Pressable onPress={() => removeImage(index)} style={styles.removePhoto}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <FormSheetActions style={styles.footerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>Gửi đánh giá</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelText}>Hủy</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  card: {
    width: '100%',
  },
  storeName: {
    marginTop: 0,
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  productName: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  starRow: {
    flexDirection: 'row',
    gap: 10,
  },
  star: {
    fontSize: 34,
    color: '#cbd5e1',
  },
  starActive: {
    color: '#f59e0b',
  },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    color: '#0f172a',
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  photoButton: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  photoIcon: {
    fontSize: 22,
  },
  photoText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  previewWrap: {
    position: 'relative',
  },
  previewImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  cancelButton: {
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  footerActions: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 0,
    width: '100%',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});
