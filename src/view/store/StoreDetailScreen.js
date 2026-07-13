import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { submitReportOnBackend } from '../../api/reportApi';
import { fetchRouteDistanceMeters } from '../../api/routingApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import ContactActions from './components/ContactActions';
import StarRating from './components/StarRating';
import ReportSheet from '../shared/components/ReportSheet';
import CircularBackButton from '../shared/components/CircularBackButton';
import FollowConnectionsScreen from '../profile/FollowConnectionsScreen';
import { formatPriceRange } from '../../core/utils/productFormat';
import { formatDistance, calculateDistanceMeters, hasValidLocation } from '../../core/utils/geo';
import { storeLogger as log } from '../../core/utils/logger';
const TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'reviews', label: 'Đánh giá' },
];

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function formatCount(value) {
  const count = Number(value) || 0;
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

function formatHours(openTime, closeTime) {
  const open = String(openTime || '').trim();
  const close = String(closeTime || '').trim();

  if (open && close) {
    return `${open} - ${close}`;
  }
  if (open) {
    return open;
  }
  if (close) {
    return close;
  }
  return '';
}

function InfoRow({ label, value, fallback = 'Chưa cập nhật' }) {
  const displayValue = String(value || '').trim() || fallback;

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLine}>
        <Text style={styles.infoLabelInline}>{label}: </Text>
        <Text style={styles.infoValueInline}>{displayValue}</Text>
      </Text>
    </View>
  );
}

