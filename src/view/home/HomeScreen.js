import { useCallback, useEffect, useState } from 'react';
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
import { useDispatch, useSelector } from 'react-redux';

import { discoverProductsOnBackend, getProductCategoriesOnBackend } from '../../api/productApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { listActiveBannersOnBackend } from '../../api/bannerApi';
import { listNearbyVouchersOnBackend } from '../../api/voucherApi';
import { formatDistance, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { formatPrice, formatPriceRange } from '../../core/utils/productFormat';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { loadNearbyRegisteredShops } from '../../viewmodel/map/mapViewModel';
import { normalizeProduct } from '../../model/productModel';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { logoutUser } from '../../viewmodel/auth/authSlice';
import { getSellerRegisterButtonLabel } from '../seller/sellerRegistrationFlow';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import ProductCategoriesScreen from './ProductCategoriesScreen';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import AvatarBadge from '../shared/components/AvatarBadge';
import BuyerQuickMenu from '../shared/components/BuyerQuickMenu';

const NEARBY_RADIUS_METERS = 5000;
const CATEGORY_PREVIEW_COUNT = 5;

function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>Xem tất cả {'>'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HomeProductCard({ product, isLiked, onToggleLike, onPress }) {
  const distance = formatDistance(product.distanceMeters);
  const storeName = product.storeName || 'Gian hàng';

  return (
    <Pressable
      style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
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
        {distance && distance !== '--' ? (
          <View style={styles.distanceTag}>
            <Text style={styles.distanceTagText}>{distance}</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.heartBtn}
          onPress={() => onToggleLike?.(product.id)}
          hitSlop={8}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={14}
            color={isLiked ? '#ef4444' : '#64748b'}
          />
        </Pressable>
      </View>
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.productMetaRow}>
        <Ionicons name="storefront-outline" size={9} color="#64748b" />
        <Text style={styles.productStore} numberOfLines={1}>
          {storeName}
        </Text>
      </View>
      <View style={styles.productMetaRow}>
        <Ionicons name="star" size={9} color="#076F32" />
        <Text style={styles.productRating}>
          {Number(product.soldCount) > 0 ? `${Number(product.soldCount)}+ bán` : 'Mới'}
        </Text>
      </View>
      <View style={styles.productFooter}>
        <Text style={styles.productPrice} numberOfLines={1}>
          {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
          {product.donVi ? `/${product.donVi}` : ''}
        </Text>
        <View style={styles.productCartBtn}>
          <Ionicons name="cart" size={14} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}

function HomeShopCard({ shop, onPress }) {
  const distance = formatDistance(shop.distance_meters);
  const rating = Number(shop.rating_avg) || 0;
  const isOpen = shop.is_open !== false;
  const categoryLabel = shop.category_name || 'Gian hàng';
  const avatar = isRemoteAvatarUrl(shop.image_url || shop.cover_image_url)
    ? shop.image_url || shop.cover_image_url
    : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.shopCard, pressed && styles.pressed]}
      onPress={() => onPress?.(shop.id)}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.shopAvatar} />
      ) : (
        <View style={styles.shopAvatarFallback}>
          <AvatarBadge name={shop.shop_name || shop.name || 'S'} size={42} />
        </View>
      )}
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
        <Text style={styles.shopDistance}>{distance}</Text>
        <View style={styles.shopStatusRow}>
          <View style={[styles.shopStatusDot, !isOpen && styles.shopStatusDotClosed]} />
          <Text style={[styles.shopStatusText, !isOpen && styles.shopStatusTextClosed]}>
            {isOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
          </Text>
        </View>
        <Text style={styles.shopCategory} numberOfLines={1}>
          {categoryLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function CategoryChip({ category, onPress, isMore = false }) {
  const icon = String(category?.icon || '').trim();
  const isRemote = /^https?:\/\//i.test(icon);

  return (
    <Pressable style={styles.categoryChip} onPress={() => onPress?.(category)}>
      <View style={[styles.categoryIconBox, isMore && styles.categoryIconBoxMore]}>
        {isMore ? (
          <Ionicons name="grid-outline" size={18} color="#076F32" />
        ) : isRemote ? (
          <Image source={{ uri: icon }} style={styles.categoryImage} />
        ) : icon ? (
          <Text style={styles.categoryEmoji}>{icon}</Text>
        ) : (
          <Ionicons name="pricetag-outline" size={16} color="#076F32" />
        )}
      </View>
      <Text style={styles.categoryLabel} numberOfLines={1}>
        {isMore ? 'Xem thêm' : category?.categoryName || category?.name}
      </Text>
    </Pressable>
  );
}

function formatVoucherDiscount(voucher) {
  if (Number(voucher.discountType) === 2) {
    return `Giảm ${formatPrice(voucher.discountValue)}`;
  }
  return `Giảm ${voucher.discountValue}%`;
}

function HomeVoucherCard({ voucher, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.voucherCard, pressed && styles.pressed]}
      onPress={() => onPress?.(voucher)}
    >
      <Text style={styles.voucherCode}>{voucher.code}</Text>
      <Text style={styles.voucherDiscount}>{formatVoucherDiscount(voucher)}</Text>
      <Text style={styles.voucherShop} numberOfLines={1}>
        {voucher.shopName || 'Gian hàng'}
      </Text>
    </Pressable>
  );
}

