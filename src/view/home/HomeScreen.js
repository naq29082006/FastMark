import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { discoverProductsOnBackend, getProductCategoriesOnBackend, listPromotionProductsOnBackend } from '../../api/productApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { listActiveBannersOnBackend, recordBannerClickOnBackend } from '../../api/bannerApi';
import { formatDistance, hasValidLocation, normalizeExpoLocation, getDistanceFromCurrentLocation } from '../../core/utils/geo';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { resolveShopAvatarUri } from '../../core/utils/avatarInitial';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { mergeListById } from '../../core/utils/realtimeList';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import { loadNearbyRegisteredShops } from '../../viewmodel/map/mapViewModel';
import { normalizeProduct } from '../../model/productModel';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { usePublicSocket } from '../../hooks/usePublicSocket';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import SearchScreen from './SearchScreen';
import BuyerProfileScreen from '../profile/BuyerProfileScreen';
import AvatarBadge from '../shared/components/AvatarBadge';

const NEARBY_RADIUS_METERS = 5000;
const ALL_PRODUCTS_RADIUS_METERS = 20000;
const PROMOTION_MAX_DISTANCE_METERS = 5000;
const HOME_PAGE_SIZE = DEFAULT_PAGE_SIZE;
/** Gộp các event realtime công khai trong khoảng này để chỉ đồng bộ 1 lần. */
const PUBLIC_SYNC_DELAY_MS = 1500;

function createHomeSessionSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isWithinRadiusMeters(distanceMeters, maxMeters) {
  const value = Number(distanceMeters);
  if (!Number.isFinite(value) || value < 0) {
    return false;
  }
  return value <= maxMeters;
}

