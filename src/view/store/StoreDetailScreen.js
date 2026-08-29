import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import {
  loadProductsByStoreId,
  loadReviewsByStoreId,
  loadStoreById,
} from '../../viewmodel/store/storeViewModel';
import { submitReportOnBackend } from '../../api/reportApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import {
  followShopOnBackend,
  getFollowStatusOnBackend,
  unfollowShopOnBackend,
} from '../../api/followApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { getProductImageOverlayLabel } from '../../core/utils/productAvailability';
import {
  formatDistance,
  getDistanceFromCurrentLocation,
  hasValidLocation,
  normalizeExpoLocation,
} from '../../core/utils/geo';
import { getAvatarInitial } from '../../core/utils/avatarInitial';
import { storeLogger as log } from '../../core/utils/logger';
import CircularBackButton from '../shared/components/CircularBackButton';
import AvatarBadge from '../shared/components/AvatarBadge';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import FollowConnectionsScreen from '../profile/FollowConnectionsScreen';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import ContactActions from './components/ContactActions';
import ProductDetailScreen from './ProductDetailScreen';
import StarRating from './components/StarRating';
import ReportSheet from '../shared/components/ReportSheet';
import ReportComposeModal from '../shared/components/ReportComposeModal';
import { useSelector } from 'react-redux';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
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
  originLocation: originLocationProp = null,
  onBack,
  onProductPress,
  onNavigateDirections,
  previewMode = false,
  onOrderSuccess,
  onOpenTopUp,
  reservationSource = 'store',
}) {
  const insets = useScreenInsets();
  const authProfile = useSelector(selectAuthProfile);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [composeVisible, setComposeVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [showFollowScreen, setShowFollowScreen] = useState(false);
  const [likedProducts, setLikedProducts] = useState({});
  const [resolvedOrigin, setResolvedOrigin] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const handleProductPress = useCallback(
    (productId) => {
      const nextProductId = String(productId || '').trim();
      if (!nextProductId) {
        return;
      }

      if (typeof onProductPress === 'function') {
        onProductPress(nextProductId);
        return;
      }

      setSelectedProductId(nextProductId);
    },
    [onProductPress]
  );

  useEffect(() => {
    setSelectedProductId(null);
  }, [storeId]);

  const originLocation = hasValidLocation(originLocationProp)
    ? originLocationProp
    : resolvedOrigin;

  useEffect(() => {
    if (hasValidLocation(originLocationProp)) {
      setResolvedOrigin(null);
      return undefined;
    }

    let active = true;

    async function loadOriginLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') {
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) {
          return;
        }
        setResolvedOrigin(normalizeExpoLocation(current));
      } catch {
        // Distance is optional when location is unavailable.
      }
    }

    loadOriginLocation();
    return () => {
      active = false;
    };
  }, [originLocationProp?.latitude, originLocationProp?.longitude, storeId]);

  const distanceMeters = useMemo(() => {
    if (!store || !hasValidLocation(originLocation)) {
      return Number.isFinite(Number(store?.distance_meters)) ? Number(store.distance_meters) : null;
    }

    return (
      getDistanceFromCurrentLocation(originLocation, {
        latitude: store.latitude,
        longitude: store.longitude,
      }) ??
      (Number.isFinite(Number(store?.distance_meters)) ? Number(store.distance_meters) : null)
    );
  }, [store, originLocation?.latitude, originLocation?.longitude]);

  useEffect(() => {
    let active = true;

    async function loadSocialState() {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken || !active || !storeId) {
          return;
        }

        const [productIds, followStatus] = await Promise.all([
          getFavoriteProductIdsOnBackend(idToken),
          getFollowStatusOnBackend(idToken, { shopId: String(store?.id || storeId) }),
        ]);

        if (!active) {
          return;
        }

        const likedMap = {};
        (productIds || []).forEach((productId) => {
          likedMap[String(productId)] = true;
        });
        setLikedProducts(likedMap);
        setIsFollowing(Boolean(followStatus?.isFollowing));

        if (Number.isFinite(Number(followStatus?.soNguoiTheo))) {
          setStore((prev) =>
            prev
              ? {
                  ...prev,
                  follow_count: Number(followStatus.soNguoiTheo),
                }
              : prev
          );
        }
      } catch {
        // Ignore social preload errors.
      }
    }

    loadSocialState();
    return () => {
      active = false;
    };
  }, [storeId, store?.id]);

  async function runFollowToggle(wasFollowing) {
    const effectiveShopId = String(store?.id || storeId || "").trim();
    if (!effectiveShopId) {
      Alert.alert('Theo dõi', 'Không xác định được gian hàng.');
      return;
    }

    setFollowBusy(true);
    setIsFollowing(!wasFollowing);
    setStore((prev) =>
      prev
        ? {
            ...prev,
            follow_count: Math.max(
              0,
              (Number(prev.follow_count) || 0) + (wasFollowing ? -1 : 1)
            ),
          }
        : prev
    );

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Vui lòng đăng nhập để theo dõi gian hàng.');
      }

      const result = wasFollowing
        ? await unfollowShopOnBackend({ idToken, shopId: effectiveShopId })
        : await followShopOnBackend({ idToken, shopId: effectiveShopId });

      if (Number.isFinite(Number(result?.soNguoiTheo))) {
        setStore((prev) =>
          prev ? { ...prev, follow_count: Number(result.soNguoiTheo) } : prev
        );
      }
      setIsFollowing(Boolean(result?.isFollowing ?? !wasFollowing));
    } catch (error) {
      setIsFollowing(wasFollowing);
      setStore((prev) =>
        prev
          ? {
              ...prev,
              follow_count: Math.max(
                0,
                (Number(prev.follow_count) || 0) + (wasFollowing ? 1 : -1)
              ),
            }
          : prev
      );
      Alert.alert('Theo dõi', error.message || 'Không thể cập nhật theo dõi.');
    } finally {
      setFollowBusy(false);
    }
  }

  async function toggleFollow() {
    if (followBusy) {
      return;
    }

    const wasFollowing = isFollowing;
    if (wasFollowing) {
      Alert.alert('Hủy theo dõi', 'Bạn có chắc muốn hủy theo dõi gian hàng này?', [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy theo dõi',
          style: 'destructive',
          onPress: () => {
            runFollowToggle(true);
          },
        },
      ]);
      return;
    }

    await runFollowToggle(false);
  }

  const toggleLikeProduct = async (productId) => {
    const normalizedId = String(productId);
    const wasLiked = Boolean(likedProducts[normalizedId]);

    setLikedProducts((prev) => ({ ...prev, [normalizedId]: !wasLiked }));
    setProducts((prev) =>
      prev.map((item) => {
        if (String(item.id) !== normalizedId) {
          return item;
        }
        const nextCount = Math.max(0, (Number(item.likeCount) || 0) + (wasLiked ? -1 : 1));
        return { ...item, likeCount: nextCount };
      })
    );

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
        setProducts((prev) =>
          prev.map((item) => {
            if (String(item.id) !== normalizedId) {
              return item;
            }
            const nextCount = Math.max(0, (Number(item.likeCount) || 0) + (wasLiked ? 1 : -1));
            return { ...item, likeCount: nextCount };
          })
        );
        Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để thích sản phẩm.');
        return;
      }

      if (wasLiked) {
        await removeFavoriteProductOnBackend(idToken, normalizedId);
      } else {
        await addFavoriteProductOnBackend({ idToken, productId: normalizedId });
      }
    } catch {
      setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
      setProducts((prev) =>
        prev.map((item) => {
          if (String(item.id) !== normalizedId) {
            return item;
          }
          const nextCount = Math.max(0, (Number(item.likeCount) || 0) + (wasLiked ? 1 : -1));
          return { ...item, likeCount: nextCount };
        })
      );
    }
  };
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setProductsPage(1);
    setReviewsPage(1);

    log.info('StoreDetailScreen:load', { storeId });

    Promise.all([
      loadStoreById(storeId),
      loadProductsByStoreId(storeId, { page: 1, limit: DEFAULT_PAGE_SIZE }),
    ])
      .then(async ([storeData, productPage]) => {
        if (!isCurrent) return;

        const productData = productPage?.items || (Array.isArray(productPage) ? productPage : []);
        const reviewPage = storeData
          ? await loadReviewsByStoreId(storeId, { page: 1, limit: DEFAULT_PAGE_SIZE })
          : { items: [], hasMore: false, total: 0 };
        const reviewData = reviewPage?.items || (Array.isArray(reviewPage) ? reviewPage : []);

        log.ok('StoreDetailScreen:loaded', {
          storeId,
          products: productData.length,
          reviews: reviewData.length,
          found: Boolean(storeData),
        });
        setStore(storeData);
        setProducts(productData);
        setReviews(reviewData);
        setProductsHasMore(Boolean(productPage?.hasMore));
        setReviewsHasMore(Boolean(reviewPage?.hasMore));
        setProductsTotal(Math.max(0, Number(productPage?.total) || 0));
        setReviewsTotal(Math.max(0, Number(reviewPage?.total) || 0));
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

  const loadMoreProducts = useCallback(async () => {
    if (loadingMoreProducts || !productsHasMore) {
      return;
    }
    setLoadingMoreProducts(true);
    try {
      const nextPage = productsPage + 1;
      const pageResult = await loadProductsByStoreId(storeId, {
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const rows = pageResult?.items || (Array.isArray(pageResult) ? pageResult : []);
      setProducts((current) => appendUniqueById(current, rows));
      setProductsPage(nextPage);
      setProductsHasMore(Boolean(pageResult?.hasMore));
      setProductsTotal(Math.max(0, Number(pageResult?.total) || productsTotal));
    } catch (error) {
      log.fail('StoreDetailScreen:load-more-products-failed', error);
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [loadingMoreProducts, productsHasMore, productsPage, productsTotal, storeId]);

  const loadMoreReviews = useCallback(async () => {
    if (loadingMoreReviews || !reviewsHasMore) {
      return;
    }
    setLoadingMoreReviews(true);
    try {
      const nextPage = reviewsPage + 1;
      const pageResult = await loadReviewsByStoreId(storeId, {
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const rows = pageResult?.items || (Array.isArray(pageResult) ? pageResult : []);
      setReviews((current) => appendUniqueById(current, rows));
      setReviewsPage(nextPage);
      setReviewsHasMore(Boolean(pageResult?.hasMore));
      setReviewsTotal(Math.max(0, Number(pageResult?.total) || reviewsTotal));
    } catch (error) {
      log.fail('StoreDetailScreen:load-more-reviews-failed', error);
    } finally {
      setLoadingMoreReviews(false);
    }
  }, [loadingMoreReviews, reviewsHasMore, reviewsPage, reviewsTotal, storeId]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#076F32" />
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

  if (selectedProductId) {
    return (
      <ProductDetailScreen
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
        onStorePress={() => setSelectedProductId(null)}
        onOrderSuccess={onOrderSuccess}
        onOpenTopUp={onOpenTopUp}
        reservationSource={reservationSource}
        reservationStoreId={storeId}
      />
    );
  }

  function handleReportReason(reason) {
    setReportVisible(false);
    setReportReason(reason);
    setComposeVisible(true);
  }

  async function handleReportComposeSubmit({ title, content, images }) {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }

      await submitReportOnBackend({
        idToken,
        reportType: 2,
        shopId: store.id,
        shopName: store.name,
        title,
        content,
        images,
      });

      setComposeVisible(false);
      setReportReason('');
      Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn. Chúng tôi đã ghi nhận tố cáo.');
    } catch (error) {
      Alert.alert('Không gửi được báo cáo', error.message || 'Vui lòng thử lại sau.');
    }
  }

  const isShopLocked = Boolean(
    store.isShopLocked || store.isLocked || Number(store.status) === 0
  );

  if (isShopLocked) {
    const lockedTitle = store.shop_name || store.name || 'Gian hàng';
    return (
      <View style={[styles.loadingScreen, styles.lockedScreen]}>
        {onBack ? (
          <View style={[styles.lockedHeader, { paddingTop: insets.top + 8 }]}>
            <CircularBackButton onPress={onBack} />
          </View>
        ) : null}
        <View style={styles.lockedBody}>
          <Ionicons name="lock-closed" size={40} color="#b45309" />
          <Text style={styles.lockedTitle}>Gian hàng đã bị khóa</Text>
          <Text style={styles.lockedSubtitle}>
            {lockedTitle} hiện không hoạt động. Mọi đơn đang treo đã được hủy và hoàn cọc cho
            người mua.
          </Text>
          <Pressable style={styles.lockedReportBtn} onPress={() => setReportVisible(true)}>
            <Text style={styles.lockedReportBtnText}>Báo cáo cho admin</Text>
          </Pressable>
        </View>
        <ReportSheet
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          onSubmit={handleReportReason}
          title="Báo cáo gian hàng bị khóa"
        />
        <ReportComposeModal
          visible={composeVisible}
          onClose={() => {
            setComposeVisible(false);
            setReportReason('');
          }}
          reason={reportReason}
          onSubmit={handleReportComposeSubmit}
        />
      </View>
    );
  }

  const username = store.userName
    ? `@${store.userName}`
    : store.shop_username
      ? `@${store.shop_username}`
      : '';
  const hoursText = formatHours(store.open_time, store.close_time);
  const coverImage = store.cover_image_url || store.image_url;
  const shopTitle = store.fullName || store.shop_name || store.name || 'Shop';
  const shopInitial = getAvatarInitial(shopTitle);
  const currentUserId = String(authProfile?.mongoUserId || authProfile?.id || '');
  const ownerUserId = String(store.owner_user_id || '');
  const isShopOwner = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);
  const productLikesTotal = products.reduce(
    (sum, product) => sum + (Number(product.likeCount) || 0),
    0
  );
  const displayLikes =
    productLikesTotal > 0 ? productLikesTotal : Number(store.total_likes) || 0;

  function handleNavigateDirections() {
    const latitude = Number(store.latitude);
    const longitude = Number(store.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
      return;
    }

    if (onNavigateDirections) {
      onNavigateDirections({
        shopId: store.id,
        storeName: store.shop_name || store.name,
        latitude,
        longitude,
        categoryId: store.category_id || store.categoryId || '',
        storeAvatar: store.image_url || store.cover_image_url || '',
      });
      return;
    }

    const label = encodeURIComponent(store.shop_name || store.name || 'Gian hàng');
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Không mở được bản đồ', 'Vui lòng thử lại sau.');
    });
  }

  if (showFollowScreen && isShopOwner) {
    return (
      <FollowConnectionsScreen
        shopId={storeId}
        mode="followers"
        initialTab="followers"
        onBack={() => setShowFollowScreen(false)}
        onOpenStore={() => setShowFollowScreen(false)}
      />
    );
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
              <Text style={styles.coverInitial}>{shopInitial}</Text>
            )}
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.shopNameRow}>
              <Text style={styles.shopName} numberOfLines={2}>
                {shopTitle}
              </Text>
              <View style={styles.actionBtnRow}>
                {!isShopOwner ? (
                <Pressable
                  onPress={toggleFollow}
                  disabled={followBusy}
                  style={({ pressed }) => [
                    styles.followBtn,
                    isFollowing && styles.followBtnActive,
                    pressed && styles.pressed,
                    followBusy && styles.actionBtnDisabled,
                  ]}
                >
                  <Text
                    style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}
                  >
                    {isFollowing ? 'Hủy theo dõi' : '+ Theo dõi'}
                  </Text>
                </Pressable>
                ) : null}
              </View>
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
                onPress={
                  isShopOwner
                    ? () => setShowFollowScreen(true)
                    : undefined
                }
              />
              <View style={styles.statDivider} />
              <StatCard label="Sản phẩm" value={store.total_products || products.length} />
              <View style={styles.statDivider} />
              <StatCard label="Đã bán" value={store.sold_count} />
              <View style={styles.statDivider} />
              <StatCard label="Lượt thích" value={displayLikes} />
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>

          <InfoRow
            label="Địa chỉ"
            value={store.system_address || store.user_address}
          />
          {(() => {
            const hasCoords =
              Number.isFinite(Number(store.latitude)) && Number.isFinite(Number(store.longitude));
            const hasDistance = Number.isFinite(Number(distanceMeters));
            if (!hasDistance && !hasCoords) {
              return null;
            }
            return (
              <View style={styles.distanceRow}>
                <Text style={[styles.infoLine, styles.distanceText]} numberOfLines={2}>
                  <Text style={styles.infoLabelInline}>Khoảng cách: </Text>
                  <Text style={styles.infoValueInline}>
                    {hasDistance ? `Cách bạn ${formatDistance(distanceMeters)}` : 'Đang xác định...'}
                  </Text>
                </Text>
                {hasCoords ? (
                  <Pressable
                    onPress={handleNavigateDirections}
                    style={({ pressed }) => [styles.directionsBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Chỉ đường"
                  >
                    <Ionicons name="navigate" size={18} color="#076F32" />
                  </Pressable>
                ) : null}
              </View>
            );
          })()}
          <InfoRow label="Giờ đóng - mở cửa" value={hoursText} />
          <InfoRow
            label="Trạng thái"
            value={store.is_open ? 'Đang mở cửa' : 'Đã đóng cửa'}
            fallback="Chưa cập nhật"
          />

          <View style={styles.contactActions}>
            <ContactActions phone={store.phone} />
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

        {activeTab === 'reviews' ? (
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
              <>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <AvatarBadge
                      name={review.user_name}
                      uri={review.avatar || review.photoUrl || ''}
                      size={36}
                    />
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewName}>{review.user_name}</Text>
                      <StarRating rating={review.rating} size={13} />
                    </View>
                    <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  {Array.isArray(review.images) && review.images.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.reviewImagesRow}
                    >
                      {review.images.map((image, index) => {
                        const uri = image.imageUrl || image.ImageUrl || image;
                        if (!uri || typeof uri !== 'string') return null;
                        return (
                          <Image
                            key={`${review.id}-img-${index}`}
                            source={{ uri }}
                            style={styles.reviewImage}
                            resizeMode="cover"
                          />
                        );
                      })}
                    </ScrollView>
                  ) : review.imageUrl || review.image_url ? (
                    <Image
                      source={{ uri: review.imageUrl || review.image_url }}
                      style={styles.reviewImage}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              ))}
              <LoadMoreButton
                currentCount={reviews.length}
                totalCount={
                  reviewsHasMore
                    ? Math.max(reviewsTotal, reviews.length + DEFAULT_PAGE_SIZE)
                    : reviews.length
                }
                loading={loadingMoreReviews}
                onPress={loadMoreReviews}
              />
              </>
            )}
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có sản phẩm nào</Text>
            ) : (
              <>
              {products.map((product) => {
                const overlayLabel = getProductImageOverlayLabel(product);
                const isPromotion =
                  Boolean(product.isPromotion) && Number(product.discountPercent) > 0;
                const promoLabels = isPromotion ? getProductPromoPriceLabels(product) : null;

                return (
                  <Pressable
                    key={product.id}
                    style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
                    onPress={() => handleProductPress(product.id)}
                  >
                    <View style={styles.productImageWrap}>
                      <View style={styles.productImage}>
                        {product.thumbnail ? (
                          <Image source={{ uri: product.thumbnail }} style={styles.productThumb} />
                        ) : (
                          <View style={styles.productEmojiWrap}>
                            <Text style={styles.productEmoji}>{product.image_emoji}</Text>
                          </View>
                        )}
                        {overlayLabel ? (
                          <View style={styles.soldOutMask} pointerEvents="none">
                            <Text style={styles.soldOutText}>{overlayLabel}</Text>
                          </View>
                        ) : null}
                        {isPromotion ? (
                          <View style={styles.promoBadge}>
                            <Text style={styles.promoBadgeText}>-{product.discountPercent}%</Text>
                          </View>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => toggleLikeProduct(product.id)}
                        hitSlop={8}
                        style={styles.productLikeBadge}
                      >
                        <Ionicons
                          name={likedProducts[product.id] ? 'heart' : 'heart-outline'}
                          size={18}
                          color={likedProducts[product.id] ? '#ef4444' : '#64748b'}
                        />
                        <Text style={styles.productLikeCount}>{Number(product.likeCount) || 0}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      {isPromotion && promoLabels ? (
                        <>
                          <Text style={styles.productOriginalPrice} numberOfLines={1}>
                            {promoLabels.originalLabel}
                          </Text>
                          <Text
                            style={[styles.productPrice, styles.productPromoPrice]}
                            numberOfLines={1}
                          >
                            {promoLabels.saleLabel}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.productPrice} numberOfLines={1}>
                          {formatPriceRange(
                            product.minPrice ?? product.price,
                            product.maxPrice ?? product.price
                          )}
                        </Text>
                      )}
                      <View style={styles.productSoldRow}>
                        <Text style={styles.productSold} numberOfLines={1}>
                          Đã bán: {product.soldCount || 0}
                        </Text>
                        {Number(product.pinProduct) > 0 ? (
                          <Ionicons
                            name="pin"
                            size={13}
                            color="#076F32"
                            style={styles.productPinIcon}
                          />
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              <LoadMoreButton
                currentCount={products.length}
                totalCount={
                  productsHasMore
                    ? Math.max(productsTotal, products.length + DEFAULT_PAGE_SIZE)
                    : products.length
                }
                loading={loadingMoreProducts}
                onPress={loadMoreProducts}
              />
              </>
            )}
          </View>
        )}
      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo gian hàng"
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportReason}
      />
      <ReportComposeModal
        visible={composeVisible}
        headerTitle="Chi tiết tố cáo gian hàng"
        reasonTitle={reportReason}
        onClose={() => {
          setComposeVisible(false);
          setReportReason('');
        }}
        onSubmit={handleReportComposeSubmit}
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
    color: '#076F32',
    fontWeight: '700',
  },
  lockedScreen: {
    backgroundColor: '#fffbeb',
    justifyContent: 'flex-start',
  },
  lockedHeader: {
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  lockedBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  lockedTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  lockedSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  lockedReportBtn: {
    backgroundColor: '#076F32',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  lockedReportBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
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
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverInitial: {
    fontSize: 72,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followBtn: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#076F32',
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
  shopFavoriteBtn: {
    marginTop: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  shopFavoriteBtnActive: {
    backgroundColor: '#ffe4e6',
    borderColor: '#fb7185',
  },
  shopFavoriteBtnText: {
    fontSize: 18,
    color: '#e11d48',
    fontWeight: '800',
  },
  actionBtnDisabled: {
    opacity: 0.55,
  },
  shopUsername: {
    fontSize: 14,
    color: '#076F32',
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
    color: '#076F32',
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
    marginBottom: 10,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  messageButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  messageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  infoRow: {
    marginBottom: 4,
  },
  infoLine: {
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: 2,
    gap: 8,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  distanceText: {
    flex: 1,
    minWidth: 0,
  },
  directionsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#A7D9B8',
    flexShrink: 0,
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
    borderBottomColor: '#076F32',
    backgroundColor: '#f8fffe',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#076F32',
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
  productImageWrap: {
    position: 'relative',
    width: '100%',
  },
  productImage: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productEmojiWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  productLikeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    zIndex: 6,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 30,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    paddingHorizontal: 9,
    justifyContent: 'center',
  },
  productLikeCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  productEmoji: {
    fontSize: 40,
  },
  productInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  productPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: '#076F32',
    marginBottom: 3,
  },
  productPromoPrice: {
    color: '#dc2626',
  },
  productOriginalPrice: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  promoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 4,
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  productSold: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  productSoldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 2,
  },
  productPinIcon: {
    marginLeft: 'auto',
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
    color: '#076F32',
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
    gap: 10,
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
  reviewImagesRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  reviewImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 24,
    width: '100%',
  },
});