function StatCard({ label, value, onPress }) {
  const content = (
    <>
      <Text style={styles.statValue}>{formatCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.statCard}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statCard, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export default function StoreDetailScreen({
  storeId,
  originLocation,
  onBack,
  onProductPress,
  onOpenChat,
  onNavigateDirections,
  previewMode = false,
}) {
  const insets = useScreenInsets();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showFollowScreen, setShowFollowScreen] = useState(false);
  const [likedProducts, setLikedProducts] = useState({});
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(null);

  const straightLineDistanceMeters = useMemo(() => {
    if (!store || !hasValidLocation(originLocation)) {
      return null;
    }

    return calculateDistanceMeters(originLocation, {
      latitude: store.latitude,
      longitude: store.longitude,
    });
  }, [store, originLocation?.latitude, originLocation?.longitude]);

  useEffect(() => {
    if (!store || !hasValidLocation(originLocation)) {
      setRouteDistanceMeters(null);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(() => {
      fetchRouteDistanceMeters(originLocation, {
        latitude: store.latitude,
        longitude: store.longitude,
      })
        .then((distance) => {
          if (active) {
            setRouteDistanceMeters(distance);
          }
        })
        .catch(() => {
          if (active) {
            setRouteDistanceMeters(null);
          }
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    store?.id,
    store?.latitude,
    store?.longitude,
    originLocation?.latitude,
    originLocation?.longitude,
  ]);

  const distanceMeters = Number.isFinite(routeDistanceMeters)
    ? routeDistanceMeters
    : straightLineDistanceMeters ??
      (Number.isFinite(Number(store?.distance_meters)) ? Number(store.distance_meters) : null);

  useEffect(() => {
    let active = true;

    async function loadFavoriteIds() {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken || !active) {
          return;
        }
        const productIds = await getFavoriteProductIdsOnBackend(idToken);
        if (!active) {
          return;
        }
        const likedMap = {};
        (productIds || []).forEach((productId) => {
          likedMap[String(productId)] = true;
        });
        setLikedProducts(likedMap);
      } catch {
        // Ignore favorite preload errors.
      }
    }

    loadFavoriteIds();
    return () => {
      active = false;
    };
  }, [storeId]);

  const toggleLikeProduct = async (productId) => {
    const normalizedId = String(productId);
    const wasLiked = Boolean(likedProducts[normalizedId]);

    setLikedProducts((prev) => ({ ...prev, [normalizedId]: !wasLiked }));

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
        Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để lưu sản phẩm yêu thích.');
        return;
      }

      if (wasLiked) {
        await removeFavoriteProductOnBackend(idToken, normalizedId);
      } else {
        await addFavoriteProductOnBackend({ idToken, productId: normalizedId });
      }
    } catch {
      setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
    }
  };
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
        <ActivityIndicator size="large" color="#0d7377" />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorText}>Không tìm thấy cửa hàng</Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const username = store.shop_username ? `@${store.shop_username}` : '';
  const hoursText = formatHours(store.open_time, store.close_time);
  const coverImage = store.cover_image_url || store.image_url;

  async function handleReportSubmit(reason) {
    setReportVisible(false);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }

      await submitReportOnBackend({
        idToken,
        reportType: 3,
        shopId: store.id,
        shopName: store.name,
        title: reason,
      });

      Alert.alert('Đã gửi báo cáo', `Cảm ơn bạn. Chúng tôi đã ghi nhận: "${reason}".`);
    } catch (error) {
      Alert.alert('Không gửi được báo cáo', error.message || 'Vui lòng thử lại sau.');
    }
  }

  function handleOpenChat() {
    onOpenChat?.({ shopId: store.id, shopName: store.name });
  }

  function handleNavigateDirections() {
    const latitude = Number(store.latitude);
    const longitude = Number(store.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
      return;
    }

    onNavigateDirections?.({
      shopId: store.id,
      storeName: store.shop_name || store.name,
      latitude,
      longitude,
      categoryIcon: store.category_icon || store.categoryIcon || '',
      categoryId: store.category_id || store.categoryId || '',
      storeAvatar: store.image_url || store.cover_image_url || '',
    });
  }

  if (showFollowScreen && previewMode) {
    return <FollowConnectionsScreen onBack={() => setShowFollowScreen(false)} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottomSpacing + 24 }]}
      >
        <View style={styles.header}>
          {!previewMode ? (
            <CircularBackButton onPress={onBack} variant="surface" style={[styles.backBtn, { top: 12 }]} />
          ) : null}
          <Pressable
            onPress={() => setReportVisible(true)}
            style={[styles.reportBtn, { top: 12 }]}
            accessibilityRole="button"
            accessibilityLabel="Báo cáo gian hàng"
          >
            <Text style={styles.reportBtnText}>⋯</Text>
          </Pressable>
          <View style={styles.cover}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} />
            ) : (
              <Text style={styles.coverEmoji}>🏪</Text>
            )}
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.shopNameRow}>
              <Text style={styles.shopName} numberOfLines={2}>
                {store.shop_name || store.name}
              </Text>
              <Pressable
                onPress={() => setIsFollowing((prev) => !prev)}
                style={({ pressed }) => [
                  styles.followBtn,
                  isFollowing && styles.followBtnActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}
                >
                  {isFollowing ? '✓ Đang theo dõi' : '+ Theo dõi'}
                </Text>
              </Pressable>
            </View>
            {username ? <Text style={styles.shopUsername}>{username}</Text> : null}
            {store.intro ? (
              <Text style={styles.shopDescription}>{store.intro}</Text>
            ) : null}

            <View style={styles.ratingRow}>
              <StarRating rating={store.rating_avg} size={16} showValue />
              <Pressable onPress={() => setActiveTab('reviews')} hitSlop={8}>
                <Text style={styles.reviewCount}>
                  ({store.review_count || reviews.length} đánh giá)
                </Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label="Theo dõi"
                value={store.follow_count}
                onPress={previewMode ? () => setShowFollowScreen(true) : undefined}
              />
              <View style={styles.statDivider} />
              <StatCard label="Sản phẩm" value={store.total_products || products.length} />
              <View style={styles.statDivider} />
              <StatCard label="Đã bán" value={store.sold_count} />
              <View style={styles.statDivider} />
              <StatCard label="Lượt thích" value={store.total_likes} />
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>

          <InfoRow label="Địa chỉ" value={store.user_address} />
          <InfoRow label="Địa chỉ hệ thống" value={store.system_address} />
          {Number.isFinite(distanceMeters) ? (
            <View style={styles.distanceRow}>
              <Text style={styles.infoLine}>
                <Text style={styles.infoLabelInline}>Khoảng cách: </Text>
                <Text style={styles.infoValueInline}>{`Cách bạn ${formatDistance(distanceMeters)}`}</Text>
              </Text>
              {onNavigateDirections ? (
                <Pressable
                  onPress={handleNavigateDirections}
                  style={({ pressed }) => [styles.directionsChip, pressed && styles.pressed]}
                >
                  <Text style={styles.directionsChipText}>Chỉ đường</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <InfoRow label="Số điện thoại" value={store.phone} />
          <InfoRow label="Giờ đóng - mở cửa" value={hoursText} />
          <InfoRow
            label="Trạng thái"
            value={store.is_open ? 'Đang mở cửa' : 'Đã đóng cửa'}
            fallback="Chưa cập nhật"
          />

          <View style={styles.contactActions}>
            <ContactActions phone={store.phone} onMessage={handleOpenChat} />
          </View>
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

        {activeTab === 'products' ? (
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
                    {product.thumbnail ? (
                      <Image source={{ uri: product.thumbnail }} style={styles.productThumb} />
                    ) : (
                      <Text style={styles.productEmoji}>{product.image_emoji}</Text>
                    )}
                    <Pressable
                      onPress={() => toggleLikeProduct(product.id)}
                      hitSlop={8}
                      style={styles.productLikeBtn}
                    >
                      <Text style={styles.productLikeIcon}>
                        {likedProducts[product.id] ? '❤️' : '🤍'}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.productPrice}>
                    {formatPriceRange(
                      product.minPrice ?? product.price,
                      product.maxPrice ?? product.price
                    )}
                  </Text>
                  <Text style={styles.productSold}>Đã bán: {product.soldCount || 0}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <View style={styles.reviewsList}>
            <View style={styles.reviewsSummary}>
              <Text style={styles.reviewsSummaryScore}>{store.rating_avg.toFixed(1)}</Text>
              <View>
                <StarRating rating={store.rating_avg} size={18} />
                <Text style={styles.reviewsSummaryCount}>
                  {store.review_count || reviews.length} đánh giá từ khách hàng
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
      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo gian hàng"
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f7f6',
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
    color: '#0d7377',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportBtn: {
    position: 'absolute',
    right: 16,
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
  reportBtnText: {
    fontSize: 22,
    color: '#0f172a',
    fontWeight: '900',
    lineHeight: 24,
  },
  cover: {
    height: 180,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverEmoji: {
    fontSize: 64,
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  shopName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  followBtn: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0d7377',
  },
  followBtnActive: {
    backgroundColor: '#e2e8f0',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  followBtnTextActive: {
    color: '#475569',
  },
  shopUsername: {
    fontSize: 14,
    color: '#0d7377',
    fontWeight: '700',
    marginBottom: 8,
  },
  shopDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  reviewCount: {
    fontSize: 13,
    color: '#94a3b8',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0d7377',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  messageButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  messageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  infoRow: {
    marginBottom: 10,
  },
  infoLine: {
    fontSize: 14,
    lineHeight: 22,
  },
  infoLabelInline: {
    color: '#64748b',
    fontWeight: '700',
  },
  infoValueInline: {
    color: '#0f172a',
    fontWeight: '600',
  },
  contactActions: {
    marginTop: 4,
    gap: 10,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  directionsChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  directionsChipText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0d7377',
    backgroundColor: '#f8fffe',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0d7377',
    fontWeight: '800',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  productCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pressed: {
    opacity: 0.85,
  },
  productImage: {
    height: 110,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  productLikeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productLikeIcon: {
    fontSize: 15,
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
    color: '#0d7377',
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  productSold: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
  },
  reviewsList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  reviewsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewsSummaryScore: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0d7377',
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#0d7377',
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
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 24,
    width: '100%',
  },
});
