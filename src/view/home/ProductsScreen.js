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

import { discoverProductsOnBackend, getProductCategoriesOnBackend, listPromotionProductsOnBackend } from '../../api/productApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { formatDistance, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { resolveShopAvatarUri } from '../../core/utils/avatarInitial';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { showErrorAlert } from '../../core/utils/appAlert';
import { searchRegisteredShops } from '../../repository/searchShopRepository';
import { loadNearbyRegisteredShops } from '../../viewmodel/map/mapViewModel';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { normalizeProduct } from '../../model/productModel';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import BuyerProfileScreen from '../profile/BuyerProfileScreen';
import ProductCard from '../shared/components/ProductCard';
import AvatarBadge from '../shared/components/AvatarBadge';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import SearchSuggestionsDropdown from '../shared/components/SearchSuggestionsDropdown';
import { useSearchSuggestions } from '../../hooks/useSearchSuggestions';
import { SEARCH_SUGGEST_MIN_LENGTH } from '../../core/utils/searchSuggestions';

const SEARCH_DEBOUNCE_MS = 300;
const NEARBY_RADIUS_METERS = 5000;
const ALL_PRODUCTS_RADIUS_METERS = 20000;
const UNLIMITED_SEARCH_RADIUS = 0;
const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const SEARCH_TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'shops', label: 'Gian hàng' },
];

