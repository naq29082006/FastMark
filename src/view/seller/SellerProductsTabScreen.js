import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getMyProductsOnBackend } from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatPriceRange } from '../../core/utils/productFormat';

function mapApiProductToManageCard(product) {
  const variants = product.variants || [];

  return {
    id: String(product.id),
    name: product.productName || product.name || 'Sản phẩm',
    thumbnail: product.thumbnail || '',
    minPrice: Number(product.minPrice ?? product.price ?? 0),
    maxPrice: Number(product.maxPrice ?? product.minPrice ?? product.price ?? 0),
    variantCount: variants.length,
    viewCount: Number(product.viewCount ?? 0),
    soldCount: Number(product.soldCount ?? 0),
    likeCount: Number(product.likeCount ?? 0),
    donVi: product.donVi || '',
    isOutOfStock: Boolean(product.isOutOfStock),
  };
}

function ProductManageCard({ product, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.productCard, pressed && styles.productCardPressed]}
      onPress={onPress}
    >
      {product.thumbnail ? (
        <Image source={{ uri: product.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Text style={styles.thumbnailPlaceholderText}>🛒</Text>
        </View>
      )}

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.priceRange}>
          {formatPriceRange(product.minPrice, product.maxPrice)}
        </Text>

        <View style={styles.metaGrid}>
          <Text style={styles.metaItem}>{product.variantCount} thẻ</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaItem}>{product.viewCount} view</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaItem}>{product.soldCount} đã bán</Text>
        </View>

        <View style={styles.footerRow}>
          {product.donVi ? <Text style={styles.unitText}>ĐVT: {product.donVi}</Text> : null}
          {product.isOutOfStock ? (
            <Text style={styles.stockBadge}>Hết hàng</Text>
          ) : (
            <Text style={styles.likeText}>{product.likeCount} lượt thích</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function SellerProductsTabScreen({
  productRefreshKey = 0,
  onOpenProductDetail,
}) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <Text style={styles.title}>Quản lý sản phẩm</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" size="large" />
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
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Chưa có sản phẩm</Text>
              <Text style={styles.emptyText}>
                Vào tab Đăng tin để tạo sản phẩm đầu tiên cho gian hàng.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductManageCard
              product={item}
              onPress={() => onOpenProductDetail?.(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarSpacer: { width: 36 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { padding: 16, paddingBottom: 24 },
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
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  thumbnailPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  thumbnailPlaceholderText: { fontSize: 32 },
  productInfo: { flex: 1, minWidth: 0 },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 20,
  },
  priceRange: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d7377',
    marginBottom: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  metaItem: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  metaDot: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  unitText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  likeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  stockBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
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
    backgroundColor: '#0d7377',
  },
  retryButtonText: { color: '#ffffff', fontWeight: '800' },
});
