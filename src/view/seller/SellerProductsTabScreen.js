import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getMyProductsOnBackend, setProductPinOnBackend } from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { showErrorAlert } from '../../core/utils/appAlert';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { mergeListById } from '../../core/utils/realtimeList';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import {
  resolveIsOutOfStock,
} from '../../core/utils/productAvailability';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import { matchesSearchAny, normalizeSearchText } from '../../core/utils/searchText';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import SellerProductDetailScreen from './SellerProductDetailScreen';
import SellerBulkPromotionScreen from './SellerBulkPromotionScreen';

function mapApiProductToManageCard(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const remainingQuantity =
    product.remainingQuantity != null
      ? Number(product.remainingQuantity)
      : variants.reduce(
          (sum, variant) =>
            sum + Math.max(0, Number(variant.quantity ?? variant.Quantity) || 0),
          0
        );

  const mapped = {
    id: String(product.id),
    name: product.productName || product.name || 'Sản phẩm',
    thumbnail: product.thumbnail || '',
    minPrice: Number(product.minPrice ?? product.price ?? 0),
    maxPrice: Number(product.maxPrice ?? product.minPrice ?? product.price ?? 0),
    variantCount: Number(product.variantCount) || variants.length || 0,
    viewCount: Number(product.viewCount ?? 0),
    soldCount: Number(product.soldCount ?? 0),
    likeCount: Number(product.likeCount ?? 0),
    donVi: product.donVi || '',
    remainingQuantity,
    variants,
    isOutOfStock: Boolean(product.isOutOfStock),
    pinProduct: Math.max(0, Math.min(2, Number(product.pinProduct) || 0)),
    isPromotion: Boolean(product.isPromotion) && Number(product.discountPercent) > 0,
    discountPercent: Number(product.discountPercent) || 0,
    promotionMinPrice: product.promotionMinPrice ?? product.promotionPrice ?? null,
    promotionMaxPrice: product.promotionMaxPrice ?? null,
    originalPrice: Number(product.originalPrice ?? product.minPrice ?? 0),
    originalMaxPrice: Number(product.originalMaxPrice ?? product.maxPrice ?? product.minPrice ?? 0),
  };

  // Chỉ hết hàng khi tổng tồn tất cả biến thể = 0 (giống người mua xem shop).
  mapped.isOutOfStock = resolveIsOutOfStock(mapped);
  return mapped;
}

