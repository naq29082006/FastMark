import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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

import { discoverProductsOnBackend, getProductCategoriesOnBackend } from '../../api/productApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { formatDistance, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { searchRegisteredShops } from '../../repository/searchShopRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { normalizeProduct } from '../../model/productModel';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import ProductCategoriesScreen from './ProductCategoriesScreen';
import ProductCard from '../shared/components/ProductCard';
import AvatarBadge from '../shared/components/AvatarBadge';
import ClearableSearchField from '../shared/components/ClearableSearchField';

const SEARCH_DEBOUNCE_MS = 400;
const NEARBY_RADIUS_METERS = 5000;
const UNLIMITED_SEARCH_RADIUS = 0;
const SEARCH_TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'shops', label: 'Gian hàng' },
];

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function CategoryIconChip({ icon, label, active, onPress }) {
  const iconValue = String(icon || '').trim();
  const showRemoteImage = isRemoteIcon(iconValue);

  return (
    <Pressable
      style={[styles.categoryIconChip, active && styles.categoryIconChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {showRemoteImage ? (
        <Image source={{ uri: iconValue }} style={styles.categoryIconChipImage} />
      ) : iconValue ? (
        <Text style={styles.categoryIconChipEmoji}>{iconValue}</Text>
      ) : (
        <Ionicons name="pricetag-outline" size={20} color={active ? '#0d7377' : '#64748b'} />
      )}
    </Pressable>
  );
}

export default function ProductsScreen({ onNavigationStateChange, onOpenBuyerOrders }) {
  const insets = useScreenInsets();
  const scrollRef = useRef(null);
  const searchTimerRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [showCategoriesScreen, setShowCategoriesScreen] = useState(false);
  const [likedProducts, setLikedProducts] = useState({});
  const [searchTab, setSearchTab] = useState('products');
  const [shops, setShops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [shopsError, setShopsError] = useState('');

  const isSearching = Boolean(debouncedSearch);
  useEffect(() => {
    onNavigationStateChange?.(Boolean(selectedProductId || selectedStoreId || showCategoriesScreen));
  }, [onNavigationStateChange, selectedProductId, selectedStoreId, showCategoriesScreen]);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchTab('products');
      setShops([]);
      setShopsError('');
    }
  }, [debouncedSearch]);

  const loadLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Cần quyền vị trí để xem sản phẩm gần bạn.');
        setCurrentLocation(null);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(normalizeExpoLocation(position));
    } catch {
      setLocationError('Không lấy được vị trí hiện tại.');
      setCurrentLocation(null);
    } finally {
      setIsLocating(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const rows = await getProductCategoriesOnBackend();
      setCategories(Array.isArray(rows) ? rows : []);
    } catch {
      setCategories([]);
    }
  }, []);

  const loadFavoriteIds = useCallback(async () => {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }
      const productIds = await getFavoriteProductIdsOnBackend(idToken);
      const likedMap = {};
      (productIds || []).forEach((productId) => {
        likedMap[String(productId)] = true;
      });
      setLikedProducts(likedMap);
    } catch {
      // Ignore favorite preload errors.
    }
  }, []);

  const toggleLikeProduct = useCallback(async (productId) => {
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
  }, [likedProducts]);

  const loadProducts = useCallback(
    async ({ refresh = false } = {}) => {
      if (!hasValidLocation(currentLocation)) {
        setProducts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError('');

      try {
        const rows = await discoverProductsOnBackend({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters: debouncedSearch ? UNLIMITED_SEARCH_RADIUS : NEARBY_RADIUS_METERS,
          categoryId: selectedCategoryId,
          search: debouncedSearch,
          limit: 200,
        });
        setProducts(
          Array.isArray(rows)
            ? rows
                .map((row) => normalizeProduct(row))
                .filter((product) => !product.isOutOfStock && !product.isUnavailable)
            : []
        );
      } catch (error) {
        setProducts([]);
        setLoadError(error.message || 'Không tải được sản phẩm.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentLocation, debouncedSearch, selectedCategoryId]
  );

  const loadShops = useCallback(
    async ({ refresh = false } = {}) => {
      if (!debouncedSearch || !hasValidLocation(currentLocation)) {
        setShops([]);
        setIsLoadingShops(false);
        return;
      }

      if (!refresh) {
        setIsLoadingShops(true);
      }
      setShopsError('');

      try {
        const result = await searchRegisteredShops({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters: UNLIMITED_SEARCH_RADIUS,
          shopQuery: debouncedSearch,
          identityOnly: true,
          limit: 200,
        });
        setShops(Array.isArray(result?.shops) ? result.shops : []);
      } catch (error) {
        setShops([]);
        setShopsError(error.message || 'Không tìm được gian hàng.');
      } finally {
        setIsLoadingShops(false);
      }
    },
    [currentLocation, debouncedSearch]
  );

  useEffect(() => {
    loadLocation();
    loadCategories();
    loadFavoriteIds();
  }, [loadCategories, loadFavoriteIds, loadLocation]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  function handleSelectCategory(categoryId) {
    setSelectedCategoryId((current) => (current === categoryId ? '' : categoryId));
  }

  function handleSelectCategoryFromAll(categoryId) {
    setSelectedCategoryId(categoryId);
    setShowCategoriesScreen(false);
  }

  function handleOpenProduct(productId) {
    setSelectedStoreId(null);
    setSelectedProductId(productId);
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

  if (selectedProductId) {
    return (
      <ProductDetailScreen
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
        onStorePress={(storeId) => setSelectedStoreId(storeId)}
        onOrderSuccess={(tab) => {
          setSelectedProductId(null);
          onOpenBuyerOrders?.(tab);
        }}
      />
    );
  }

  if (showCategoriesScreen) {
    return (
      <ProductCategoriesScreen
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategoryFromAll}
        onBack={() => setShowCategoriesScreen(false)}
      />
    );
  }

  const showEmptyState = !isLoading && !isLocating && products.length === 0;
  const showShopsEmpty =
    isSearching && searchTab === 'shops' && !isLoadingShops && !isLocating && shops.length === 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.headerPaddingTop }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            loadLocation();
            loadFavoriteIds();
            loadProducts({ refresh: true });
            if (debouncedSearch) {
              loadShops({ refresh: true });
            }
          }}
          tintColor="#0d7377"
        />
      }
    >
      <Text style={styles.pageTitle}>Sản phẩm</Text>

      <ClearableSearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm kiếm sản phẩm, gian hàng...."
        style={styles.searchField}
      />

      {isSearching ? (
        <>
          <View style={styles.searchTabRow}>
            {SEARCH_TABS.map((tab) => {
              const isActive = searchTab === tab.key;
              const count = tab.key === 'products' ? products.length : shops.length;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setSearchTab(tab.key)}
                  style={[styles.searchTabItem, isActive && styles.searchTabItemActive]}
                >
                  <Text style={[styles.searchTabText, isActive && styles.searchTabTextActive]}>
                    {tab.label}
                    {isActive || count > 0 ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          {searchTab === 'products' && loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : null}
          {searchTab === 'shops' && shopsError ? (
            <Text style={styles.errorText}>{shopsError}</Text>
          ) : null}

          {searchTab === 'products' ? (
            isLoading || isLocating ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator color="#0d7377" />
                <Text style={styles.loaderText}>Đang tìm sản phẩm...</Text>
              </View>
            ) : products.length > 0 ? (
              <View style={[styles.gridSection, styles.searchResultsSection]}>
                <View style={styles.productGrid}>
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isLiked={Boolean(likedProducts[product.id])}
                      onToggleLike={toggleLikeProduct}
                      onPress={handleOpenProduct}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={[styles.emptyInline, styles.emptyInlineInset]}>
                <Text style={styles.emptyText}>Không tìm thấy sản phẩm phù hợp.</Text>
              </View>
            )
          ) : isLoadingShops || isLocating ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color="#0d7377" />
              <Text style={styles.loaderText}>Đang tìm gian hàng...</Text>
            </View>
          ) : shops.length > 0 ? (
            <View style={styles.shopList}>
              {shops.map((shop) => {
                const username = String(shop.shop_username || '').trim();
                const category = String(shop.category_name || '').trim();
                const address =
                  String(shop.system_address || shop.address || '').trim();
                const productCount = Number(shop.product_count) || 0;
                const reviewCount = Number(shop.review_count) || 0;
                const identityLine = [username ? `@${username}` : '', category]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <Pressable
                    key={shop.id}
                    style={({ pressed }) => [styles.shopCard, pressed && styles.shopCardPressed]}
                    onPress={() => setSelectedStoreId(String(shop.id))}
                  >
                    <AvatarBadge
                      name={shop.shop_name || shop.name || 'Gian hàng'}
                      uri={isRemoteAvatarUrl(shop.image_url) ? shop.image_url : ''}
                      size={56}
                    />
                    <View style={styles.shopCardBody}>
                      <View style={styles.shopCardTopRow}>
                        <Text style={styles.shopCardName} numberOfLines={1}>
                          {shop.shop_name || shop.name}
                        </Text>
                        {Number.isFinite(Number(shop.distance_meters)) ? (
                          <Text style={styles.shopCardDistance}>
                            {formatDistance(shop.distance_meters)}
                          </Text>
                        ) : null}
                      </View>
                      {identityLine ? (
                        <Text style={styles.shopCardIdentity} numberOfLines={1}>
                          {identityLine}
                        </Text>
                      ) : null}
                      {address ? (
                        <Text style={styles.shopCardAddress} numberOfLines={1}>
                          {address}
                        </Text>
                      ) : null}
                      <Text style={styles.shopCardStats} numberOfLines={1}>
                        {productCount} sản phẩm · {reviewCount} đánh giá
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : showShopsEmpty ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>Không tìm thấy gian hàng phù hợp.</Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            <Pressable
              style={styles.allCategoriesChip}
              onPress={() => setShowCategoriesScreen(true)}
              accessibilityRole="button"
              accessibilityLabel="Tất cả danh mục"
            >
              <Ionicons name="grid-outline" size={20} color="#0d7377" />
            </Pressable>
            {categories.map((category) => (
              <CategoryIconChip
                key={category.id}
                label={category.categoryName}
                icon={category.icon || ''}
                active={selectedCategoryId === category.id}
                onPress={() => handleSelectCategory(category.id)}
              />
            ))}
          </ScrollView>

          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm gần bạn</Text>
          </View>

          {isLoading || isLocating ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color="#0d7377" />
              <Text style={styles.loaderText}>Đang tải sản phẩm gần bạn...</Text>
            </View>
          ) : products.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyRow}
            >
              {products.map((product) => (
                <ProductCard
                  key={`nearby-${product.id}`}
                  product={product}
                  isLiked={Boolean(likedProducts[product.id])}
                  onToggleLike={toggleLikeProduct}
                  compact
                  onPress={handleOpenProduct}
                />
              ))}
            </ScrollView>
          ) : showEmptyState ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>Chưa có sản phẩm phù hợp trong khu vực.</Text>
            </View>
          ) : null}

          <View style={styles.gridSection}>
            <Text style={styles.sectionTitle}>Tất cả sản phẩm</Text>

            {isLoading || isLocating ? null : products.length > 0 ? (
              <View style={styles.productGrid}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isLiked={Boolean(likedProducts[product.id])}
                    onToggleLike={toggleLikeProduct}
                    onPress={handleOpenProduct}
                  />
                ))}
              </View>
            ) : showEmptyState ? (
              <View style={[styles.emptyInline, styles.emptyInlineInset]}>
                <Text style={styles.emptyText}>Chưa có sản phẩm phù hợp.</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  content: {
    paddingBottom: 28,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  searchField: {
    marginHorizontal: 20,
    marginBottom: 14,
  },
  searchTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchTabItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  searchTabItemActive: {
    backgroundColor: '#e8f3f1',
  },
  searchTabText: {
    fontWeight: '700',
    color: '#64748b',
    fontSize: 14,
  },
  searchTabTextActive: {
    color: '#0d7377',
  },
  searchResultsSection: {
    paddingTop: 4,
  },
  shopList: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 8,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 0,
    padding: 14,
  },
  shopCardPressed: {
    opacity: 0.88,
  },
  shopCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  shopCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopCardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopCardDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d7377',
  },
  shopCardIdentity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d7377',
  },
  shopCardAddress: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  shopCardStats: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    alignItems: 'center',
  },
  categoryIconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconChipActive: {
    borderColor: '#0d7377',
    backgroundColor: '#ecfdf5',
  },
  categoryIconChipImage: {
    width: 24,
    height: 24,
    borderRadius: 6,
    resizeMode: 'cover',
  },
  categoryIconChipEmoji: {
    fontSize: 20,
  },
  allCategoriesChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e8f3f1',
    borderWidth: 1,
    borderColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  nearbyRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 8,
  },
  nearbyCard: {
    width: 148,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gridSection: {
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: -6,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productCardPressed: {
    opacity: 0.92,
  },
  productImageWrap: {
    position: 'relative',
    width: '100%',
  },
  productImage: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  productImageCompact: {
    aspectRatio: 1,
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
  productEmoji: {
    fontSize: 40,
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
  soldOutTextCompact: {
    fontSize: 12,
  },
  likeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 6,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 2,
  },
  likeBadgeCompact: {
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  likeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  likeCountTextCompact: {
    fontSize: 11,
  },
  productInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  productInfoCompact: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 3,
  },
  productNameCompact: {
    fontSize: 12,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d7377',
    marginBottom: 4,
  },
  productPriceCompact: {
    fontSize: 11,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  productSold: {
    flexShrink: 1,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  productSoldCompact: {
    fontSize: 10,
  },
  productMeta: {
    flexShrink: 0,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'right',
  },
  productMetaCompact: {
    fontSize: 10,
  },
  emptyInline: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyInlineInset: {
    paddingHorizontal: 0,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
});
