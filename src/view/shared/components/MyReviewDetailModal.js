import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getMyReviewsOnBackend } from '../../../api/reviewApi';
import { getCurrentUserIdToken } from '../../../repository/authRepository';
import StarRating from '../../store/components/StarRating';
import { BottomSheetDismissOverlay, BottomSheetHandle } from './bottomSheetChrome';
import { FormSheetHeader, FormSheetShell, FORM_SHEET_SCROLL_STYLE } from './formSheetLayout';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function getReviewImages(review) {
  if (Array.isArray(review?.images) && review.images.length > 0) {
    return review.images
      .map((image) => image.imageUrl || image.ImageUrl || image)
      .filter((uri) => typeof uri === 'string' && uri);
  }
  const single = review?.imageUrl || review?.image_url || '';
  return single ? [single] : [];
}

function reviewHasDisplayContent(review) {
  if (!review) {
    return false;
  }
  return (
    Number(review.rating) > 0 ||
    Boolean(String(review.comment || '').trim()) ||
    getReviewImages(review).length > 0
  );
}

export default function MyReviewDetailModal({
  visible,
  review,
  onClose,
  onDelete,
}) {
  const [resolvedReview, setResolvedReview] = useState(review);

  useEffect(() => {
    if (!visible || !review) {
      setResolvedReview(review);
      return undefined;
    }

    if (reviewHasDisplayContent(review)) {
      setResolvedReview(review);
      return undefined;
    }

    let active = true;
    (async () => {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          return;
        }
        const reviewsPage = await getMyReviewsOnBackend(idToken, { page: 1, limit: 20 });
        const reviews = reviewsPage.items || [];
        const reviewId = String(review.id || '').trim();
        const reservationId = String(review.reservationId || review.orderCode || '').trim();
        const match = (reviews || []).find((row) => {
          if (reviewId && String(row.id) === reviewId) {
            return true;
          }
          if (reservationId && String(row.reservationId || row.orderCode) === reservationId) {
            return true;
          }
          return false;
        });
        if (active) {
          setResolvedReview(match ? { ...review, ...match } : review);
        }
      } catch {
        if (active) {
          setResolvedReview(review);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [visible, review]);

  if (!review) {
    return null;
  }

  const displayReview = resolvedReview || review;
  const images = getReviewImages(displayReview);

  function handleMenuPress() {
    Alert.alert('Gỡ bỏ đánh giá', 'Bạn có chắc muốn gỡ đánh giá này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ bỏ',
        style: 'destructive',
        onPress: () => onDelete?.(displayReview),
      },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheetDismissOverlay onClose={onClose}>
        <FormSheetShell panelStyle={styles.sheet}>
          <BottomSheetHandle />
          <FormSheetHeader
            title="Đánh giá của bạn"
            onClose={onClose}
            rightSlot={
              displayReview.id ? (
                <Pressable
                  onPress={handleMenuPress}
                  style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Gỡ bỏ đánh giá"
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#0f172a" />
                </Pressable>
              ) : null
            }
          />

          <ScrollView
            style={FORM_SHEET_SCROLL_STYLE}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.reviewCard}>
              <View style={styles.ratingRow}>
                <StarRating rating={Number(displayReview.rating) || 0} size={16} />
                <Text style={styles.date}>
                  {formatDateTime(displayReview.createdAt || displayReview.created_at)}
                </Text>
              </View>
              {displayReview.comment ? (
                <Text style={styles.comment}>{displayReview.comment}</Text>
              ) : (
                <Text style={styles.commentMuted}>Không có nội dung.</Text>
              )}
              {images.length > 0 ? (
                <View style={styles.imagesRow}>
                  {images.map((uri, index) => (
                    <Image
                      key={`${displayReview.id}-img-${index}`}
                      source={{ uri }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </FormSheetShell>
      </BottomSheetDismissOverlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  pressed: { opacity: 0.75 },
  bodyContent: {
    paddingBottom: 8,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  comment: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  commentMuted: {
    marginTop: 12,
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  imagesRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
});