function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>Xem tất cả</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Memo: chỉ render lại đúng thẻ có props thay đổi (tránh nháy khi realtime). */
const HomeProductCard = memo(function HomeProductCard({
  product,
  isLiked,
  likeCount = 0,
  onToggleLike,
  onPress,
  grid = false,
}) {
  const distance = formatDistance(product.distanceMeters);
  const storeName = product.storeName || product.shopName || product.shop_name || 'Gian hàng';
  const isPromotion = Boolean(product.isPromotion) && Number(product.discountPercent) > 0;
  const unit = product.donVi ? `/${product.donVi}` : '';
  const promoLabels = isPromotion ? getProductPromoPriceLabels(product) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        grid && styles.productCardGrid,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(product.id)}
    >
      <View style={styles.productImageWrap}>
        {product.thumbnail ? (
          <Image source={{ uri: product.thumbnail }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productEmoji}>{product.image_emoji || '📦'}</Text>
          </View>
        )}
        {isPromotion ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>-{product.discountPercent}%</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.heartBtn}
          onPress={() => onToggleLike?.(product.id)}
          hitSlop={8}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? '#ef4444' : '#64748b'}
          />
          <Text style={styles.heartCountText}>{likeCount}</Text>
        </Pressable>
      </View>
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.productFooter}>
        {isPromotion && promoLabels ? (
          <View style={styles.promoPriceWrap}>
            <Text style={styles.productOriginalPrice} numberOfLines={1}>
              {promoLabels.originalLabel}
              {unit}
            </Text>
            <Text style={styles.productPrice} numberOfLines={1}>
              {promoLabels.saleLabel}
              {unit}
            </Text>
          </View>
        ) : (
          <Text style={styles.productPrice} numberOfLines={1}>
            {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
            {unit}
          </Text>
        )}
      </View>
      <View style={styles.productMetaRow}>
        <Ionicons name="storefront-outline" size={11} color="#64748b" />
        <Text style={styles.productStore} numberOfLines={1}>
          {storeName}
        </Text>
      </View>
      <View style={styles.productMetaRow}>
        <Ionicons name="star" size={9} color="#076F32" />
        <Text style={styles.productRating}>
          Đã bán: {Number(product.soldCount) || 0}
        </Text>
        {distance && distance !== '--' ? (
          <View style={styles.productDistanceRow}>
            <Ionicons name="location" size={9} color="#64748b" />
            <Text style={styles.productDistanceText}>{distance}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const HomeShopCard = memo(function HomeShopCard({ shop, onPress, grid = false }) {
  const distance = formatDistance(shop.distance_meters);
  const rating = Number(shop.rating_avg) || 0;
  const isOpen = shop.is_open !== false;
  const categoryLabel = shop.category_name || 'Gian hàng';
  const avatar = resolveShopAvatarUri(shop);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.shopCard,
        grid && styles.shopCardGrid,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(shop.id)}
    >
      <AvatarBadge
        name={shop.shop_name || shop.name || 'S'}
        uri={avatar}
        size={52}
      />
      <View style={styles.shopInfo}>
        <Text style={styles.shopName} numberOfLines={1}>
          {shop.shop_name || shop.name}
        </Text>
        <View style={styles.shopRatingRow}>
          <Ionicons name="star" size={11} color="#eab308" />
          <Text style={styles.shopRatingText}>
            {rating > 0 ? rating.toFixed(1) : 'Mới'}
          </Text>
        </View>
        <Text style={styles.shopCategory} numberOfLines={1}>
          {categoryLabel}
        </Text>
        <View style={styles.shopStatusRow}>
          <View style={[styles.shopStatusDot, !isOpen && styles.shopStatusDotClosed]} />
          <Text style={[styles.shopStatusText, !isOpen && styles.shopStatusTextClosed]}>
            {isOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
          </Text>
          {distance && distance !== '--' ? (
            <Text style={styles.shopDistance}>{distance}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const SEE_ALL_SECTIONS = {
  promotions: {
    title: 'Sản phẩm giảm giá',
    type: 'products',
  },
  nearbyProducts: {
    title: 'Sản phẩm gần bạn',
    type: 'products',
  },
  nearbyShops: {
    title: 'Cửa hàng gần bạn',
    type: 'shops',
  },
};

function CategoryChip({ category, label, onPress, active = false }) {
  const text = label || category?.categoryName || category?.name || '';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryChip,
        active && styles.categoryChipActive,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(category)}
    >
      <Text
        style={[styles.categoryLabel, active && styles.categoryLabelActive]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const BANNER_AUTO_MS = 3000;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_FALLBACK_WIDTH = SCREEN_WIDTH;
/** Banner full màn hình — tỉ lệ gần mockup trang chủ. */
const NEARBY_BANNER_HEIGHT = Math.round(SCREEN_WIDTH * 0.44);
const HOME_HORIZONTAL_PADDING = 4;

function HomeBannerCarousel({ banners, onPressInterest }) {
  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const slideWidthRef = useRef(BANNER_FALLBACK_WIDTH);
  const resettingRef = useRef(false);
  const [slideWidth, setSlideWidth] = useState(BANNER_FALLBACK_WIDTH);
  const orderedBanners = useMemo(
    () => (Array.isArray(banners) ? banners : []),
    [banners]
  );

  // Nhân bản slide đầu ở cuối để auto-scroll luôn trái → phải, rồi nhảy về đầu không animation.
  const loopBanners = useMemo(() => {
    if (orderedBanners.length <= 1) {
      return orderedBanners;
    }
    return [...orderedBanners, orderedBanners[0]];
  }, [orderedBanners]);

  const snapToIndex = useCallback((index, animated) => {
    indexRef.current = index;
    scrollRef.current?.scrollTo?.({
      x: index * slideWidthRef.current,
      animated,
    });
  }, []);

  const resetFromClone = useCallback(() => {
    if (orderedBanners.length <= 1) {
      return;
    }
    resettingRef.current = true;
    snapToIndex(0, false);
    requestAnimationFrame(() => {
      resettingRef.current = false;
    });
  }, [orderedBanners.length, snapToIndex]);

  useEffect(() => {
    indexRef.current = 0;
    resettingRef.current = false;
    scrollRef.current?.scrollTo?.({ x: 0, animated: false });
  }, [orderedBanners, slideWidth]);

  useEffect(() => {
    if (orderedBanners.length <= 1 || slideWidth <= 0) return undefined;
    const timer = setInterval(() => {
      if (resettingRef.current) {
        return;
      }
      const nextIndex = indexRef.current + 1;
      snapToIndex(nextIndex, true);
      // Đã tới bản sao slide đầu → nhảy về slide thật (không animation) để lặp một chiều.
      if (nextIndex >= orderedBanners.length) {
        setTimeout(resetFromClone, 350);
      }
    }, BANNER_AUTO_MS);
    return () => clearInterval(timer);
  }, [orderedBanners.length, resetFromClone, slideWidth, snapToIndex]);

  if (!orderedBanners.length) {
    return null;
  }

  return (
    <View
      style={styles.bannerCarouselWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== slideWidthRef.current) {
          slideWidthRef.current = nextWidth;
          setSlideWidth(nextWidth);
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.bannerCarousel, { height: NEARBY_BANNER_HEIGHT }]}
        contentContainerStyle={styles.bannerCarouselContent}
        onMomentumScrollEnd={(event) => {
          if (resettingRef.current) {
            return;
          }
          const width = slideWidthRef.current || BANNER_FALLBACK_WIDTH;
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          const maxIndex = loopBanners.length - 1;
          const safeIndex = Math.max(0, Math.min(maxIndex, nextIndex));
          indexRef.current = safeIndex;
          if (orderedBanners.length > 1 && safeIndex >= orderedBanners.length) {
            resetFromClone();
          }
        }}
      >
        {loopBanners.map((banner, slideIndex) => (
          <View
            key={slideIndex === orderedBanners.length ? `${banner.id}-loop` : banner.id}
            style={[
              styles.bannerSlide,
              {
                width: slideWidth,
                height: NEARBY_BANNER_HEIGHT,
              },
            ]}
          >
            {banner.image ? (
              <Image
                source={{ uri: banner.image }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.bannerFallback}>
                <Ionicons name="megaphone-outline" size={28} color="#ffffff" />
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.interestBtn, pressed && styles.pressed]}
              onPress={() => onPressInterest?.(banner)}
              hitSlop={6}
            >
              <Text style={styles.interestBtnText}>Quan tâm</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen({
  onOpenMap,
  onOpenProducts,
  onOpenBuyerOrders,
  onEditAccount,
  onOpenWallet,
  onOpenFavoriteProducts,
  onOpenReport,
  onStartSellerRegister,
  onOpenShop,
  onOpenWalletTopUp,
  onNavigateDirections,
  resumeReserveRequest = null,
  onResumeReserveHandled,
  keepNestedAcrossTabs = false,
  isScreenActive = true,
  onNavigationStateChange,
}) {
  const insets = useScreenInsets();

  const [currentLocation, setCurrentLocation] = useState(null);
  const [products, setProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [promotionProducts, setPromotionProducts] = useState([]);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [shopsHasMore, setShopsHasMore] = useState(false);
  const [promotionsHasMore, setPromotionsHasMore] = useState(false);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [shopsTotal, setShopsTotal] = useState(0);
  const [promotionsTotal, setPromotionsTotal] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [loadingMoreShops, setLoadingMoreShops] = useState(false);
  const [loadingMorePromotions, setLoadingMorePromotions] = useState(false);
  const [loadingMoreCatalog, setLoadingMoreCatalog] = useState(false);
  const productsPageRef = useRef(1);
  const shopsPageRef = useRef(1);
  const promotionsPageRef = useRef(1);
  const catalogPageRef = useRef(1);
  const homeSeedRef = useRef(createHomeSessionSeed());
  const publicSyncTimerRef = useRef(null);
  const wasScreenActiveRef = useRef(isScreenActive);
  const [likedProducts, setLikedProducts] = useState({});
  const likedProductsRef = useRef(likedProducts);
  likedProductsRef.current = likedProducts;
  // Trạng thái tym ban đầu từ server — để hiển thị số tym không bị lệch khi user bấm tym.
  const initialLikedRef = useRef({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [showSearchScreen, setShowSearchScreen] = useState(false);
  const [returnToSearchAfterDetail, setReturnToSearchAfterDetail] = useState(false);
  const searchDetailStackRef = useRef({ productId: null, storeId: null });
  const [seeAllSection, setSeeAllSection] = useState(null);

  useEffect(() => {
    onNavigationStateChange?.(
      Boolean(
        isScreenActive &&
          (selectedProductId ||
            selectedStoreId ||
            selectedBuyerUserId ||
            showSearchScreen ||
            seeAllSection)
      )
    );
  }, [
    isScreenActive,
    onNavigationStateChange,
    seeAllSection,
    selectedBuyerUserId,
    selectedProductId,
    selectedStoreId,
    showSearchScreen,
  ]);

  useEffect(() => {
    if (isScreenActive || keepNestedAcrossTabs) {
      return;
    }
    setSelectedProductId(null);
    setSelectedStoreId(null);
    setSelectedBuyerUserId(null);
    setShowSearchScreen(false);
    // Rời bottom tab Trang chủ → reset filter danh mục về mặc định.
    setSelectedCategoryId('');
  }, [isScreenActive, keepNestedAcrossTabs]);

  useEffect(() => {
    if (!resumeReserveRequest?.productId || !resumeReserveRequest?.at) {
      return;
    }
    setSelectedStoreId(null);
    setSelectedProductId(String(resumeReserveRequest.productId));
  }, [resumeReserveRequest?.at, resumeReserveRequest?.productId]);

  const loadLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setCurrentLocation(null);
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation = normalizeExpoLocation(position);
      setCurrentLocation(nextLocation);
      return nextLocation;
    } catch {
      setCurrentLocation(null);
      return null;
    } finally {
      setLocationChecked(true);
    }
  }, []);

  const loadHomeMeta = useCallback(async ({ seed = homeSeedRef.current } = {}) => {
    try {
      const [categoryRows, bannerRows] = await Promise.all([
        getProductCategoriesOnBackend().catch(() => []),
        listActiveBannersOnBackend({ limit: 8, seed }).catch(() => []),
      ]);
      setCategories((current) =>
        mergeListById(current, Array.isArray(categoryRows) ? categoryRows : [])
      );
      setBanners((current) =>
        mergeListById(current, Array.isArray(bannerRows) ? bannerRows : [])
      );
    } catch {
      setCategories([]);
      setBanners([]);
    }

    // Favorites không chặn load sản phẩm.
    (async () => {
      try {
        const idToken = await getCurrentUserIdToken(false);
        if (!idToken) {
          return;
        }
        const productIds = await getFavoriteProductIdsOnBackend(idToken).catch(() => []);
        const likedMap = {};
        (productIds || []).forEach((productId) => {
          likedMap[String(productId)] = true;
        });
        initialLikedRef.current = likedMap;
        setLikedProducts(likedMap);
      } catch {
        // Ignore favorite preload errors.
      }
    })();
  }, []);

  const loadNearbyContent = useCallback(
    async ({
      refresh = false,
      location = currentLocation,
      ready = locationChecked,
      seed = homeSeedRef.current,
      silent = false,
    } = {}) => {
      // Chưa xong GPS: giữ loading, đừng clear products (tránh race ghi đè []).
      if (!ready) {
        return;
      }

      // silent = cập nhật realtime: không bật spinner/refresh indicator → không nháy.
      if (!silent) {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      }

      try {
        if (!hasValidLocation(location)) {
          setProducts([]);
          setShops([]);
          setCatalogProducts([]);
          setPromotionProducts([]);
          setProductsHasMore(false);
          setShopsHasMore(false);
          setPromotionsHasMore(false);
          setCatalogHasMore(false);
          setProductsTotal(0);
          setShopsTotal(0);
          setPromotionsTotal(0);
          setCatalogTotal(0);
          return;
        }

        productsPageRef.current = 1;
        shopsPageRef.current = 1;
        promotionsPageRef.current = 1;
        catalogPageRef.current = 1;

        const [productPage, shopPage, catalogPage, promoPage] = await Promise.all([
          discoverProductsOnBackend({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
            categoryId: selectedCategoryId,
            page: 1,
            limit: HOME_PAGE_SIZE,
            seed,
          }).catch(() => ({ items: [], hasMore: false })),
          loadNearbyRegisteredShops({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
            page: 1,
            limit: HOME_PAGE_SIZE,
            seed,
          }).catch(() => ({ items: [], hasMore: false })),
          discoverProductsOnBackend({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: ALL_PRODUCTS_RADIUS_METERS,
            categoryId: selectedCategoryId,
            page: 1,
            limit: HOME_PAGE_SIZE,
            seed,
          }).catch(() => ({ items: [], hasMore: false })),
          listPromotionProductsOnBackend({
            page: 1,
            limit: HOME_PAGE_SIZE,
            latitude: location.latitude,
            longitude: location.longitude,
            seed,
          }).catch(() => ({ items: [], hasMore: false })),
        ]);

        const promoRows = promoPage.items || [];
        const promoById = new Map();
        promoRows.forEach((row) => {
          const promo = normalizeProduct(row);
          if (promo.id && promo.isPromotion && Number(promo.discountPercent) > 0) {
            promoById.set(promo.id, promo);
          }
        });

        function withPromotionFields(product) {
          const promo = promoById.get(product.id);
          if (!promo) {
            return product;
          }
          return {
            ...product,
            isPromotion: true,
            discountPercent: promo.discountPercent,
            originalPrice: promo.originalPrice ?? product.minPrice,
            originalMaxPrice: promo.originalMaxPrice ?? product.maxPrice,
            promotionPrice: promo.promotionPrice,
            promotionMinPrice: promo.promotionMinPrice,
            promotionMaxPrice: promo.promotionMaxPrice,
            displayPrice: promo.displayPrice ?? promo.promotionPrice ?? product.displayPrice,
          };
        }

        const nearbyProducts = (productPage.items || []).map((row) =>
          withPromotionFields(normalizeProduct(row))
        );
        const catalog = (catalogPage.items || [])
          .map((row) => withPromotionFields(normalizeProduct(row)))
          .filter((product) => !product.isOutOfStock && !product.isUnavailable);

        setProducts((current) => mergeListById(current, nearbyProducts));
        setProductsHasMore(Boolean(productPage.hasMore));
        setProductsTotal(Math.max(0, Number(productPage.total) || 0));
        setShops((current) => mergeListById(current, shopPage.items || shopPage.shops || []));
        setShopsHasMore(Boolean(shopPage.hasMore));
        setShopsTotal(Math.max(0, Number(shopPage.total) || 0));
        setCatalogProducts((current) => mergeListById(current, catalog));
        setCatalogHasMore(Boolean(catalogPage.hasMore));
        setCatalogTotal(Math.max(0, Number(catalogPage.total) || 0));

        const distanceByProductId = new Map();
        const distanceByStoreId = new Map();
        [...(productPage.items || []), ...(catalogPage.items || [])].forEach((row) => {
          const normalized = normalizeProduct(row);
          if (
            normalized.id &&
            normalized.distanceMeters != null &&
            Number.isFinite(Number(normalized.distanceMeters))
          ) {
            distanceByProductId.set(normalized.id, Number(normalized.distanceMeters));
          }
          if (
            normalized.store_id &&
            normalized.distanceMeters != null &&
            Number.isFinite(Number(normalized.distanceMeters))
          ) {
            distanceByStoreId.set(normalized.store_id, Number(normalized.distanceMeters));
          }
        });

        const promotions = promoRows
          .map((row) => {
            const product = normalizeProduct(row);
            const fromDiscover =
              distanceByProductId.get(product.id) ??
              distanceByStoreId.get(product.store_id) ??
              null;

            let distanceMeters = product.distanceMeters;
            if (
              fromDiscover != null &&
              (distanceMeters == null ||
                !Number.isFinite(Number(distanceMeters)) ||
                (Number(distanceMeters) === 0 && fromDiscover > 50))
            ) {
              distanceMeters = fromDiscover;
            }

            if (
              (distanceMeters == null || !Number.isFinite(Number(distanceMeters))) &&
              hasValidLocation(location)
            ) {
              const shopLat = Number(row.shopLatitude ?? row.latitude);
              const shopLng = Number(row.shopLongitude ?? row.longitude);
              if (Number.isFinite(shopLat) && Number.isFinite(shopLng)) {
                const meters = getDistanceFromCurrentLocation(location, {
                  latitude: shopLat,
                  longitude: shopLng,
                });
                if (meters != null) {
                  distanceMeters = meters;
                }
              }
            }

            return { ...product, distanceMeters };
          })
          .filter((product) =>
            isWithinRadiusMeters(product.distanceMeters, PROMOTION_MAX_DISTANCE_METERS)
          );

        setPromotionProducts((current) => mergeListById(current, promotions));
        setPromotionsHasMore(Boolean(promoPage.hasMore));
        setPromotionsTotal(Math.max(0, Number(promoPage.total) || 0));
      } finally {
        if (!silent) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [currentLocation, locationChecked, selectedCategoryId]
  );

  const loadMoreNearbyProducts = useCallback(async () => {
    if (loadingMoreProducts || !productsHasMore || !hasValidLocation(currentLocation)) {
      return;
    }
    setLoadingMoreProducts(true);
    try {
      const nextPage = productsPageRef.current + 1;
      const pageResult = await discoverProductsOnBackend({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters: NEARBY_RADIUS_METERS,
        categoryId: selectedCategoryId,
        page: nextPage,
        limit: HOME_PAGE_SIZE,
        seed: homeSeedRef.current,
      });
      productsPageRef.current = nextPage;
      setProducts((prev) =>
        appendUniqueById(prev, (pageResult.items || []).map((row) => normalizeProduct(row)))
      );
      setProductsHasMore(Boolean(pageResult.hasMore));
    } catch {
      // Giữ danh sách hiện tại nếu load thêm thất bại.
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [currentLocation, loadingMoreProducts, productsHasMore, selectedCategoryId]);

  const loadMoreNearbyShops = useCallback(async () => {
    if (loadingMoreShops || !shopsHasMore || !hasValidLocation(currentLocation)) {
      return;
    }
    setLoadingMoreShops(true);
    try {
      const nextPage = shopsPageRef.current + 1;
      const pageResult = await loadNearbyRegisteredShops({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters: NEARBY_RADIUS_METERS,
        page: nextPage,
        limit: HOME_PAGE_SIZE,
        seed: homeSeedRef.current,
      });
      shopsPageRef.current = nextPage;
      setShops((prev) => appendUniqueById(prev, pageResult.items || pageResult.shops || []));
      setShopsHasMore(Boolean(pageResult.hasMore));
    } catch {
      // ignore
    } finally {
      setLoadingMoreShops(false);
    }
  }, [currentLocation, loadingMoreShops, shopsHasMore]);

  const loadMorePromotions = useCallback(async () => {
    if (loadingMorePromotions || !promotionsHasMore || !hasValidLocation(currentLocation)) {
      return;
    }
    setLoadingMorePromotions(true);
    try {
      const nextPage = promotionsPageRef.current + 1;
      const pageResult = await listPromotionProductsOnBackend({
        page: nextPage,
        limit: HOME_PAGE_SIZE,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        seed: homeSeedRef.current,
      });
      promotionsPageRef.current = nextPage;
      const nextItems = (pageResult.items || [])
        .map((row) => normalizeProduct(row))
        .filter((product) =>
          isWithinRadiusMeters(product.distanceMeters, PROMOTION_MAX_DISTANCE_METERS)
        );
      setPromotionProducts((prev) => appendUniqueById(prev, nextItems));
      setPromotionsHasMore(Boolean(pageResult.hasMore));
    } catch {
      // ignore
    } finally {
      setLoadingMorePromotions(false);
    }
  }, [currentLocation, loadingMorePromotions, promotionsHasMore]);

  const loadMoreCatalogProducts = useCallback(async () => {
    if (loadingMoreCatalog || !catalogHasMore || !hasValidLocation(currentLocation)) {
      return;
    }
    setLoadingMoreCatalog(true);
    try {
      const nextPage = catalogPageRef.current + 1;
      const pageResult = await discoverProductsOnBackend({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters: ALL_PRODUCTS_RADIUS_METERS,
        categoryId: selectedCategoryId,
        page: nextPage,
        limit: HOME_PAGE_SIZE,
        seed: homeSeedRef.current,
      });
      catalogPageRef.current = nextPage;
      const nextItems = (pageResult.items || [])
        .map((row) => normalizeProduct(row))
        .filter((product) => !product.isOutOfStock && !product.isUnavailable);
      setCatalogProducts((prev) => appendUniqueById(prev, nextItems));
      setCatalogHasMore(Boolean(pageResult.hasMore));
    } catch {
      // ignore
    } finally {
      setLoadingMoreCatalog(false);
    }
  }, [catalogHasMore, currentLocation, loadingMoreCatalog, selectedCategoryId]);

  useEffect(() => {
    loadLocation();
    loadHomeMeta();
  }, [loadLocation, loadHomeMeta]);

  useEffect(() => {
    loadNearbyContent();
  }, [loadNearbyContent]);

  useEffect(() => {
    const wasActive = wasScreenActiveRef.current;
    wasScreenActiveRef.current = isScreenActive;
    if (!wasActive && isScreenActive) {
      const seed = createHomeSessionSeed();
      homeSeedRef.current = seed;
      loadHomeMeta({ seed });
      loadNearbyContent({ refresh: true, seed });
    }
  }, [isScreenActive, loadHomeMeta, loadNearbyContent]);

  /**
   * Realtime công khai (banner/sản phẩm) đến rất dồn dập nên được gộp lại và
   * đồng bộ im lặng: không spinner, chỉ item nào đổi mới render lại.
   */
  const handlePublicUpdated = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim();
      if (type !== 'banner' && type !== 'product') {
        return;
      }
      if (publicSyncTimerRef.current) {
        return;
      }
      publicSyncTimerRef.current = setTimeout(() => {
        publicSyncTimerRef.current = null;
        loadHomeMeta();
        loadNearbyContent({ silent: true });
      }, PUBLIC_SYNC_DELAY_MS);
    },
    [loadHomeMeta, loadNearbyContent]
  );

  useEffect(
    () => () => {
      if (publicSyncTimerRef.current) {
        clearTimeout(publicSyncTimerRef.current);
        publicSyncTimerRef.current = null;
      }
    },
    []
  );

  usePublicSocket({ enabled: true, onPublicUpdated: handlePublicUpdated });

  // Handler giữ identity ổn định để thẻ sản phẩm đã memo không render lại theo state tym.
  const toggleLikeProduct = useCallback(
    async (productId) => {
      const normalizedId = String(productId);
      const wasLiked = Boolean(likedProductsRef.current[normalizedId]);
      setLikedProducts((prev) => ({ ...prev, [normalizedId]: !wasLiked }));

      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
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
      }
    },
    []
  );

  function getDisplayLikeCount(item) {
    const id = String(item.id);
    const base = Math.max(0, Number(item.likeCount) || 0);
    const wasLiked = Boolean(initialLikedRef.current[id]);
    const nowLiked = Boolean(likedProducts[id]);
    return Math.max(0, base + (nowLiked ? 1 : 0) - (wasLiked ? 1 : 0));
  }

  function handleBannerInterest(banner) {
    const bannerId = String(banner?.id || '').trim();
    if (bannerId) {
      recordBannerClickOnBackend(bannerId).catch(() => {});
    }
    const targetType = Number(banner?.targetType);
    const targetId = String(banner?.targetId || '').trim();
    if (targetType === 1 && targetId) {
      setSelectedProductId(targetId);
      return;
    }
    if (targetType === 2 && targetId) {
      setSelectedStoreId(targetId);
      return;
    }
    const shopId = String(banner?.shopId || '').trim();
    if (shopId) {
      setSelectedStoreId(shopId);
    }
  }

  function openFromSearch(openDetail) {
    setReturnToSearchAfterDetail(true);
    searchDetailStackRef.current = { productId: null, storeId: null };
    setShowSearchScreen(false);
    openDetail();
  }

  if (selectedBuyerUserId) {
    return (
      <BuyerProfileScreen
        userId={selectedBuyerUserId}
        onBack={() => {
          setSelectedBuyerUserId(null);
          if (returnToSearchAfterDetail) {
            setReturnToSearchAfterDetail(false);
            setShowSearchScreen(true);
          }
        }}
        onOpenShop={(shopId) => {
          setSelectedBuyerUserId(null);
          setSelectedStoreId(String(shopId));
        }}
        onOpenUser={(nextUserId) => setSelectedBuyerUserId(String(nextUserId))}
      />
    );
  }

  if (selectedProductId) {
    return (
      <ProductDetailScreen
        productId={selectedProductId}
        onBack={() => {
          setSelectedProductId(null);
          onResumeReserveHandled?.();
          const returnStoreId = searchDetailStackRef.current.storeId;
          if (returnStoreId) {
            searchDetailStackRef.current.storeId = null;
            setSelectedStoreId(String(returnStoreId));
            return;
          }
          if (returnToSearchAfterDetail) {
            setReturnToSearchAfterDetail(false);
            searchDetailStackRef.current = { productId: null, storeId: null };
            setShowSearchScreen(true);
          }
        }}
        onStorePress={(storeId) => {
          if (returnToSearchAfterDetail) {
            searchDetailStackRef.current.productId = String(selectedProductId || '');
            searchDetailStackRef.current.storeId = null;
          }
          setSelectedProductId(null);
          setSelectedStoreId(storeId);
        }}
        onOrderSuccess={onOpenBuyerOrders}
        onOpenTopUp={onOpenWalletTopUp}
        reservationSource="home"
        resumeReserveRequest={
          resumeReserveRequest &&
          String(resumeReserveRequest.productId) === String(selectedProductId)
            ? resumeReserveRequest
            : null
        }
        onResumeReserveConsumed={onResumeReserveHandled}
      />
    );
  }

  if (selectedStoreId) {
    return (
      <StoreDetailScreen
        storeId={selectedStoreId}
        originLocation={currentLocation}
        onBack={() => {
          setSelectedStoreId(null);
          const returnProductId = searchDetailStackRef.current.productId;
          if (returnProductId) {
            searchDetailStackRef.current.productId = null;
            setSelectedProductId(String(returnProductId));
            return;
          }
          if (returnToSearchAfterDetail) {
            setReturnToSearchAfterDetail(false);
            searchDetailStackRef.current = { productId: null, storeId: null };
            setShowSearchScreen(true);
          }
        }}
        onProductPress={(productId) => {
          if (returnToSearchAfterDetail) {
            searchDetailStackRef.current.productId = null;
            searchDetailStackRef.current.storeId = String(selectedStoreId || '');
          }
          setSelectedStoreId(null);
          setSelectedProductId(productId);
        }}
        onNavigateDirections={onNavigateDirections}
      />
    );
  }

  if (showSearchScreen) {
    return (
      <SearchScreen
        currentLocation={currentLocation}
        onBack={() => {
          setShowSearchScreen(false);
          setReturnToSearchAfterDetail(false);
        }}
        onOpenProduct={(productId) => {
          openFromSearch(() => setSelectedProductId(String(productId)));
        }}
        onOpenShop={(shopId) => {
          openFromSearch(() => setSelectedStoreId(String(shopId)));
        }}
        onOpenBuyer={(userId) => {
          openFromSearch(() => setSelectedBuyerUserId(String(userId)));
        }}
      />
    );
  }

  const categoryKey = String(selectedCategoryId || '').trim();
  const visiblePromotionProducts = categoryKey
    ? promotionProducts.filter(
        (product) => String(product.categoryId || '') === categoryKey
      )
    : promotionProducts;

  if (seeAllSection && SEE_ALL_SECTIONS[seeAllSection]) {
    const sectionMeta = SEE_ALL_SECTIONS[seeAllSection];
    const seeAllProducts =
      seeAllSection === 'promotions'
        ? visiblePromotionProducts
        : seeAllSection === 'nearbyProducts'
          ? products
          : [];
    const seeAllShops = seeAllSection === 'nearbyShops' ? shops : [];
    const seeAllLoadingMore =
      seeAllSection === 'promotions'
        ? loadingMorePromotions
        : seeAllSection === 'nearbyProducts'
          ? loadingMoreProducts
          : loadingMoreShops;
    const seeAllHasMore =
      seeAllSection === 'promotions'
        ? promotionsHasMore
        : seeAllSection === 'nearbyProducts'
          ? productsHasMore
          : shopsHasMore;
    const onSeeAllLoadMore =
      seeAllSection === 'promotions'
        ? loadMorePromotions
        : seeAllSection === 'nearbyProducts'
          ? loadMoreNearbyProducts
          : loadMoreNearbyShops;
    const seeAllTotal =
      seeAllSection === 'promotions'
        ? promotionsTotal
        : seeAllSection === 'nearbyProducts'
          ? productsTotal
          : shopsTotal;
    const seeAllCount =
      sectionMeta.type === 'products' ? seeAllProducts.length : seeAllShops.length;

    return (
      <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
        <SubScreenHeader title={sectionMeta.title} onBack={() => setSeeAllSection(null)} />
        {sectionMeta.type === 'products' ? (
          <FlatList
            data={seeAllProducts}
            keyExtractor={(item) => `see-all-${String(item.id)}`}
            numColumns={2}
            columnWrapperStyle={styles.productGrid}
            contentContainerStyle={[
              styles.seeAllContent,
              { paddingBottom: insets.tabRootScrollPaddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Chưa có sản phẩm nào.</Text>}
            ListFooterComponent={
              seeAllCount > 0 ? (
                <LoadMoreButton
                  currentCount={seeAllCount}
                  totalCount={
                    seeAllHasMore
                      ? Math.max(seeAllTotal, seeAllCount + HOME_PAGE_SIZE)
                      : seeAllCount
                  }
                  loading={seeAllLoadingMore}
                  onPress={onSeeAllLoadMore}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <HomeProductCard
                product={item}
                grid
                isLiked={Boolean(likedProducts[String(item.id)])}
                likeCount={getDisplayLikeCount(item)}
                onToggleLike={toggleLikeProduct}
                onPress={setSelectedProductId}
              />
            )}
          />
        ) : (
          <FlatList
            data={seeAllShops}
            keyExtractor={(item) => `see-all-shop-${String(item.id)}`}
            numColumns={2}
            columnWrapperStyle={styles.shopGrid}
            contentContainerStyle={[
              styles.seeAllContent,
              { paddingBottom: insets.tabRootScrollPaddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Chưa có cửa hàng nào.</Text>}
            ListFooterComponent={
              seeAllCount > 0 ? (
                <LoadMoreButton
                  currentCount={seeAllCount}
                  totalCount={
                    seeAllHasMore
                      ? Math.max(seeAllTotal, seeAllCount + HOME_PAGE_SIZE)
                      : seeAllCount
                  }
                  loading={seeAllLoadingMore}
                  onPress={onSeeAllLoadMore}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <HomeShopCard shop={item} grid onPress={setSelectedStoreId} />
            )}
          />
        )}
      </View>
    );
  }

  function handleSelectCategory(categoryId = '') {
    setSelectedCategoryId(String(categoryId || ''));
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.tabRootScrollPaddingBottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              const seed = createHomeSessionSeed();
              homeSeedRef.current = seed;
              const nextLocation = await loadLocation();
              await loadHomeMeta({ seed });
              await loadNearbyContent({
                refresh: true,
                location: nextLocation,
                ready: true,
                seed,
              });
            }}
            tintColor="#076F32"
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle} numberOfLines={1}>
            Sản phẩm
          </Text>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.bellBtn}
              onPress={() => setShowSearchScreen(true)}
              accessibilityRole="button"
              accessibilityLabel="Tìm kiếm"
            >
              <Ionicons name="search" size={22} color="#334155" />
            </Pressable>
          </View>
        </View>

        <View style={styles.bannerFullBleed}>
          {banners.length > 0 ? (
            <HomeBannerCarousel
              banners={banners}
              onPressInterest={handleBannerInterest}
            />
          ) : (
            <Pressable style={styles.mapBanner} onPress={onOpenMap}>
              <View style={styles.mapBannerCopy}>
                <Text style={styles.mapBannerTitle}>Trợ quê – Gần bạn</Text>
                <Text style={styles.mapBannerSubtitle}>
                  Kết nối người mua và người bán trong khu vực của bạn
                </Text>
                <View style={styles.mapBannerBtn}>
                  <Text style={styles.mapBannerBtnText}>Xem trên bản đồ</Text>
                </View>
              </View>
              <View style={styles.mapBannerArt}>
                <View style={styles.mapGrid}>
                  <View style={[styles.mapLine, styles.mapLineH1]} />
                  <View style={[styles.mapLine, styles.mapLineH2]} />
                  <View style={[styles.mapLine, styles.mapLineV1]} />
                  <View style={[styles.mapLine, styles.mapLineV2]} />
                </View>
                <View style={styles.mapPulseOuter}>
                  <View style={styles.mapPulseInner} />
                </View>
              </View>
            </Pressable>
          )}
        </View>

        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            <CategoryChip
              label="Tất cả"
              active={!selectedCategoryId}
              onPress={() => handleSelectCategory('')}
            />
            {categories.map((item) => (
              <CategoryChip
                key={String(item.id)}
                category={item}
                active={String(selectedCategoryId) === String(item.id)}
                onPress={(category) => handleSelectCategory(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        {visiblePromotionProducts.length > 0 ? (
          <>
            <SectionHeader
              title="🔥 Sản phẩm giảm giá"
              onSeeAll={() => setSeeAllSection('promotions')}
            />
            <FlatList
              horizontal
              data={visiblePromotionProducts}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              ListFooterComponent={
                <LoadMoreButton
                  currentCount={visiblePromotionProducts.length}
                  totalCount={
                    promotionsHasMore
                      ? Math.max(
                          promotionsTotal,
                          visiblePromotionProducts.length + HOME_PAGE_SIZE
                        )
                      : visiblePromotionProducts.length
                  }
                  loading={loadingMorePromotions}
                  onPress={loadMorePromotions}
                />
              }
              renderItem={({ item }) => (
                <HomeProductCard
                  product={item}
                  isLiked={Boolean(likedProducts[String(item.id)])}
                  likeCount={getDisplayLikeCount(item)}
                  onToggleLike={toggleLikeProduct}
                  onPress={setSelectedProductId}
                />
              )}
            />
          </>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color="#076F32" style={styles.sectionLoader} />
        ) : null}

        {!isLoading && products.length > 0 ? (
          <>
            <SectionHeader
              title="Sản phẩm gần bạn"
              onSeeAll={() => setSeeAllSection('nearbyProducts')}
            />
            <FlatList
              horizontal
              data={products}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              ListFooterComponent={
                <LoadMoreButton
                  currentCount={products.length}
                  totalCount={
                    productsHasMore
                      ? Math.max(productsTotal, products.length + HOME_PAGE_SIZE)
                      : products.length
                  }
                  loading={loadingMoreProducts}
                  onPress={loadMoreNearbyProducts}
                />
              }
              renderItem={({ item }) => (
                <HomeProductCard
                  product={item}
                  isLiked={Boolean(likedProducts[String(item.id)])}
                  likeCount={getDisplayLikeCount(item)}
                  onToggleLike={toggleLikeProduct}
                  onPress={setSelectedProductId}
                />
              )}
            />
          </>
        ) : null}

        {!isLoading && shops.length > 0 ? (
          <>
            <SectionHeader
              title="Cửa hàng gần bạn"
              onSeeAll={() => setSeeAllSection('nearbyShops')}
            />
            <FlatList
              horizontal
              data={shops}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              ListFooterComponent={
                <LoadMoreButton
                  currentCount={shops.length}
                  totalCount={
                    shopsHasMore
                      ? Math.max(shopsTotal, shops.length + HOME_PAGE_SIZE)
                      : shops.length
                  }
                  loading={loadingMoreShops}
                  onPress={loadMoreNearbyShops}
                />
              }
              renderItem={({ item }) => (
                <HomeShopCard shop={item} onPress={setSelectedStoreId} />
              )}
            />
          </>
        ) : null}

        {!isLoading && catalogProducts.length > 0 ? (
          <>
            <SectionHeader title="Tất cả sản phẩm" />
            <View style={styles.productGrid}>
              {catalogProducts.map((item) => (
                <HomeProductCard
                  key={`all-${String(item.id)}`}
                  product={item}
                  grid
                  isLiked={Boolean(likedProducts[String(item.id)])}
                  likeCount={getDisplayLikeCount(item)}
                  onToggleLike={toggleLikeProduct}
                  onPress={setSelectedProductId}
                />
              ))}
            </View>
            <LoadMoreButton
              currentCount={catalogProducts.length}
              totalCount={
                catalogHasMore
                  ? Math.max(catalogTotal, catalogProducts.length + HOME_PAGE_SIZE)
                  : catalogProducts.length
              }
              loading={loadingMoreCatalog}
              onPress={loadMoreCatalogProducts}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: HOME_HORIZONTAL_PADDING,
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  screenTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
  },
  brandTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#055528',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  utilityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  bannerFullBleed: {
    marginHorizontal: -HOME_HORIZONTAL_PADDING,
    marginBottom: 4,
  },
  categorySection: {
    marginHorizontal: -HOME_HORIZONTAL_PADDING,
    marginTop: 0,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: HOME_HORIZONTAL_PADDING,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingRight: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexShrink: 0,
  },
  categoryChipActive: {
    backgroundColor: '#E6F4EC',
    borderColor: '#076F32',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#076F32',
  },
  bannerCarouselWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 0,
  },
  bannerCarousel: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 0,
  },
  bannerCarouselContent: {
    alignItems: 'stretch',
  },
  bannerSlide: {
    overflow: 'hidden',
    backgroundColor: '#055528',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  interestBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  interestBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  mapBanner: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#076F32',
    height: NEARBY_BANNER_HEIGHT,
    minHeight: NEARBY_BANNER_HEIGHT,
  },
  mapBannerCopy: {
    flex: 1.15,
    paddingVertical: 20,
    paddingHorizontal: 18,
    justifyContent: 'center',
    gap: 8,
  },
  mapBannerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  mapBannerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  mapBannerBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapBannerBtnText: {
    color: '#055528',
    fontSize: 12,
    fontWeight: '800',
  },
  mapBannerArt: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLine: {
    position: 'absolute',
    backgroundColor: '#cbd5e1',
  },
  mapLineH1: {
    left: 0,
    right: 0,
    top: '35%',
    height: 2,
  },
  mapLineH2: {
    left: 0,
    right: 0,
    top: '68%',
    height: 2,
  },
  mapLineV1: {
    top: 0,
    bottom: 0,
    left: '30%',
    width: 2,
  },
  mapLineV2: {
    top: 0,
    bottom: 0,
    left: '72%',
    width: 2,
  },
  mapPulseOuter: {
    position: 'absolute',
    top: '42%',
    left: '48%',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPulseInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
  },
  sectionLoader: {
    marginVertical: 18,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
  },
  hList: {
    gap: 8,
    paddingBottom: 14,
    paddingRight: 8,
  },
  hListLoader: {
    width: 40,
    alignSelf: 'center',
    marginHorizontal: 8,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
  },
  loadMoreText: {
    color: '#076F32',
    fontSize: 13,
    fontWeight: '700',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingBottom: 14,
  },
  seeAllContent: {
    paddingHorizontal: HOME_HORIZONTAL_PADDING,
    paddingTop: 4,
    flexGrow: 1,
  },
  shopGrid: {
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 14,
  },
  productCard: {
    width: 168,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    paddingBottom: 6,
  },
  productCardGrid: {
    width: '48.5%',
  },
  productImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: {
    fontSize: 18,
  },
  productDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  productDistanceText: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '700',
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
  promoPriceWrap: {
    flex: 1,
    gap: 1,
  },
  heartBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 9,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
  },
  heartCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  productName: {
    marginTop: 4,
    marginHorizontal: 6,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#0f172a',
    minHeight: 34,
  },
  productPrice: {
    flex: 1,
    marginHorizontal: 6,
    marginTop: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  productOriginalPrice: {
    marginHorizontal: 6,
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  productFooter: {
    marginTop: 4,
    marginHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginHorizontal: 6,
    marginTop: 1,
  },
  productStore: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  productRating: {
    fontSize: 8,
    color: '#334155',
    fontWeight: '700',
  },
  shopCard: {
    width: 196,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  shopCardGrid: {
    width: '100%',
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  shopName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  shopRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  shopDistance: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 'auto',
  },
  shopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shopStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#076F32',
  },
  shopStatusDotClosed: {
    backgroundColor: '#94a3b8',
  },
  shopStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#076F32',
  },
  shopStatusTextClosed: {
    color: '#94a3b8',
  },
  shopCategory: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 1,
  },
});
