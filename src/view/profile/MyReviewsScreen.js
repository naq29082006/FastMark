import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  deleteBuyerReviewOnBackend,
  getMyReviewsOnBackend,
  updateBuyerReviewOnBackend,
} from '../../api/reviewApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { mergeListById, removeById } from '../../core/utils/realtimeList';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import StarRating from '../store/components/StarRating';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import FormSheetActions from '../shared/components/KeyboardStickyFooter';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';
import { FormSheetBackdrop, FormSheetHeader, FormSheetShell, FORM_SHEET_SCROLL_STYLE } from '../shared/components/formSheetLayout';
import { BottomSheetHandle } from '../shared/components/bottomSheetChrome';
import LoadMoreButton from '../shared/components/LoadMoreButton';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function normalizeReview(item) {
  const images = Array.isArray(item.images)
    ? item.images
        .map((image) => image.imageUrl || image.ImageUrl || image)
        .filter((uri) => typeof uri === 'string' && uri)
    : [];
  const imageUrl = images[0] || item.imageUrl || item.image_url || '';

  return {
    id: String(item.id),
    storeId: item.storeId || item.shopId || '',
    storeName: item.storeName || 'Gian hàng',
    productName: item.productName || '',
    rating: Number(item.rating) || 5,
    comment: item.comment || '',
    images,
    imageUrl,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

export default function MyReviewsScreen({ refreshKey = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState(5);

  const loadReviews = useCallback(async ({ nextPage = 1, silent = false } = {}) => {
    if (!silent) {
      if (nextPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (idToken) {
        const result = await getMyReviewsOnBackend(idToken, {
          page: nextPage,
          limit: DEFAULT_PAGE_SIZE,
        });
        const rows = Array.isArray(result?.items) ? result.items.map(normalizeReview) : [];
        setReviews((current) =>
          nextPage === 1 ? mergeListById(current, rows) : appendUniqueById(current, rows)
        );
        setPage(Number(result?.page) || nextPage);
        setTotalCount(Math.max(0, Number(result?.total) || 0));
        setHasMore(Boolean(result?.hasMore));
        return;
      }
      setReviews([]);
      setTotalCount(0);
      setHasMore(false);
    } catch {
      if (silent) {
        return;
      }
      if (nextPage === 1) {
        setReviews([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews, refreshKey]);

  const handleReviewRealtime = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim();
      if (type !== 'review') {
        return;
      }
      const action = String(payload?.action || '').trim();
      const reviewId = String(payload?.reviewId || '').trim();
      if ((action === 'deleted' || action === 'hidden') && reviewId) {
        setReviews((current) => removeById(current, reviewId));
        setTotalCount((current) => Math.max(0, current - 1));
        return;
      }
      loadReviews({ nextPage: 1, silent: true });
    },
    [loadReviews]
  );

  useResourceSocket({
    enabled: true,
    onResourceUpdated: handleReviewRealtime,
  });

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
            setTotalCount((current) => Math.max(0, current - 1));
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
        <ActivityIndicator color="#076F32" />
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
        <>
        {reviews.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderText}>
                <Text style={styles.storeName}>{item.storeName}</Text>
                <Text style={styles.productName}>{item.productName}</Text>
              </View>
              <StarRating rating={item.rating} size={14} showValue />
            </View>
            <Text style={styles.comment}>{item.comment}</Text>
            {item.images?.length > 0 ? (
              <View style={styles.reviewImagesRow}>
                {item.images.map((uri, index) => (
                  <Image
                    key={`${item.id}-img-${index}`}
                    source={{ uri }}
                    style={styles.reviewImage}
                    resizeMode="cover"
                  />
                ))}
              </View>
            ) : item.imageUrl ? (
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
        ))}
        <LoadMoreButton
          currentCount={reviews.length}
          totalCount={hasMore ? Math.max(totalCount, reviews.length + DEFAULT_PAGE_SIZE) : reviews.length}
          loading={isLoadingMore}
          onPress={() => loadReviews({ nextPage: page + 1 })}
        />
        </>
      )}

      <Modal
        visible={Boolean(editingReview)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingReview(null)}
      >
        <View style={styles.modalOverlay}>
          <FormSheetBackdrop onClose={() => setEditingReview(null)} />
          <FormSheetShell panelStyle={styles.modalSheet}>
              <BottomSheetHandle />
              <FormSheetHeader
                title="Sửa đánh giá"
                onClose={() => setEditingReview(null)}
              />
              <KeyboardAwareScrollView
                contentContainerStyle={styles.modalScrollContent}
                nestedScrollPadding={false}
                showsVerticalScrollIndicator={false}
                style={FORM_SHEET_SCROLL_STYLE}
              >
              <View style={styles.modalCard}>
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
                <KeyboardAwareTextInput
                  value={editComment}
                  onChangeText={setEditComment}
                  style={styles.input}
                  multiline
                  placeholder="Nhập đánh giá..."
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <FormSheetActions style={styles.modalActions}>
                <Pressable style={styles.modalCancel} onPress={() => setEditingReview(null)}>
                  <Text style={styles.modalCancelText}>Hủy</Text>
                </Pressable>
                <Pressable style={styles.modalSave} onPress={saveEdit}>
                  <Text style={styles.modalSaveText}>Lưu</Text>
                </Pressable>
              </FormSheetActions>
              </KeyboardAwareScrollView>
          </FormSheetShell>
        </View>
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
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  reviewImagesRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    backgroundColor: '#E6F4EC',
  },
  editButtonText: {
    color: '#076F32',
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
    justifyContent: 'flex-end',
  },
  modalSheet: {
    paddingTop: 8,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  modalCard: {
    width: '100%',
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
    gap: 8,
    paddingHorizontal: 0,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
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
    backgroundColor: '#076F32',
  },
  modalSaveText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
