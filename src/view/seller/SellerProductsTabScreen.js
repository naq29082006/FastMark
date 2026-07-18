import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { getMyProductsOnBackend } from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatPriceRange } from '../../core/utils/productFormat';
import {
  getProductImageOverlayLabel,
  resolveIsOutOfStock,
} from '../../core/utils/productAvailability';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import SellerPostTabScreen from './SellerPostTabScreen';
import SellerProductDetailScreen from './SellerProductDetailScreen';

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
    status: product.status,
    isUnavailable: Boolean(product.isUnavailable),
  };

  // Chỉ hết hàng khi tổng tồn tất cả biến thể = 0 (giống người mua xem shop).
  mapped.isOutOfStock = resolveIsOutOfStock(mapped);
  return mapped;
}

function ProductManageCard({ product, onPress }) {
  const overlayLabel = getProductImageOverlayLabel(product);
  const metaLine = [
    `${product.variantCount} thẻ`,
    `${product.viewCount} view`,
    `${product.likeCount} lượt thích`,
    `${product.soldCount} đã bán`,
  ].join('  |  ');

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
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.priceRange}>
          {formatPriceRange(product.minPrice, product.maxPrice)}
        </Text>
        <Text style={styles.metaLine} numberOfLines={2}>
          {metaLine}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SellerProductsTabScreen({
  productRefreshKey = 0,
  onProductChanged,
  onNavigationStateChange,
  onBack,
}) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPost, setShowPost] = useState(false);
  const [productDetailId, setProductDetailId] = useState(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      const data = await getMyProductsOnBackend(idToken);
      setProducts(data.map(mapApiProductToManageCard));
    } catch (loadError) {
      setError(loadError.message || 'Không tải được sản phẩm.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, productRefreshKey]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(showPost || productDetailId));
  }, [onNavigationStateChange, productDetailId, showPost]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return products;
    }
    return products.filter((product) => {
      const name = String(product.name || product.productName || '').toLowerCase();
      const unit = String(product.donVi || '').toLowerCase();
      return name.includes(keyword) || unit.includes(keyword);
    });
  }, [products, search]);

  if (showPost) {
    return (
      <SellerPostTabScreen
        onBack={() => setShowPost(false)}
        onProductCreated={(productId) => {
          onProductChanged?.();
          setShowPost(false);
          if (productId) {
            setProductDetailId(String(productId));
          } else {
            loadProducts();
          }
        }}
        onProductChanged={onProductChanged}
      />
    );
  }

  if (productDetailId) {
    return (
      <SellerProductDetailScreen
        productId={productDetailId}
        onBack={() => {
          setProductDetailId(null);
          loadProducts();
        }}
        onChanged={() => {
          onProductChanged?.();
          loadProducts();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#0f172a" />
          </Pressable>
        ) : null}
        <Text style={styles.title}>Quản lý sản phẩm</Text>
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
      ) : error && products.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadProducts} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {search.trim() ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
              </Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? 'Thử từ khóa khác hoặc xóa ô tìm kiếm.'
                  : 'Nhấn nút Đăng tin ở góc dưới bên phải để tạo sản phẩm đầu tiên.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductManageCard
              product={item}
              onPress={() => setProductDetailId(item.id)}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => setShowPost(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Đăng tin"
      >
        <Ionicons name="add" size={22} color="#ffffff" />
        <Text style={styles.fabLabel}>Đăng tin</Text>
      </Pressable>
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
  listContent: { padding: 16, paddingBottom: 100 },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
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
  productInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
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
  metaLine: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    lineHeight: 17,
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
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: '#076F32',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabPressed: { opacity: 0.9 },
  fabLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