function HomeBannerCarousel({ banners, onPressBanner }) {
  if (!banners?.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.bannerCarousel}
      contentContainerStyle={styles.bannerCarouselContent}
    >
      {banners.map((banner) => (
        <Pressable
          key={banner.id}
          style={({ pressed }) => [styles.bannerSlide, pressed && styles.pressed]}
          onPress={() => onPressBanner?.(banner)}
        >
          {banner.image ? (
            <Image source={{ uri: banner.image }} style={styles.bannerImage} />
          ) : (
            <View style={styles.bannerFallback}>
              <Ionicons name="megaphone-outline" size={28} color="#ffffff" />
            </View>
          )}
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {banner.title}
            </Text>
            {banner.description ? (
              <Text style={styles.bannerDesc} numberOfLines={1}>
                {banner.description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function HomeScreen({
  onOpenMap,
  onOpenProducts,
  onOpenNotifications,
  onOpenInbox,
  onOpenBuyerOrders,
  onEditAccount,
  onStartSellerRegister,
  onOpenShop,
  onNavigationStateChange,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
}) {
  const insets = useScreenInsets();
  const dispatch = useDispatch();
  const role = useSelector(selectUserRole);
  const sellerVerification = useSelector(selectSellerVerification);
  const sellerButtonLabel =
    getSellerRegisterButtonLabel({ role, verification: sellerVerification }) ||
    (Number(role) === 2 ? 'Gian hàng' : '');

  const [search, setSearch] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [nearbyVouchers, setNearbyVouchers] = useState([]);
  const [likedProducts, setLikedProducts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [showCategoriesScreen, setShowCategoriesScreen] = useState(false);

  useEffect(() => {
    onNavigationStateChange?.(
      Boolean(selectedProductId || selectedStoreId || showCategoriesScreen)
    );
  }, [onNavigationStateChange, selectedProductId, selectedStoreId, showCategoriesScreen]);

  const loadLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setCurrentLocation(null);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(normalizeExpoLocation(position));
    } catch {
      setCurrentLocation(null);
    }
  }, []);

  const loadHomeData = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [categoryRows, bannerRows] = await Promise.all([
          getProductCategoriesOnBackend().catch(() => []),
          listActiveBannersOnBackend({ limit: 8 }).catch(() => []),
        ]);

        // Favorites/voucher không được chặn load danh mục + sản phẩm (getIdToken có thể chậm).
        (async () => {
          try {
            const idToken = await getCurrentUserIdToken(false);
            if (!idToken) {
              return;
            }
            const [productIds, voucherRows] = await Promise.all([
              getFavoriteProductIdsOnBackend(idToken).catch(() => []),
              listNearbyVouchersOnBackend(idToken, { limit: 12 }).catch(() => []),
            ]);
            const likedMap = {};
            (productIds || []).forEach((productId) => {
              likedMap[String(productId)] = true;
            });
            setLikedProducts(likedMap);
            setNearbyVouchers(Array.isArray(voucherRows) ? voucherRows : []);
          } catch {
            // Ignore favorite/voucher preload errors.
          }
        })();

        setCategories(Array.isArray(categoryRows) ? categoryRows : []);
        setBanners(Array.isArray(bannerRows) ? bannerRows : []);

        if (!hasValidLocation(currentLocation)) {
          setProducts([]);
          setShops([]);
          return;
        }

        const [productRows, shopRows] = await Promise.all([
          discoverProductsOnBackend({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
            limit: 20,
          }).catch(() => []),
          loadNearbyRegisteredShops({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
          }).catch(() => []),
        ]);

        setProducts(
          Array.isArray(productRows)
            ? productRows.map((row) => normalizeProduct(row)).slice(0, 12)
            : []
        );
        setShops(Array.isArray(shopRows) ? shopRows.slice(0, 12) : []);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentLocation]
  );

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const toggleLikeProduct = useCallback(
    async (productId) => {
      const normalizedId = String(productId);
      const wasLiked = Boolean(likedProducts[normalizedId]);
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
    [likedProducts]
  );

  function handleSearchSubmit() {
    const keyword = search.trim();
    onOpenProducts?.({ search: keyword });
  }

  function handleBannerPress(banner) {
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
    if (targetType === 3 && targetId) {
      onOpenProducts?.({ categoryId: targetId });
      return;
    }
    onOpenProducts?.();
  }

  function handleVoucherPress(voucher) {
    if (voucher?.shopId) {
      setSelectedStoreId(String(voucher.shopId));
    }
  }

  if (selectedProductId) {
    return (
      <ProductDetailScreen
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
        onStorePress={(storeId) => {
          setSelectedProductId(null);
          setSelectedStoreId(storeId);
        }}
        onOrderSuccess={onOpenBuyerOrders}
      />
    );
  }

  if (selectedStoreId) {
    return (
      <StoreDetailScreen
        storeId={selectedStoreId}
        onBack={() => setSelectedStoreId(null)}
        onProductPress={(productId) => {
          setSelectedStoreId(null);
          setSelectedProductId(productId);
        }}
      />
    );
  }

  if (showCategoriesScreen) {
    return (
      <ProductCategoriesScreen
        categories={categories}
        onBack={() => setShowCategoriesScreen(false)}
        onSelectCategory={(categoryId) => {
          setShowCategoriesScreen(false);
          onOpenProducts?.({ categoryId });
        }}
      />
    );
  }

  const notificationBadgeCount = Math.max(0, Number(unreadNotificationsCount) || 0);
  const messageBadgeCount = Math.max(0, Number(unreadMessagesCount) || 0);
  const previewCategories = categories.slice(0, CATEGORY_PREVIEW_COUNT);

  return (
    <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottomSpacing, 24) + 88 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await loadLocation();
              await loadHomeData({ refresh: true });
            }}
            tintColor="#076F32"
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerRight}>
            <BuyerQuickMenu
              sellerButtonLabel={sellerButtonLabel}
              onEditAccount={onEditAccount}
              onSellerAction={() => {
                if (getSellerRegisterButtonLabel({ role, verification: sellerVerification })) {
                  onStartSellerRegister?.();
                  return;
                }
                onOpenShop?.();
              }}
              onLogout={() => dispatch(logoutUser())}
              buttonStyle={styles.utilityBtn}
              iconColor="#334155"
            />
            <Pressable
              style={styles.bellBtn}
              onPress={onOpenInbox}
              accessibilityRole="button"
              accessibilityLabel="Tin nhắn"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#334155" />
              {messageBadgeCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {messageBadgeCount > 9 ? '9+' : String(messageBadgeCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={styles.bellBtn}
              onPress={onOpenNotifications}
              accessibilityRole="button"
              accessibilityLabel="Thông báo"
            >
              <Ionicons name="notifications-outline" size={22} color="#334155" />
              {notificationBadgeCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {notificationBadgeCount > 9 ? '9+' : String(notificationBadgeCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <ClearableSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm sản phẩm, gian hàng..."
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          style={styles.searchField}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {previewCategories.map((item) => (
            <CategoryChip
              key={String(item.id)}
              category={item}
              onPress={(category) => onOpenProducts?.({ categoryId: category.id })}
            />
          ))}
          <CategoryChip isMore onPress={() => setShowCategoriesScreen(true)} />
        </ScrollView>

        <HomeBannerCarousel banners={banners} onPressBanner={handleBannerPress} />

        {nearbyVouchers.length > 0 ? (
          <>
            <SectionHeader title="Voucher gần bạn" />
            <FlatList
              horizontal
              data={nearbyVouchers}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <HomeVoucherCard voucher={item} onPress={handleVoucherPress} />
              )}
            />
          </>
        ) : null}

        <Pressable style={styles.mapBanner} onPress={onOpenMap}>
          <View style={styles.mapBannerCopy}>
            <Text style={styles.mapBannerTitle}>Sản phẩm gần bạn</Text>
            <Text style={styles.mapBannerSubtitle}>
              Xem các cửa hàng và sản phẩm xung quanh bạn
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

        <SectionHeader title="Sản phẩm gần bạn" onSeeAll={() => onOpenProducts?.()} />
        {isLoading ? (
          <ActivityIndicator color="#076F32" style={styles.sectionLoader} />
        ) : products.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có sản phẩm gần bạn.</Text>
        ) : (
          <FlatList
            horizontal
            data={products}
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
            renderItem={({ item }) => (
              <HomeProductCard
                product={item}
                isLiked={Boolean(likedProducts[String(item.id)])}
                onToggleLike={toggleLikeProduct}
                onPress={setSelectedProductId}
              />
            )}
          />
        )}

        <SectionHeader
          title="Cửa hàng gần bạn"
          onSeeAll={() => onOpenProducts?.({ focusShops: true })}
        />
        {isLoading ? (
          <ActivityIndicator color="#076F32" style={styles.sectionLoader} />
        ) : shops.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có cửa hàng gần bạn.</Text>
        ) : (
          <FlatList
            horizontal
            data={shops}
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
            renderItem={({ item }) => (
              <HomeShopCard shop={item} onPress={setSelectedStoreId} />
            )}
          />
        )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginBottom: 12,
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
  searchField: {
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 14,
    paddingRight: 4,
  },
  categoryChip: {
    width: 56,
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  categoryIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryIconBoxMore: {
    backgroundColor: '#E6F4EC',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 12,
    width: '100%',
  },
  bannerCarousel: {
    marginBottom: 16,
  },
  bannerCarouselContent: {
    gap: 0,
  },
  bannerSlide: {
    width: Dimensions.get('window').width - 32,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#055528',
    marginRight: 0,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  bannerDesc: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  voucherCard: {
    width: 148,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  voucherCode: {
    fontSize: 14,
    fontWeight: '800',
    color: '#055528',
    letterSpacing: 0.4,
  },
  voucherDiscount: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  voucherShop: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
  },
  mapBanner: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#076F32',
    minHeight: 118,
    marginBottom: 16,
  },
  mapBannerCopy: {
    flex: 1.15,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 6,
  },
  mapBannerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  mapBannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
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
  productCard: {
    width: 128,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    paddingBottom: 6,
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
  distanceTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#076F32',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  distanceTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  heartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    marginTop: 3,
    marginHorizontal: 5,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    color: '#0f172a',
    minHeight: 24,
  },
  productPrice: {
    flex: 1,
    marginHorizontal: 5,
    marginTop: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  productFooter: {
    marginTop: 4,
    marginHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productCartBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginHorizontal: 5,
    marginTop: 1,
  },
  productStore: {
    flex: 1,
    fontSize: 8,
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
  shopAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  shopAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
