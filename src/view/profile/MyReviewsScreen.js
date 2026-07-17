import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteBuyerReviewOnBackend,
  getMyReviewsOnBackend,
  updateBuyerReviewOnBackend,
} from '../../api/reviewApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import StarRating from '../store/components/StarRating';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function normalizeReview(item) {
  return {
    id: String(item.id),
    storeId: item.storeId || '',
    storeName: item.storeName || 'Gian hàng',
    productName: item.productName || '',
    rating: Number(item.rating) || 5,
    comment: item.comment || '',
    imageUrl: item.imageUrl || '',
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

export default function MyReviewsScreen({ refreshKey = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingReview, setEditingReview] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState(5);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (idToken) {
        const rows = await getMyReviewsOnBackend(idToken);
        if (Array.isArray(rows) && rows.length > 0) {
          setReviews(rows.map(normalizeReview));
          return;
        }
      }
      setReviews([]);
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews, refreshKey]);

  function handleDelete(review) {
    Alert.alert('Xóa đánh giá', 'Bạn có chắc muốn xóa đánh giá này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            if (idToken && !String(review.id).startsWith('rev-')) {
              await deleteBuyerReviewOnBackend(idToken, review.id);
            }
            setReviews((current) => current.filter((item) => item.id !== review.id));
          } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không xóa được đánh giá.');
          }
        },
      },
    ]);
  }

  function openEdit(review) {
    setEditingReview(review);
    setEditComment(review.comment || '');
    setEditRating(review.rating || 5);
  }

  async function saveEdit() {
    if (!editingReview) {
      return;
    }

    try {
      const idToken = await getCurrentUserIdToken();
      if (idToken && !String(editingReview.id).startsWith('rev-')) {
        const updated = await updateBuyerReviewOnBackend({
          idToken,
          reviewId: editingReview.id,
          rating: editRating,
          comment: editComment.trim(),
        });
        setReviews((current) =>
          current.map((item) =>
            item.id === editingReview.id ? normalizeReview(updated) : item
          )
        );
      } else {
        setReviews((current) =>
          current.map((item) =>
            item.id === editingReview.id
              ? { ...item, comment: editComment.trim(), rating: editRating }
              : item
          )
        );
      }
      setEditingReview(null);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không cập nhật được đánh giá.');
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color="#0f766e" />
      </View>
    );
  }

  return (
    <View>
      {reviews.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Chưa có đánh giá nào</Text>
          <Text style={styles.emptySubtitle}>Các đánh giá của bạn sẽ hiển thị tại đây.</Text>
        </View>
      ) : (
        reviews.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderText}>
                <Text style={styles.storeName}>{item.storeName}</Text>
                <Text style={styles.productName}>{item.productName}</Text>
              </View>
              <StarRating rating={item.rating} size={14} showValue />
            </View>
            <Text style={styles.comment}>{item.comment}</Text>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.reviewImage} resizeMode="cover" />
            ) : null}
            <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
                onPress={() => openEdit(item)}
              >
                <Text style={styles.editButtonText}>Sửa</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteButtonText}>Xóa</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={Boolean(editingReview)} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sửa đánh giá</Text>
            <Text style={styles.modalLabel}>Số sao</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setEditRating(star)}>
                  <Text style={[styles.starButton, editRating >= star && styles.starButtonActive]}>
                    {editRating >= star ? '★' : '☆'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalLabel}>Nội dung</Text>
            <TextInput
              value={editComment}
              onChangeText={setEditComment}
              style={styles.input}
              multiline
              placeholder="Nhập đánh giá..."
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setEditingReview(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveEdit}>
                <Text style={styles.modalSaveText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
  },
  storeName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  productName: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  comment: {
    marginTop: 10,
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  reviewImage: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  date: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  editButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f3f1',
  },
  editButtonText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
  },
  emptySubtitle: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  starButton: {
    fontSize: 24,
    color: '#cbd5e1',
  },
  starButtonActive: {
    color: '#f59e0b',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modalCancel: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '800',
  },
  modalSave: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  modalSaveText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