function CategoryChip({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.categoryChip, active && styles.categoryChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProductsScreen({
  onNavigationStateChange,
  onOpenBuyerOrders,
  onOpenWalletTopUp,
  onNavigateDirections,
  focusRequest = null,
  onBack = null,
  resumeReserveRequest = null,
  onResumeReserveHandled,
}) {
  const insets = useScreenInsets();
  const scrollRef = useRef(null);
  const searchTimerRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [likedProducts, setLikedProducts] = useState({});
  const [searchTab, setSearchTab] = useState('products');
  const [shops, setShops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [browseNearbyShops, setBrowseNearbyShops] = useState(false);
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState(null);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [shopsHasMore, setShopsHasMore] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [shopsTotal, setShopsTotal] = useState(0);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [loadingMoreShops, setLoadingMoreShops] = useState(false);
  const searchInputRef = useRef(null);
  const productsPageRef = useRef(1);
  const shopsPageRef = useRef(1);
  /** Quay lại từ chi tiết → giữ màn tìm kiếm (ô query + kết quả). */
  const searchReturnRef = useRef({ active: false, productId: null, storeId: null });

  const isSearching = Boolean(debouncedSearch) || browseNearbyShops;

  const {
    items: suggestionItems,
    isLoading: isSuggesting,
    canSuggest,
  } = useSearchSuggestions({
    query: search,
    location: currentLocation,
    enabled: searchFocused && !selectedBuyerUserId,
  });

  const showSuggestionDropdown =
    searchFocused && canSuggest && String(search || '').trim().length >= SEARCH_SUGGEST_MIN_LENGTH;

  useEffect(() => {
    onNavigationStateChange?.(Boolean(selectedProductId || selectedStoreId));
  }, [onNavigationStateChange, selectedProductId, selectedStoreId]);

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
      if (!browseNearbyShops) {
        setSearchTab('products');
        setShops([]);
      }
    } else {
      setBrowseNearbyShops(false);
    }
  }, [browseNearbyShops, debouncedSearch]);

  const loadLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        showErrorAlert('Cần quyền vị trí để xem sản phẩm gần bạn.');
        setCurrentLocation(null);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(normalizeExpoLocation(position));
    } catch {
      showErrorAlert('Không lấy được vị trí hiện tại.');
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
        setProductsHasMore(false);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      try {
        productsPageRef.current = 1;
        const [pageResult, promoPage] = await Promise.all([
          discoverProductsOnBackend({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: debouncedSearch ? UNLIMITED_SEARCH_RADIUS : ALL_PRODUCTS_RADIUS_METERS,
            categoryId: selectedCategoryId,
            search: debouncedSearch,
            page: 1,
            limit: PAGE_SIZE,
          }),
          listPromotionProductsOnBackend({
            page: 1,
            limit: PAGE_SIZE,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }).catch(() => ({ items: [] })),
        ]);

        const promoById = new Map();
        (promoPage.items || []).forEach((row) => {
          const promo = normalizeProduct(row);
          if (promo.id && promo.isPromotion && Number(promo.discountPercent) > 0) {
            promoById.set(promo.id, promo);
          }
        });

        setProducts(
          (pageResult.items || [])
            .map((row) => {
              const product = normalizeProduct(row);
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
            })
            .filter((product) => !product.isOutOfStock && !product.isUnavailable)
        );
        setProductsHasMore(Boolean(pageResult.hasMore));
        setProductsTotal(Math.max(0, Number(pageResult.total) || 0));
      } catch (error) {
        setProducts([]);
        setProductsHasMore(false);
        setProductsTotal(0);
        showErrorAlert(error.message || 'Không tải được sản phẩm.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentLocation, debouncedSearch, selectedCategoryId]
  );

  const loadMoreProducts = useCallback(async () => {
    if (loadingMoreProducts || !productsHasMore || !hasValidLocation(currentLocation)) {
      return;
    }
    setLoadingMoreProducts(true);
    try {
      const nextPage = productsPageRef.current + 1;
      const pageResult = await discoverProductsOnBackend({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters: debouncedSearch ? UNLIMITED_SEARCH_RADIUS : ALL_PRODUCTS_RADIUS_METERS,
        categoryId: selectedCategoryId,
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      productsPageRef.current = nextPage;
      const nextItems = (pageResult.items || [])
        .map((row) => normalizeProduct(row))
        .filter((product) => !product.isOutOfStock && !product.isUnavailable);
      setProducts((prev) => appendUniqueById(prev, nextItems));
      setProductsHasMore(Boolean(pageResult.hasMore));
    } catch {
      // giữ danh sách hiện tại
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [
    currentLocation,
    debouncedSearch,
    loadingMoreProducts,
    productsHasMore,
    selectedCategoryId,
  ]);

  const loadShops = useCallback(
    async ({ refresh = false } = {}) => {
      if ((!debouncedSearch && !browseNearbyShops) || !hasValidLocation(currentLocation)) {
        setShops([]);
        setShopsHasMore(false);
        setShopsTotal(0);
        setIsLoadingShops(false);
        return;
      }

      if (!refresh) {
        setIsLoadingShops(true);
      }
      try {
        shopsPageRef.current = 1;
        if (browseNearbyShops && !debouncedSearch) {
          const nearby = await loadNearbyRegisteredShops({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
            page: 1,
            limit: PAGE_SIZE,
          });
          setShops(nearby.items || nearby.shops || []);
          setShopsHasMore(Boolean(nearby.hasMore));
          setShopsTotal(Math.max(0, Number(nearby.total) || 0));
        } else {
          const result = await searchRegisteredShops({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: UNLIMITED_SEARCH_RADIUS,
            shopQuery: debouncedSearch,
            identityOnly: true,
            page: 1,
            limit: PAGE_SIZE,
          });
          setShops(result.shops || result.items || []);
          setShopsHasMore(Boolean(result.hasMore));
          setShopsTotal(Math.max(0, Number(result.total) || 0));
        }
      } catch (error) {
        setShops([]);
        setShopsHasMore(false);
        setShopsTotal(0);
        showErrorAlert(error.message || 'Không tìm được gian hàng.');
      } finally {
        setIsLoadingShops(false);
      }
    },
    [browseNearbyShops, currentLocation, debouncedSearch]
  );

  const loadMoreShops = useCallback(async () => {
    if (loadingMoreShops || !shopsHasMore || !hasValidLocation(currentLocation)) {
      return;
    }
    setLoadingMoreShops(true);
    try {
      const nextPage = shopsPageRef.current + 1;
      let pageResult;
      if (browseNearbyShops && !debouncedSearch) {
        pageResult = await loadNearbyRegisteredShops({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters: NEARBY_RADIUS_METERS,
          page: nextPage,
          limit: PAGE_SIZE,
        });
      } else {
        pageResult = await searchRegisteredShops({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters: UNLIMITED_SEARCH_RADIUS,
          shopQuery: debouncedSearch,
          identityOnly: true,
          page: nextPage,
          limit: PAGE_SIZE,
        });
      }
      shopsPageRef.current = nextPage;
      setShops((prev) => appendUniqueById(prev, pageResult.items || pageResult.shops || []));
      setShopsHasMore(Boolean(pageResult.hasMore));
    } catch {
      // ignore
    } finally {
      setLoadingMoreShops(false);
    }
  }, [
    browseNearbyShops,
    currentLocation,
    debouncedSearch,
    loadingMoreShops,
    shopsHasMore,
  ]);

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

  useEffect(() => {
    if (!focusRequest?.at) {
      return;
    }

    if (focusRequest.focusSearch) {
      setBrowseNearbyShops(false);
      setSearch(String(focusRequest.search || ''));
      setDebouncedSearch(String(focusRequest.search || '').trim());
      setSearchTab('products');
      setAutoFocusSearch(true);
      setTimeout(() => {
        searchInputRef.current?.focus?.();
      }, 250);
    } else if (focusRequest.search != null) {
      setBrowseNearbyShops(false);
      setSearch(String(focusRequest.search || ''));
      setDebouncedSearch(String(focusRequest.search || '').trim());
      setAutoFocusSearch(false);
    }

    if (focusRequest.categoryId != null) {
      setBrowseNearbyShops(false);
      setSelectedCategoryId(String(focusRequest.categoryId || ''));
      setAutoFocusSearch(false);
    }

    if (focusRequest.focusShops) {
      setSearchTab('shops');
      setBrowseNearbyShops(true);
      setSearch('');
      setDebouncedSearch('');
      setAutoFocusSearch(false);
    } else if (focusRequest.focusHot || focusRequest.categoryId || focusRequest.search) {
      setSearchTab('products');
      setBrowseNearbyShops(false);
    }

    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }, [focusRequest]);

  useEffect(() => {
    if (!resumeReserveRequest?.productId || !resumeReserveRequest?.at) {
      return;
    }
    setSelectedStoreId(null);
    setSelectedProductId(String(resumeReserveRequest.productId));
  }, [resumeReserveRequest?.at, resumeReserveRequest?.productId]);

  function handleSelectCategory(categoryId) {
    setSelectedCategoryId((current) => (current === categoryId ? '' : categoryId));
  }

  function markSearchReturnContext() {
    if (isSearching || String(search || '').trim() || String(debouncedSearch || '').trim()) {
      searchReturnRef.current = {
        active: true,
        productId: searchReturnRef.current.productId,
        storeId: searchReturnRef.current.storeId,
      };
    }
  }

  function handleOpenProduct(productId) {
    markSearchReturnContext();
    setSelectedStoreId(null);
    setSelectedProductId(productId);
  }

  function handleBackFromProductDetail() {
    setSelectedProductId(null);
    onResumeReserveHandled?.();
    const returnStoreId = searchReturnRef.current.storeId;
    if (returnStoreId) {
      searchReturnRef.current.storeId = null;
      setSelectedStoreId(String(returnStoreId));
      return;
    }
    if (searchReturnRef.current.active) {
      searchReturnRef.current.productId = null;
      setSearchFocused(true);
      setTimeout(() => searchInputRef.current?.focus?.(), 0);
    }
  }

  function handleBackFromStoreDetail() {
    setSelectedStoreId(null);
    const returnProductId = searchReturnRef.current.productId;
    if (returnProductId) {
      searchReturnRef.current.productId = null;
      setSelectedProductId(String(returnProductId));
      return;
    }
    if (searchReturnRef.current.active) {
      searchReturnRef.current.storeId = null;
      setSearchFocused(true);
      setTimeout(() => searchInputRef.current?.focus?.(), 0);
    }
  }

  function handleSuggestionPress(item) {
    setSearchFocused(false);
    if (item.type === 'product') {
      handleOpenProduct(item.data.id);
      return;
    }
    if (item.type === 'user') {
      const userId = String(item.data?.id || item.data?.userId || item.data?._id || '').trim();
      if (userId) {
        markSearchReturnContext();
        setSelectedBuyerUserId(userId);
      }
      return;
    }
    const shopId = String(item.data?.id || '').trim();
    if (shopId) {
      markSearchReturnContext();
      setSelectedStoreId(shopId);
    }
  }

  if (selectedBuyerUserId) {
    return (
      <BuyerProfileScreen
        userId={selectedBuyerUserId}
        onBack={() => {
          setSelectedBuyerUserId(null);
          if (searchReturnRef.current.active) {
            setSearchFocused(true);
            setTimeout(() => searchInputRef.current?.focus?.(), 0);
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

  if (selectedStoreId) {
    return (
      <StoreDetailScreen
        storeId={selectedStoreId}
        originLocation={currentLocation}
        onBack={handleBackFromStoreDetail}
        onProductPress={(productId) => {
          if (searchReturnRef.current.active) {
            searchReturnRef.current.productId = null;
            searchReturnRef.current.storeId = String(selectedStoreId || '');
          }
          setSelectedStoreId(null);
          setSelectedProductId(productId);
        }}
        onNavigateDirections={onNavigateDirections}
      />
    );
  }

  if (selectedProductId) {
    return (
      <ProductDetailScreen
        productId={selectedProductId}
        onBack={handleBackFromProductDetail}
        onStorePress={(storeId) => {
          if (searchReturnRef.current.active) {
            searchReturnRef.current.productId = String(selectedProductId || '');
            searchReturnRef.current.storeId = null;
          }
          setSelectedProductId(null);
          setSelectedStoreId(storeId);
        }}
        onOrderSuccess={(tab) => {
          setSelectedProductId(null);
          onOpenBuyerOrders?.(tab);
        }}
        onOpenTopUp={onOpenWalletTopUp}
        reservationSource="products"
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

  const showEmptyState = !isLoading && !isLocating && products.length === 0;
  const showShopsEmpty =
    isSearching && searchTab === 'shops' && !isLoadingShops && !isLocating && shops.length === 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.headerPaddingTop, paddingBottom: insets.nestedScrollPaddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            loadLocation();
            loadFavoriteIds();
            loadProducts({ refresh: true });
            if (debouncedSearch || browseNearbyShops) {
              loadShops({ refresh: true });
            }
          }}
          tintColor="#076F32"
        />
      }
    >
      <View style={styles.pageTitleRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.pageBackBtn}>
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </Pressable>
        ) : null}
        <Text style={styles.pageTitle}>{autoFocusSearch || Boolean(search) ? 'Tìm kiếm' : 'Sản phẩm'}</Text>
      </View>

      <ClearableSearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm kiếm sản phẩm, gian hàng...."
        style={styles.searchField}
        autoFocus={autoFocusSearch}
        inputRef={searchInputRef}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
      />

      <SearchSuggestionsDropdown
        items={suggestionItems}
        loading={isSuggesting}
        visible={showSuggestionDropdown}
        onPressItem={handleSuggestionPress}
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

          {searchTab === 'products' ? (
            isLoading || isLocating ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator color="#076F32" />
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
                <LoadMoreButton
                  currentCount={products.length}
                  totalCount={
                    productsHasMore
                      ? Math.max(productsTotal, products.length + PAGE_SIZE)
                      : products.length
                  }
                  loading={loadingMoreProducts}
                  onPress={loadMoreProducts}
                />
              </View>
            ) : (
              <View style={[styles.emptyInline, styles.emptyInlineInset]}>
                <Text style={styles.emptyText}>Không tìm thấy sản phẩm phù hợp.</Text>
              </View>
            )
          ) : isLoadingShops || isLocating ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color="#076F32" />
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
                      uri={resolveShopAvatarUri(shop)}
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
              <LoadMoreButton
                currentCount={shops.length}
                totalCount={
                  shopsHasMore ? Math.max(shopsTotal, shops.length + PAGE_SIZE) : shops.length
                }
                loading={loadingMoreShops}
                onPress={loadMoreShops}
              />
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
            <CategoryChip
              label="Tất cả"
              active={!selectedCategoryId}
              onPress={() => setSelectedCategoryId('')}
            />
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.categoryName}
                active={selectedCategoryId === category.id}
                onPress={() => handleSelectCategory(category.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm gần bạn</Text>
          </View>

          {isLoading || isLocating ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color="#076F32" />
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
              <LoadMoreButton
                currentCount={products.length}
                totalCount={
                  productsHasMore
                    ? Math.max(productsTotal, products.length + PAGE_SIZE)
                    : products.length
                }
                loading={loadingMoreProducts}
                onPress={loadMoreProducts}
              />
            </ScrollView>
          ) : showEmptyState ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>Chưa có sản phẩm phù hợp trong khu vực.</Text>
            </View>
          ) : null}

          <View style={styles.gridSection}>
            <Text style={styles.sectionTitle}>Tất cả sản phẩm</Text>

            {isLoading || isLocating ? null : products.length > 0 ? (
              <>
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
                <LoadMoreButton
                  currentCount={products.length}
                  totalCount={
                    productsHasMore
                      ? Math.max(productsTotal, products.length + PAGE_SIZE)
                      : products.length
                  }
                  loading={loadingMoreProducts}
                  onPress={loadMoreProducts}
                />
              </>
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
  content: {},
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  pageBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
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
    backgroundColor: '#E6F4EC',
  },
  searchTabText: {
    fontWeight: '700',
    color: '#64748b',
    fontSize: 14,
  },
  searchTabTextActive: {
    color: '#076F32',
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
    color: '#076F32',
  },
  shopCardIdentity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingRight: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryChipActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#076F32',
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
    color: '#076F32',
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
