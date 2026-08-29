import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { discoverProductsOnBackend, listPromotionProductsOnBackend } from '../../api/productApi';
import { fetchSearchShopsFromNode } from '../../api/storeNodeApi';
import { searchUsersOnBackend } from '../../api/userDiscoveryApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { normalizeProduct } from '../../model/productModel';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { formatDistance, hasValidLocation } from '../../core/utils/geo';
import { showErrorAlert } from '../../core/utils/appAlert';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from '../../core/storage/searchHistoryStorage';
import { selectAuthProfile, selectAuthUser } from '../../viewmodel/auth/authSelectors';
import AvatarBadge from '../shared/components/AvatarBadge';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useSearchSuggestions } from '../../hooks/useSearchSuggestions';
import SearchSuggestionsDropdown from '../shared/components/SearchSuggestionsDropdown';
import { SEARCH_SUGGEST_MIN_LENGTH } from '../../core/utils/searchSuggestions';

const SEARCH_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'users', label: 'Người dùng' },
];

const RESULT_LIMIT = DEFAULT_PAGE_SIZE;

function appendUniqueByKey(existing, incoming, getKey) {
  const merged = new Map();
  [...(existing || []), ...(incoming || [])].forEach((item) => {
    const key = String(getKey(item) || '');
    if (!key || merged.has(key)) {
      return;
    }
    merged.set(key, item);
  });
  return Array.from(merged.values());
}

function resolveUserItemKey(user) {
  return user?.userId || user?.id || user?._id || '';
}

function resolveUsersHasMore(result, page, limit) {
  const meta = result?.pagination || {};
  const total = Number(meta.total);
  if (Number.isFinite(total)) {
    return page * limit < total;
  }
  return (Array.isArray(result?.items) ? result.items.length : 0) >= limit;
}

