import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const REVIEW_PLACEHOLDER =
  'Hãy chia sẻ trải nghiệm của bạn về dịch vụ và sản phẩm của gian hàng này...';

export default function ShopReviewModal({
  visible,
  storeName,
  productName,
  onClose,
  onSubmit,
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(0);
      setComment('');
      setImageUri('');
      setIsSubmitting(false);
    }
  }, [visible]);

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền truy cập thư viện ảnh để đính kèm hình.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (asset.base64) {
      const mimeType = asset.mimeType || 'image/jpeg';
      setImageUri(`data:${mimeType};base64,${asset.base64}`);
      return;
    }
    if (asset.uri) {
      setImageUri(asset.uri);
    }
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
        imageUrl: imageUri,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Viết đánh giá</Text>
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
            <TextInput
              value={comment}
              onChangeText={setComment}
              style={styles.input}
              multiline
              placeholder={REVIEW_PLACEHOLDER}
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Ảnh sản phẩm (tuỳ chọn)</Text>
            <View style={styles.photoRow}>
              <Pressable
                style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
                onPress={handlePickImage}
              >
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoText}>Thêm ảnh</Text>
              </Pressable>
              {imageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  <Pressable onPress={() => setImageUri('')} style={styles.removePhoto}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  storeName: {
    marginTop: 6,
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
    marginTop: 16,
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
    minHeight: 110,
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
    marginTop: 18,
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
    marginTop: 10,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});
