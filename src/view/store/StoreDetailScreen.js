import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  loadProductsByStoreId,
  loadReviewsByStoreId,
  loadStoreById,
} from '../../viewmodel/store/storeViewModel';
import ContactActions from './components/ContactActions';
import StarRating from './components/StarRating';
import { storeLogger as log } from '../../core/utils/logger';

const TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'reviews', label: 'Đánh giá' },
  { key: 'intro', label: 'Giới thiệu' },
];

const STORE_TYPE_EMOJI = {
  cafe: '☕',
  food: '🍜',
  milktea: '🧋',
  snack: '🍿',
};

function formatPrice(price) {
  return `${Number(price).toLocaleString('vi-VN')}đ`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function StoreDetailScreen({ storeId, onBack, onProductPress }) {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    log.info('StoreDetailScreen:load', { storeId });

    Promise.all([
      loadStoreById(storeId),
      loadProductsByStoreId(storeId),
      loadReviewsByStoreId(storeId),
    ])
      .then(([storeData, productData, reviewData]) => {
        if (!isCurrent) return;
        log.ok('StoreDetailScreen:loaded', {
          storeId,
          products: productData.length,
          reviews: reviewData.length,
          found: Boolean(storeData),
        });
        setStore(storeData);
        setProducts(productData);
        setReviews(reviewData);
        setLoading(false);
      })
      .catch((error) => {
        log.fail('StoreDetailScreen:load-failed', error);
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [storeId]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorText}>Không tìm thấy gian hàng</Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const emoji = STORE_TYPE_EMOJI[store.type] || '🏪';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View style={styles.cover}>
            <Text style={styles.coverEmoji}>{emoji}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeAddress}>📍 {store.address}</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={store.rating_avg} size={16} showValue />
              <Text style={styles.reviewCount}>({store.review_count} đánh giá)</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{products.length}</Text>
            <Text style={styles.statLabel}>Sản phẩm</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{store.rating_avg.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Điểm TB</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{store.review_count}</Text>
            <Text style={styles.statLabel}>Đánh giá</Text>
          </View>
        </View>

        <View style={styles.contactSection}>
          <ContactActions phone={store.phone} zalo={store.zalo} />
        </View>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'products' && (
          <View style={styles.productsGrid}>
            {products.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có sản phẩm nào</Text>
            ) : (
              products.map((product) => (
                <Pressable
                  key={product.id}
                  style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
                  onPress={() => onProductPress?.(product.id)}
                >
                  <View style={styles.productImage}>
                    <Text style={styles.productEmoji}>{product.image_emoji}</Text>
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.reviewsList}>
            <View style={styles.reviewsSummary}>
              <Text style={styles.reviewsSummaryScore}>{store.rating_avg.toFixed(1)}</Text>
              <View>
                <StarRating rating={store.rating_avg} size={18} />
                <Text style={styles.reviewsSummaryCount}>
                  {store.review_count} đánh giá từ khách hàng
                </Text>
              </View>
            </View>
            {reviews.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
            ) : (
              reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>
                        {review.user_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewName}>{review.user_name}</Text>
                      <StarRating rating={review.rating} size={13} />
                    </View>
                    <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'intro' && (
          <View style={styles.introSection}>
            <Text style={styles.introTitle}>Giới thiệu gian hàng</Text>
            <Text style={styles.introText}>
              {store.intro || 'Gian hàng chưa cập nhật thông tin giới thiệu.'}
            </Text>
            <View style={styles.introContact}>
              <Text style={styles.introContactLabel}>Thông tin liên hệ</Text>
              <Text style={styles.introContactItem}>📍 {store.address}</Text>
              <Text style={styles.introContactItem}>📞 {store.phone || 'Chưa cập nhật'}</Text>
              <Text style={styles.introContactItem}>💬 Zalo: {store.zalo || 'Chưa cập nhật'}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 12,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingBottom: 16,
  },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtnText: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '700',
  },
  cover: {
    height: 140,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 56,
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewCount: {
    fontSize: 13,
    color: '#94a3b8',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginTop: 1,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f766e',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  contactSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0f766e',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0f766e',
    fontWeight: '800',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  productCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  productImage: {
    height: 100,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: {
    fontSize: 40,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 10,
    paddingTop: 8,
    minHeight: 36,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f766e',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewsList: {
    padding: 16,
  },
  reviewsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewsSummaryScore: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0f766e',
  },
  reviewsSummaryCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewAvatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  reviewComment: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  introSection: {
    padding: 16,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  introText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  introContact: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  introContactLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  introContactItem: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 24,
    width: '100%',
  },
});