function productDistance(product) {
  const value = Number(product?.distanceMeters);
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function shopDistance(shop) {
  const value = Number(shop?.distance_meters ?? shop?.distanceMeters);
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function sortByDistanceAsc(items, getDistance) {
  return [...items].sort((left, right) => {
    const delta = getDistance(left) - getDistance(right);
    if (delta !== 0) {
      return delta;
    }
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

function mergePromoIntoProducts(rows, promoRows) {
  const promoById = new Map();
  (Array.isArray(promoRows) ? promoRows : []).forEach((row) => {
    const promo = normalizeProduct(row);
    if (promo.id && promo.isPromotion && Number(promo.discountPercent) > 0) {
      promoById.set(promo.id, promo);
    }
  });

  return sortByDistanceAsc(
    (Array.isArray(rows) ? rows : []).map((row) => {
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
    }),
    productDistance
  );
}

function ProductResultRow({ product, onPress }) {
  const distance = formatDistance(product.distanceMeters);
  const isPromotion = Boolean(product.isPromotion) && Number(product.discountPercent) > 0;
  const promoLabels = isPromotion ? getProductPromoPriceLabels(product) : null;
  const unit = product.donVi ? `/${product.donVi}` : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      onPress={() => onPress?.(product.id)}
    >
      {product.thumbnail ? (
        <Image source={{ uri: product.thumbnail }} style={styles.resultThumb} />
      ) : (
        <View style={[styles.resultThumb, styles.resultThumbFallback]}>
          <Text style={styles.resultEmoji}>{product.image_emoji || '📦'}</Text>
        </View>
      )}
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {product.name}
        </Text>
        {isPromotion && promoLabels ? (
          <View>
            <Text style={styles.resultOriginalPrice} numberOfLines={1}>
              {promoLabels.originalLabel}
              {unit}
            </Text>
            <Text style={styles.resultPrice} numberOfLines={1}>
              {promoLabels.saleLabel}
              {unit}
              {Number(product.discountPercent) > 0 ? ` · -${product.discountPercent}%` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.resultPrice} numberOfLines={1}>
            {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
            {unit}
          </Text>
        )}
        <View style={styles.resultMetaRow}>
          <Ionicons name="storefront-outline" size={11} color="#64748b" />
          <Text style={styles.resultMetaText} numberOfLines={1}>
            {product.storeName || 'Gian hàng'}
          </Text>
          {distance && distance !== '--' ? (
            <Text style={styles.resultDistance}>{distance}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

function ShopResultRow({ shop, onPress }) {
  const name = shop.shop_name || shop.name || 'Gian hàng';
  const username = shop.shop_username || shop.shopUsername || '';
  const distance = formatDistance(shop.distance_meters ?? shop.distanceMeters);
  const isOpen = shop.is_open !== false;
  const avatar = isRemoteAvatarUrl(shop.image_url || shop.cover_image_url)
    ? shop.image_url || shop.cover_image_url
    : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      onPress={() => onPress?.(shop.id)}
    >
      <AvatarBadge name={name} uri={avatar} size={48} />
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {name}
        </Text>
        {username ? (
          <Text style={styles.resultMetaText} numberOfLines={1}>
            @{username}
          </Text>
        ) : null}
        <View style={styles.resultMetaRow}>
          <View style={[styles.openDot, !isOpen && styles.openDotClosed]} />
          <Text style={[styles.openText, !isOpen && styles.openTextClosed]}>
            {isOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
          </Text>
          {distance && distance !== '--' ? (
            <Text style={styles.resultDistance}>{distance}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

function UserResultRow({ user, onPress }) {
  const displayName = user.fullName || user.userName || 'Người dùng';
  const username = user.userName ? `@${String(user.userName).replace(/^@+/, '')}` : '';
  const avatar = isRemoteAvatarUrl(user.avatar) ? user.avatar : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      onPress={() => onPress?.(user.userId || user.id)}
    >
      <AvatarBadge name={displayName} uri={avatar} size={48} />
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {displayName}
        </Text>
        {username ? (
          <Text style={styles.resultMetaText} numberOfLines={1}>
            {username}
          </Text>
        ) : null}
        <Text style={styles.resultMetaText} numberOfLines={1}>
          {Number(user.soNguoiTheo) || 0} người theo dõi
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

function HistoryRow({ keyword, onPress, onRemove }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.suggestRow, pressed && styles.pressed]}
      onPress={() => onPress?.(keyword)}
    >
      <Ionicons name="time-outline" size={18} color="#94a3b8" />
      <Text style={styles.suggestText} numberOfLines={1}>
        {keyword}
      </Text>
      <Pressable
        onPress={() => onRemove?.(keyword)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Xóa lịch sử"
      >
        <Ionicons name="close" size={16} color="#94a3b8" />
      </Pressable>
    </Pressable>
  );
}

export default function SearchScreen({ currentLocation, onBack, onOpenProduct, onOpenShop, onOpenBuyer }) {
  const insets = useScreenInsets();
  const authUser = useSelector(selectAuthUser);
  const profile = useSelector(selectAuthProfile);
  const historyUserId = String(profile?.id || authUser?.uid || '').trim();
  const searchRequestIdRef = useRef(0);
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [shopsHasMore, setShopsHasMore] = useState(false);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [shopsTotal, setShopsTotal] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const productsPageRef = useRef(1);
  const shopsPageRef = useRef(1);
  const usersPageRef = useRef(1);
  const promoRowsRef = useRef([]);
  const loadingMoreRef = useRef(false);

  const locationReady = hasValidLocation(currentLocation);
  const trimmedQuery = query.trim();
  const showResults = Boolean(committedQuery) && trimmedQuery === committedQuery;

  const { items: suggestions, isLoading: isSuggesting } = useSearchSuggestions({
    query: trimmedQuery,
    location: currentLocation,
    enabled: !showResults && locationReady && trimmedQuery.length >= SEARCH_SUGGEST_MIN_LENGTH,
  });

  useEffect(() => {
    let alive = true;
    if (!historyUserId) {
      setHistory([]);
      return undefined;
    }
    getSearchHistory(historyUserId).then((items) => {
      if (alive) {
        setHistory(items);
      }
    });
    return () => {
      alive = false;
    };
  }, [historyUserId]);

  const runSearch = useCallback(
    async (keywordInput) => {
      const keyword = String(keywordInput || '').trim();
      if (!keyword) {
        return;
      }

      if (!locationReady) {
        setErrorText('Bật vị trí để tìm kiếm quanh bạn.');
        return;
      }

      setQuery(keyword);
      setCommittedQuery(keyword);
      setActiveTab('all');
      setErrorText('');
      setIsSearching(true);
      productsPageRef.current = 1;
      shopsPageRef.current = 1;
      usersPageRef.current = 1;
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
      setProductsHasMore(false);
      setShopsHasMore(false);
      setUsersHasMore(false);
      setProductsTotal(0);
      setShopsTotal(0);
      setUsersTotal(0);

      if (historyUserId) {
        const nextHistory = await addSearchHistory(historyUserId, keyword);
        setHistory(nextHistory);
      }

      const requestId = ++searchRequestIdRef.current;
      try {
        const idToken = await getCurrentUserIdToken();
        const [productPage, promoPage, shopResult, userResult] = await Promise.all([
          discoverProductsOnBackend({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            search: keyword,
            page: 1,
            limit: RESULT_LIMIT,
          }),
          listPromotionProductsOnBackend({
            page: 1,
            limit: RESULT_LIMIT,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }).catch(() => ({ items: [] })),
          fetchSearchShopsFromNode({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            shopQuery: keyword,
            identityOnly: true,
            page: 1,
            limit: RESULT_LIMIT,
          }),
          searchUsersOnBackend(idToken, {
            search: keyword,
            page: 1,
            limit: RESULT_LIMIT,
          }).catch(() => ({ items: [] })),
        ]);

        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        promoRowsRef.current = Array.isArray(promoPage?.items) ? promoPage.items : [];
        setProducts(mergePromoIntoProducts(productPage.items || [], promoRowsRef.current));
        setShops(
          sortByDistanceAsc(
            Array.isArray(shopResult?.items)
              ? shopResult.items
              : Array.isArray(shopResult?.shops)
                ? shopResult.shops
                : [],
            shopDistance
          )
        );
        setUsers(Array.isArray(userResult?.items) ? userResult.items : []);
        setProductsHasMore(Boolean(productPage?.hasMore));
        setShopsHasMore(Boolean(shopResult?.hasMore));
        setUsersHasMore(resolveUsersHasMore(userResult, 1, RESULT_LIMIT));
        setProductsTotal(Math.max(0, Number(productPage?.total) || 0));
        setShopsTotal(Math.max(0, Number(shopResult?.total) || 0));
        setUsersTotal(Math.max(0, Number(userResult?.pagination?.total) || 0));
      } catch (error) {
        if (searchRequestIdRef.current === requestId) {
          setProducts([]);
          setShops([]);
          setUsers([]);
          setProductsHasMore(false);
          setShopsHasMore(false);
          setUsersHasMore(false);
          setProductsTotal(0);
          setShopsTotal(0);
          setUsersTotal(0);
          showErrorAlert(error.message || 'Không tìm kiếm được. Vui lòng thử lại.');
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    },
    [currentLocation?.latitude, currentLocation?.longitude, historyUserId, locationReady]
  );

  const loadMoreResults = useCallback(async () => {
    if (!committedQuery || !locationReady || isSearching || loadingMoreRef.current) {
      return;
    }

    const wantProducts = activeTab !== 'users' && productsHasMore;
    const wantShops = activeTab === 'all' && shopsHasMore;
    const wantUsers = activeTab !== 'products' && usersHasMore;
    if (!wantProducts && !wantShops && !wantUsers) {
      return;
    }

    const requestId = searchRequestIdRef.current;
    const nextProductPage = productsPageRef.current + 1;
    const nextShopPage = shopsPageRef.current + 1;
    const nextUserPage = usersPageRef.current + 1;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const [productPage, shopResult, userResult] = await Promise.all([
        wantProducts
          ? discoverProductsOnBackend({
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              radiusMeters: 0,
              search: committedQuery,
              page: nextProductPage,
              limit: RESULT_LIMIT,
            }).catch(() => null)
          : Promise.resolve(null),
        wantShops
          ? fetchSearchShopsFromNode({
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              radiusMeters: 0,
              shopQuery: committedQuery,
              identityOnly: true,
              page: nextShopPage,
              limit: RESULT_LIMIT,
            }).catch(() => null)
          : Promise.resolve(null),
        wantUsers
          ? getCurrentUserIdToken()
              .then((idToken) =>
                searchUsersOnBackend(idToken, {
                  search: committedQuery,
                  page: nextUserPage,
                  limit: RESULT_LIMIT,
                })
              )
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      if (searchRequestIdRef.current !== requestId) {
        return;
      }

      if (productPage) {
        const rows = mergePromoIntoProducts(productPage.items || [], promoRowsRef.current);
        if (rows.length > 0) {
          productsPageRef.current = nextProductPage;
          setProducts((prev) => appendUniqueByKey(prev, rows, (item) => item?.id));
        }
        setProductsHasMore(Boolean(productPage.hasMore) && rows.length > 0);
      }

      if (shopResult) {
        const rows = sortByDistanceAsc(
          Array.isArray(shopResult.items)
            ? shopResult.items
            : Array.isArray(shopResult.shops)
              ? shopResult.shops
              : [],
          shopDistance
        );
        if (rows.length > 0) {
          shopsPageRef.current = nextShopPage;
          setShops((prev) => appendUniqueByKey(prev, rows, (item) => item?.id));
        }
        setShopsHasMore(Boolean(shopResult.hasMore) && rows.length > 0);
      }

      if (userResult) {
        const rows = Array.isArray(userResult.items) ? userResult.items : [];
        if (rows.length > 0) {
          usersPageRef.current = nextUserPage;
          setUsers((prev) => appendUniqueByKey(prev, rows, resolveUserItemKey));
        }
        setUsersHasMore(
          rows.length > 0 && resolveUsersHasMore(userResult, nextUserPage, RESULT_LIMIT)
        );
      }
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    activeTab,
    committedQuery,
    currentLocation?.latitude,
    currentLocation?.longitude,
    isSearching,
    locationReady,
    productsHasMore,
    shopsHasMore,
    usersHasMore,
  ]);

  function handleChangeQuery(nextValue) {
    setQuery(nextValue);
    if (String(nextValue || '').trim() !== committedQuery) {
      setCommittedQuery('');
      setProducts([]);
      setShops([]);
      setUsers([]);
      setProductsHasMore(false);
      setShopsHasMore(false);
      setUsersHasMore(false);
      setProductsTotal(0);
      setShopsTotal(0);
      setUsersTotal(0);
      setErrorText('');
    }
  }

  async function handleRemoveHistory(keyword) {
    if (!historyUserId) {
      return;
    }
    const next = await removeSearchHistory(historyUserId, keyword);
    setHistory(next);
  }

  async function handleClearHistory() {
    if (!historyUserId) {
      return;
    }
    const next = await clearSearchHistory(historyUserId);
    setHistory(next);
  }

  function handleSuggestionPress(item) {
    if (item.type === 'product') {
      const name = String(item.data?.name || '').trim();
      if (name && historyUserId) {
        addSearchHistory(historyUserId, name).then(setHistory);
      }
      onOpenProduct?.(item.data.id);
      return;
    }
    if (item.type === 'user') {
      const name = String(item.data?.fullName || item.data?.userName || '').trim();
      if (name && historyUserId) {
        addSearchHistory(historyUserId, name).then(setHistory);
      }
      onOpenBuyer?.(item.data?.id || item.data?.userId || item.data?._id);
      return;
    }
    const name = String(item.data?.shop_name || item.data?.name || '').trim();
    if (name && historyUserId) {
      addSearchHistory(historyUserId, name).then(setHistory);
    }
    onOpenShop?.(item.data.id);
  }

  const allItems = useMemo(() => {
    const productItems = products.map((product) => ({
      key: `product-${product.id}`,
      type: 'product',
      data: product,
      distance: productDistance(product),
    }));
    const shopItems = shops.map((shop) => ({
      key: `shop-${shop.id}`,
      type: 'shop',
      data: shop,
      distance: shopDistance(shop),
    }));
    const userItems = users.map((user) => ({
      key: `user-${user.userId || user.id}`,
      type: 'user',
      data: user,
      distance: Number.POSITIVE_INFINITY,
    }));
    return [...productItems, ...shopItems, ...userItems].sort(
      (left, right) => left.distance - right.distance
    );
  }, [products, shops, users]);

  const listData = useMemo(() => {
    if (activeTab === 'products') {
      return products.map((product) => ({
        key: `product-${product.id}`,
        type: 'product',
        data: product,
      }));
    }
    if (activeTab === 'users') {
      return users.map((user) => ({
        key: `user-${user.userId || user.id}`,
        type: 'user',
        data: user,
      }));
    }
    return allItems;
  }, [activeTab, allItems, products, users]);

  const hasMoreForTab = useMemo(() => {
    if (activeTab === 'products') {
      return productsHasMore;
    }
    if (activeTab === 'users') {
      return usersHasMore;
    }
    return productsHasMore || shopsHasMore || usersHasMore;
  }, [activeTab, productsHasMore, shopsHasMore, usersHasMore]);

  const totalForTab = useMemo(() => {
    if (activeTab === 'products') {
      return productsTotal;
    }
    if (activeTab === 'users') {
      return usersTotal;
    }
    return productsTotal + shopsTotal + usersTotal;
  }, [activeTab, productsTotal, shopsTotal, usersTotal]);

  const emptyText = useMemo(() => {
    if (!showResults || isSearching) {
      return '';
    }
    if (activeTab === 'products') {
      return `Không tìm thấy sản phẩm cho "${committedQuery}".`;
    }
    if (activeTab === 'users') {
      return `Không tìm thấy người dùng cho "${committedQuery}".`;
    }
    return `Không tìm thấy kết quả cho "${committedQuery}".`;
  }, [showResults, isSearching, activeTab, committedQuery]);

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Tìm kiếm" onBack={onBack} />

      <View style={styles.searchBarWrap}>
        <ClearableSearchField
          value={query}
          onChangeText={handleChangeQuery}
          placeholder="Tìm sản phẩm, người dùng..."
          autoFocus
          onSubmitEditing={() => runSearch(query)}
        />
      </View>

      {showResults ? (
        <View style={styles.tabRow}>
          {SEARCH_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {showResults ? (
        isSearching ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#076F32" />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.nestedScrollPaddingBottom },
            ]}
            ListEmptyComponent={
              emptyText ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>{emptyText}</Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              listData.length > 0 ? (
                <LoadMoreButton
                  currentCount={listData.length}
                  totalCount={
                    hasMoreForTab
                      ? Math.max(totalForTab, listData.length + RESULT_LIMIT)
                      : listData.length
                  }
                  loading={isLoadingMore}
                  onPress={loadMoreResults}
                />
              ) : null
            }
            renderItem={({ item }) =>
              item.type === 'product' ? (
                <ProductResultRow product={item.data} onPress={onOpenProduct} />
              ) : item.type === 'user' ? (
                <UserResultRow user={item.data} onPress={onOpenBuyer} />
              ) : (
                <ShopResultRow shop={item.data} onPress={onOpenShop} />
              )
            }
          />
        )
      ) : !trimmedQuery ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Tìm kiếm gần đây</Text>
            {history.length > 0 ? (
              <Pressable onPress={handleClearHistory} hitSlop={8}>
                <Text style={styles.panelAction}>Xóa tất cả</Text>
              </Pressable>
            ) : null}
          </View>
          {history.length === 0 ? (
            <Text style={styles.panelEmpty}>Chưa có lịch sử tìm kiếm.</Text>
          ) : (
            history.map((keyword) => (
              <HistoryRow
                key={keyword}
                keyword={keyword}
                onPress={runSearch}
                onRemove={handleRemoveHistory}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Gợi ý</Text>
            {isSuggesting ? <ActivityIndicator size="small" color="#076F32" /> : null}
          </View>
          {!locationReady ? (
            <Text style={styles.panelEmpty}>Bật vị trí để xem gợi ý quanh bạn.</Text>
          ) : trimmedQuery.length < SEARCH_SUGGEST_MIN_LENGTH ? (
            <Text style={styles.panelEmpty}>Nhập ít nhất {SEARCH_SUGGEST_MIN_LENGTH} ký tự.</Text>
          ) : (
            <SearchSuggestionsDropdown
              items={suggestions}
              loading={isSuggesting}
              visible
              embedded
              onPressItem={handleSuggestionPress}
              emptyHint="Không có gợi ý phù hợp."
            />
          )}
          {trimmedQuery ? (
            <Pressable
              style={({ pressed }) => [styles.searchAllBtn, pressed && styles.pressed]}
              onPress={() => runSearch(trimmedQuery)}
            >
              <Ionicons name="search" size={16} color="#076F32" />
              <Text style={styles.searchAllText} numberOfLines={1}>
                Tìm “{trimmedQuery}”
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  tabItemActive: {
    backgroundColor: '#E6F4EC',
  },
  tabText: {
    fontWeight: '700',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#076F32',
  },
  errorText: {
    marginHorizontal: 16,
    marginTop: 10,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 24,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  panelAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
  },
  panelEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    paddingVertical: 16,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  suggestText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  suggestSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  suggestDistance: {
    fontSize: 11,
    fontWeight: '700',
    color: '#076F32',
  },
  searchAllBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  searchAllText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#076F32',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
  },
  resultThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  resultThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultEmoji: {
    fontSize: 22,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  resultPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  resultOriginalPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultMetaText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  resultDistance: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
    color: '#076F32',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  openDotClosed: {
    backgroundColor: '#94a3b8',
  },
  openText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#076F32',
  },
  openTextClosed: {
    color: '#64748b',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
