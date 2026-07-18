import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import { fetchReviewsFromNode } from '../../api/storeNodeApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import StarRating from '../store/components/StarRating';
import AvatarBadge from '../shared/components/AvatarBadge';

function formatReviewDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('vi-VN');
}

export default function SellerReviewsManageScreen({ onBack }) {
  const [reviews, setReviews] = useState([]);
  const [shopName, setShopName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const shop = await getSellerShopSettingsOnBackend(idToken);
      const shopId = shop?.id || shop?.shopId;
      setShopName(shop?.shopName || 'Gian hàng');

      if (!shopId) {
        setReviews([]);
        return;
      }

      const data = await fetchReviewsFromNode(shopId);
      setReviews(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được đánh giá.');
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  return (
    <ProfileSubScreen title="Quản lý đánh giá" onBack={onBack}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadReviews} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item, index) => String(item.id || item._id || index)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Chưa có đánh giá</Text>
              <Text style={styles.emptyText}>
                Khi khách để lại đánh giá cho {shopName || 'gian hàng'}, chúng sẽ hiện tại đây.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.userName || item.fullName || item.buyerName || 'Khách hàng';
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <AvatarBadge
                    name={name}
                    uri={item.avatar || item.photoUrl || ''}
                    size={40}
                  />
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.reviewerName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.reviewDate}>{formatReviewDate(item.createdAt)}</Text>
                  </View>
                  <StarRating rating={item.rating} size={13} />
                </View>
                {item.comment ? (
                  <Text style={styles.comment}>{item.comment}</Text>
                ) : (
                  <Text style={styles.commentMuted}>Không có nội dung.</Text>
                )}
                {item.imageUrl || item.image_url ? (
                  <Image
                    source={{ uri: item.imageUrl || item.image_url }}
                    style={styles.reviewImage}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            );
          }}
        />
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  listContent: { paddingBottom: 24, gap: 10 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  errorText: { color: '#b91c1c', fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  retryButton: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  retryButtonText: { color: '#ffffff', fontWeight: '800' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderInfo: { flex: 1, minWidth: 0 },
  reviewerName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  reviewDate: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  comment: { marginTop: 10, fontSize: 14, color: '#334155', lineHeight: 20 },
  commentMuted: { marginTop: 10, fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  reviewImage: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
});