const ProductManageCard = memo(function ProductManageCard({
  product,
  onPress,
  onPinPress,
  pinningId,
}) {
  const overlayLabel = resolveIsOutOfStock(product) ? 'Hết hàng' : null;
  const pin = Number(product.pinProduct) || 0;
  const isPromotion = Boolean(product.isPromotion) && Number(product.discountPercent) > 0;
  const promoLabels = isPromotion ? getProductPromoPriceLabels(product) : null;
  const metaLine = [
    `${product.variantCount} thẻ`,
    `${product.viewCount} view`,
    `${product.likeCount} lượt thích`,
    `${product.soldCount} đã bán`,
  ].join('  |  ');
  const isPinning = pinningId === product.id;

  return (
    <Pressable
      style={({ pressed }) => [styles.productCard, pressed && styles.productCardPressed]}
      onPress={onPress}
    >
      <View style={styles.thumbnailWrap} collapsable={false}>
        {product.thumbnail ? (
          <Image source={{ uri: product.thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailPlaceholderText}>🛒</Text>
          </View>
        )}
        {overlayLabel ? (
          <View style={styles.soldOutMask} pointerEvents="none">
            <Text style={styles.soldOutText}>{overlayLabel}</Text>
          </View>
        ) : null}
        {pin > 0 ? (
          <View style={styles.pinBadge} pointerEvents="none">
            <Ionicons name="pin" size={10} color="#ffffff" />
            <Text style={styles.pinBadgeText}>{pin}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        {isPromotion && promoLabels ? (
          <View style={styles.priceBlock}>
            <View style={styles.promoPriceRow}>
              <Text style={styles.originalPrice}>{promoLabels.originalLabel}</Text>
              <Text style={styles.discountBadge}>−{product.discountPercent}%</Text>
            </View>
            <Text style={styles.salePrice}>{promoLabels.saleLabel}</Text>
          </View>
        ) : (
          <Text style={styles.priceRange}>
            {formatPriceRange(product.minPrice, product.maxPrice)}
          </Text>
        )}
        <Text style={styles.metaLine} numberOfLines={2}>
          {metaLine}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.pinButton, pressed && styles.actionChipPressed]}
        onPress={(event) => {
          event?.stopPropagation?.();
          onPinPress?.(product);
        }}
        disabled={isPinning}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={pin > 0 ? `Ghim vị trí ${pin}` : 'Ghim sản phẩm'}
      >
        {isPinning ? (
          <ActivityIndicator size="small" color="#076F32" />
        ) : (
          <>
            <Ionicons
              name={pin > 0 ? 'pin' : 'pin-outline'}
              size={12}
              color="#076F32"
            />
            {pin > 0 ? <Text style={styles.pinButtonText}>{pin}</Text> : null}
          </>
        )}
      </Pressable>
    </Pressable>
  );
});

export default function SellerProductsTabScreen({
  productRefreshKey = 0,
  onProductChanged,
  onNavigationStateChange,
  onBack,
}) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const loadingGuardRef = useRef(false);
  const [productDetailId, setProductDetailId] = useState(null);
  const [showBulkPromo, setShowBulkPromo] = useState(false);
  const [bulkPromoTab, setBulkPromoTab] = useState('bulk');
  const [pinningId, setPinningId] = useState('');

  const loadProducts = useCallback(async ({ nextPage = 1 } = {}) => {
    if (loadingGuardRef.current) {
      return;
    }
    loadingGuardRef.current = true;
    if (nextPage === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      const result = await getMyProductsOnBackend(idToken, {
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const rows = (result.items || []).map(mapApiProductToManageCard);
      setProducts((current) =>
        nextPage === 1 ? mergeListById(current, rows) : appendUniqueById(current, rows)
      );
      setPage(Number(result.page) || nextPage);
      setHasMore(Boolean(result.hasMore));
      setTotalCount(Math.max(0, Number(result.total) || 0));
    } catch (loadError) {
      showErrorAlert(loadError.message || 'Không tải được sản phẩm.');
      if (nextPage === 1) {
        setProducts([]);
        setHasMore(false);
        setTotalCount(0);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      loadingGuardRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadProducts({ nextPage: 1 });
  }, [loadProducts, productRefreshKey]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || loadingGuardRef.current) {
      return;
    }
    loadProducts({ nextPage: page + 1 });
  }, [hasMore, isLoading, isLoadingMore, loadProducts, page]);

  useEffect(() => {
    // Khi mở từ shop/profile đã ẩn tab ở panel cha — chỉ báo nested nếu vẫn được truyền callback.
    if (!onNavigationStateChange) {
      return undefined;
    }
    onNavigationStateChange?.(Boolean(productDetailId || showBulkPromo));
    return () => {
      onNavigationStateChange?.(false);
    };
  }, [onNavigationStateChange, productDetailId, showBulkPromo]);

  const filteredProducts = useMemo(() => {
    if (!normalizeSearchText(search)) {
      return products;
    }
    return products.filter((product) =>
      matchesSearchAny(
        [
          product.name,
          product.productName,
          product.donVi,
          product.id,
          product._id,
          product.productCode,
          product.code,
        ],
        search
      )
    );
  }, [products, search]);

  async function applyPin(productId, pinProduct) {
    setPinningId(productId);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      await setProductPinOnBackend({ idToken, productId, pinProduct });
      await loadProducts({ nextPage: 1 });
      onProductChanged?.();
    } catch (pinError) {
      Alert.alert('Lỗi', pinError.message || 'Không ghim được sản phẩm.');
    } finally {
      setPinningId('');
    }
  }

  function handlePinPress(product) {
    const current = Number(product.pinProduct) || 0;
    const hasPin1 = products.some(
      (item) => item.id !== product.id && Number(item.pinProduct) === 1
    );
    const hasPin2 = products.some(
      (item) => item.id !== product.id && Number(item.pinProduct) === 2
    );

    if (current > 0) {
      Alert.alert('Ghim sản phẩm', `Đang ghim ở vị trí ${current}.`, [
        {
          text: 'Bỏ ghim',
          style: 'destructive',
          onPress: () => applyPin(product.id, 0),
        },
        ...(current !== 1
          ? [
              {
                text: 'Chuyển vị trí 1',
                onPress: () => applyPin(product.id, 1),
              },
            ]
          : []),
        ...(current !== 2 && hasPin1
          ? [
              {
                text: 'Chuyển vị trí 2',
                onPress: () => applyPin(product.id, 2),
              },
            ]
          : []),
        { text: 'Hủy', style: 'cancel' },
      ]);
      return;
    }

    // Chưa có ghim vị trí 1 → ghim mặc định vị trí 1.
    if (!hasPin1) {
      applyPin(product.id, 1);
      return;
    }

    Alert.alert(
      'Ghim sản phẩm',
      hasPin2
        ? 'Đã ghim đủ 2 sản phẩm. Chọn vị trí để chèn — sản phẩm đang ở vị trí đó sẽ bị bỏ ghim.'
        : 'Chọn vị trí. Ghim vị trí 1 sẽ đẩy sản phẩm đang ở 1 xuống vị trí 2.',
      [
        {
          text: 'Vị trí 1',
          onPress: () => applyPin(product.id, 1),
        },
        {
          text: 'Vị trí 2',
          onPress: () => applyPin(product.id, 2),
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  }

  if (showBulkPromo) {
    return (
      <SellerBulkPromotionScreen
        initialTab={bulkPromoTab}
        onBack={() => setShowBulkPromo(false)}
        onChanged={() => {
          onProductChanged?.();
          loadProducts({ nextPage: 1 });
        }}
      />
    );
  }

  if (productDetailId) {
    return (
      <SellerProductDetailScreen
        productId={productDetailId}
        onBack={() => {
          setProductDetailId(null);
          loadProducts({ nextPage: 1 });
        }}
        onChanged={() => {
          onProductChanged?.();
          loadProducts({ nextPage: 1 });
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Quản lý sản phẩm" onBack={onBack} />

      <View style={styles.promoActionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionChip, pressed && styles.actionChipPressed]}
          onPress={() => {
            setBulkPromoTab('bulk');
            setShowBulkPromo(true);
          }}
        >
          <Ionicons name="pricetags-outline" size={16} color="#076F32" />
          <Text style={styles.actionChipText}>Giảm giá hàng loạt</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionChip, pressed && styles.actionChipPressed]}
          onPress={() => {
            setBulkPromoTab('active');
            setShowBulkPromo(true);
          }}
        >
          <Ionicons name="flame-outline" size={16} color="#b45309" />
          <Text style={[styles.actionChipText, { color: '#b45309' }]}>Đang giảm giá</Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <ClearableSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm sản phẩm theo tên..."
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            filteredProducts.length > 0 ? (
              <LoadMoreButton
                currentCount={filteredProducts.length}
                totalCount={
                  search.trim()
                    ? filteredProducts.length
                    : hasMore
                      ? Math.max(totalCount, products.length + DEFAULT_PAGE_SIZE)
                      : products.length
                }
                loading={isLoadingMore}
                onPress={handleLoadMore}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {search.trim() ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
              </Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? 'Thử từ khóa khác hoặc xóa ô tìm kiếm.'
                  : 'Chưa có sản phẩm nào. Hãy đăng bài từ mục Đăng bài sản phẩm.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductManageCard
              product={item}
              pinningId={pinningId}
              onPress={() => setProductDetailId(item.id)}
              onPinPress={handlePinPress}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  promoActionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#f1f5f9',
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionChipPressed: { opacity: 0.85 },
  actionChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#076F32',
  },
  listContent: { padding: 16, paddingBottom: 32 },
  productCard: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    paddingBottom: 28,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  productCardPressed: { opacity: 0.85 },
  thumbnailWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#f8fafc',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
  },
  thumbnailPlaceholderText: { fontSize: 32 },
  soldOutMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  pinBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#076F32',
  },
  pinBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  productInfo: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 4 },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 20,
  },
  priceRange: {
    fontSize: 15,
    fontWeight: '800',
    color: '#076F32',
    marginBottom: 6,
  },
  priceBlock: {
    marginBottom: 6,
  },
  promoPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  salePrice: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '800',
    color: '#076F32',
  },
  metaLine: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  pinButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pinButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#076F32',
  },
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
});
