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

import {
  BUYER_DISPUTE_REASON_OPTIONS,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABELS,
} from '../../../constants/sellerOrders';
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

const MAX_IMAGES = 5;

function assetToDataUri(asset) {
  if (asset?.base64) {
    const mimeType = asset.mimeType || 'image/jpeg';
    return `data:${mimeType};base64,${asset.base64}`;
  }
  return asset?.uri || '';
}

/**
 * mode: 'buyer' | 'seller'
 *
 * Không thu thập GPS khi gửi khiếu nại — admin xử lý theo lý do, mô tả và ảnh.
 */
export default function ReservationDisputeModal({
  visible,
  mode = 'buyer',
  onClose,
  onSubmit,
}) {
  const isBuyer = mode === 'buyer';
  const isSellerResponse = mode === 'seller_response';
  const isSellerReport = mode === 'seller';
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(isBuyer ? RESERVATION_DISPUTE_REASON.SELLER_ABSENT : '');
      setNote('');
      setImageUris([]);
      setIsSubmitting(false);
    }
  }, [visible, isBuyer]);

  async function pickFromLibrary() {
    const remaining = MAX_IMAGES - imageUris.length;
    if (remaining <= 0) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh chứng cứ.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền thư viện ảnh để đính kèm chứng cứ.');
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
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh chứng cứ.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền camera để chụp ảnh chứng cứ.');
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
    Alert.alert('Thêm ảnh chứng cứ', 'Chọn nguồn ảnh', [
      { text: 'Chụp ảnh', onPress: () => pickFromCamera() },
      { text: 'Thư viện', onPress: () => pickFromLibrary() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  function removeImage(index) {
    setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function handleSubmit() {
    if (isBuyer && !reason) {
      Alert.alert('Thiếu lý do', 'Vui lòng chọn lý do báo cáo.');
      return;
    }
    const trimmedNote = note.trim();
    if (isBuyer && reason === RESERVATION_DISPUTE_REASON.OTHER && !trimmedNote) {
      Alert.alert('Thiếu mô tả', 'Vui lòng nhập giải thích khi chọn lý do Khác.');
      return;
    }
    if ((isSellerReport || isSellerResponse) && !trimmedNote) {
      Alert.alert(
        'Thiếu mô tả',
        isSellerResponse
          ? 'Vui lòng nhập nội dung phản hồi khiếu nại.'
          : 'Vui lòng nhập ghi chú báo cáo người mua không đến.'
      );
      return;
    }
    if (!imageUris.length) {
      Alert.alert('Thiếu ảnh', 'Vui lòng đính kèm ít nhất 1 ảnh chứng cứ.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        reason: isBuyer ? reason : RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW,
        description: trimmedNote,
        note: trimmedNote,
        title: isSellerResponse
          ? 'Phản hồi khiếu nại'
          : isBuyer
            ? RESERVATION_DISPUTE_REASON_LABELS[reason]
            : 'Người mua không đến nhận hàng',
        images: imageUris,
      });
    } catch (error) {
      Alert.alert('Không gửi được báo cáo', error.message || 'Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const modalTitle = isSellerResponse
    ? 'Phản hồi khiếu nại của khách'
    : isBuyer
      ? 'Báo cáo người bán'
      : 'Báo cáo người mua không đến';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <FormSheetBackdrop onClose={onClose} />
        <FormSheetShell panelStyle={styles.sheet}>
            <BottomSheetHandle />
            <FormSheetHeader
              title={modalTitle}
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
            {isBuyer ? (
              <View style={styles.reasonBlock}>
                <Text style={styles.label}>Lý do</Text>
                {BUYER_DISPUTE_REASON_OPTIONS.map((option) => {
                  const selected = reason === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.reasonChip, selected && styles.reasonChipActive]}
                      onPress={() => setReason(option)}
                    >
                      <Text
                        style={[styles.reasonChipText, selected && styles.reasonChipTextActive]}
                      >
                        {RESERVATION_DISPUTE_REASON_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.label}>
              {isSellerResponse
                ? 'Nội dung phản hồi *'
                : isBuyer
                  ? reason === RESERVATION_DISPUTE_REASON.OTHER
                    ? 'Giải thích lý do *'
                    : 'Ghi chú thêm (tuỳ chọn)'
                  : 'Ghi chú *'}
            </Text>
            <KeyboardAwareTextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={
                isSellerResponse
                  ? 'Giải thích tình huống, bổ sung thông tin cho admin...'
                  : isBuyer
                    ? 'Mô tả tình huống tại điểm nhận hàng...'
                    : 'Mô tả: người mua không đến nhận hàng...'
              }
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.photoHeader}>
              <Text style={styles.label}>Ảnh chứng cứ ({imageUris.length}/{MAX_IMAGES})</Text>
              <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                <Ionicons name="camera-outline" size={16} color="#076F32" />
                <Text style={styles.addPhotoText}>Thêm ảnh</Text>
              </Pressable>
            </View>
            {imageUris.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {imageUris.map((uri, index) => (
                  <View key={`${index}-${uri.slice(0, 24)}`} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <Pressable style={styles.removePhoto} onPress={() => removeImage(index)}>
                      <Ionicons name="close" size={14} color="#ffffff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>Cần ít nhất 1 ảnh. Có thể chụp hoặc chọn từ thư viện.</Text>
            )}
          </View>

          <FormSheetActions style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.btnGhostText}>Huỷ</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {isSellerResponse ? 'Gửi phản hồi' : 'Gửi báo cáo'}
                </Text>
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
    backgroundColor: 'rgba(15,23,42,0.45)',
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
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  reasonBlock: {
    gap: 8,
  },
  reasonChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  reasonChipActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  reasonChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  reasonChipTextActive: {
    color: '#076F32',
  },
  input: {
    minHeight: 88,
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
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoText: {
    color: '#076F32',
    fontWeight: '800',
    fontSize: 13,
  },
  photoRow: {
    marginTop: 4,
  },
  photoWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  actions: {
    paddingHorizontal: 0,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: '#f1f5f9',
  },
  btnGhostText: {
    color: '#475569',
    fontWeight: '800',
  },
  btnPrimary: {
    backgroundColor: '#076F32',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
