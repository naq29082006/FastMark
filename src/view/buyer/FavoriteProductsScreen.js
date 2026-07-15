import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getFavoriteProductsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { formatPriceRange } from '../../core/utils/productFormat';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getProductImageOverlayLabel } from '../../core/utils/productAvailability';

function formatLocation(location) {
  const value = String(location || '').trim();
  return value || 'Chưa có địa chỉ';
}

const SORT_OPTIONS = [
  { key: 'newest', label: 'Mới lưu' },
  { key: 'price_asc', label: 'Giá ↑' },
  { key: 'price_desc', label: 'Giá ↓' },
  { key: 'likes', label: 'Lượt thích' },
  { key: 'rating', label: 'Đánh giá' },
];

export default function FavoriteProductsScreen({ onOpenProduct }) {
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const loadFavorites = useCallback(
    async ({ refresh = false, nextPage = 1 } = {}) => {
      if (refresh) {
        setIsRefreshing(true);
      } else if (nextPage > 1) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError('');

      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          setFavorites([]);
          setError('Đăng nhập để xem sản phẩm yêu thích.');
          return;
        }

        const result = await getFavoriteProductsOnBackend(idToken, {
          page: nextPage,
          limit: 20,
          search: appliedSearch,
          sort,
        });
        const rows = Array.isArray(result?.favorites) ? result.favorites : [];
        setPagination(
          result?.pagination || { page: nextPage, limit: 20, total: rows.length, totalPages: 1 }
        );
        setPage(nextPage);
        setFavorites((current) => (nextPage > 1 ? [...current, ...rows] : rows));
      } catch (loadError) {
        if (nextPage === 1) {
          setFavorites([]);
        }
        setError(loadError.message || 'Không tải được danh sách yêu thích.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [appliedSearch, sort]
  );

  useEffect(() => {
    loadFavorites({ nextPage: 1 });
  }, [loadFavorites]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }
    const timer = setTimeout(() => setSnackbar(''), 2200);
    return () => clearTimeout(timer);
  }, [snackbar]);

  function confirmRemove(productId, name) {
    Alert.alert('Bỏ yêu thích', `Bỏ thích sản phẩm "${name || 'này'}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ thích',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            if (!idToken) {
              return;
            }
            await removeFavoriteProductOnBackend(idToken, productId);
            setFavorites((current) =>
              current.filter((item) => String(item.productId) !== String(productId))
            );
            setSnackbar('Đã bỏ yêu thích sản phẩm.');
          } catch {
            setSnackbar('Không thể bỏ yêu thích sản phẩm.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BỘ SƯU TẬP CỦA BẠN</Text>
          <Text style={styles.title}>Sản phẩm yêu thích</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pagination.total || favorites.length}</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>Lưu lại những sản phẩm bạn muốn xem và mua sau.</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm sản phẩm, cửa hàng, danh mục..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => setAppliedSearch(search.trim())}
        />
        <Pressable
          onPress={() => setAppliedSearch(search.trim())}
          style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
        >
          <Text style={styles.searchBtnText}>Tìm</Text>
        </Pressable>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setSort(option.key)}
            style={[styles.chip, sort === option.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, sort === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#277068" />
          <View style={styles.skeletonGrid}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.skeletonCard} />
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => String(item.id || item.productId)}
          numColumns={2}
          columnWrapperStyle={styles.productGrid}
          contentContainerStyle={favorites.length === 0 ? styles.emptyList : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFavorites({ refresh: true })}
            />
          }
          onEndReached={() => {
            if (!isLoadingMore && page < (pagination.totalPages || 1)) {
              loadFavorites({ nextPage: page + 1 });
            }
          }}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyEmoji}>🤍</Text>
              <Text style={styles.emptyTitle}>Chưa có sản phẩm yêu thích</Text>
              <Text style={styles.emptySubtitle}>
                Nhấn trái tim ở gian hàng để lưu sản phẩm vào đây.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#277068" />
            ) : null
          }
          renderItem={({ item: product }) => {
            const overlayLabel = getProductImageOverlayLabel(product);
            return (
              <Pressable
                style={({ pressed }) => [styles.productCard, pressed && styles.productCardPressed]}
                onPress={() => onOpenProduct?.(product.productId)}
              >
                <View style={styles.productImage}>
                  {product.thumbnail ? (
                    <Image source={{ uri: product.thumbnail }} style={styles.productThumb} />
                  ) : (
                    <View style={styles.productEmojiWrap}>
                      <Text style={styles.productEmoji}>📦</Text>
                    </View>
                  )}
                  {overlayLabel ? (
                    <View style={styles.soldOutMask} pointerEvents="none">
                      <Text style={styles.soldOutText}>{overlayLabel}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => confirmRemove(product.productId, product.name)}
                    hitSlop={8}
                    style={styles.heartBadge}
                  >
                    <Text style={styles.heartText}>♥</Text>
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
                <Text style={styles.productMeta} numberOfLines={1}>
                  {product.categoryName || 'Danh mục'}
                </Text>
                <Text style={styles.productMeta} numberOfLines={1}>
                  {product.shopName || 'Cửa hàng'} · ★ {Number(product.rating || 0).toFixed(1)}
                </Text>
                <Text style={styles.productLocation}>
                  ♥ {product.likeCount || 0} · ⌖ {formatLocation(product.location)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {snackbar ? (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{snackbar}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f8f7',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#3a7d74',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 4,
    color: '#102a2a',
    fontSize: 22,
    fontWeight: '900',
  },
  countBadge: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f2ef',
  },
  countText: {
    color: '#277068',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#70817f',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0f766e',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  skeletonGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonCard: {
    width: '48%',
    height: 210,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
  },
  emptyEmoji: {
    fontSize: 42,
  },
  emptyTitle: {
    color: '#203332',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#83918f',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
  },
  productGrid: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    width: '48%',
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e1e9e7',
    backgroundColor: '#ffffff',
    shadowColor: '#153f3a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  productCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  productImage: {
    position: 'relative',
    aspectRatio: 1,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#f4f8f7',
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
  productEmoji: {
    fontSize: 52,
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
  heartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 6,
  },
  heartText: {
    color: '#e85d75',
    fontSize: 18,
  },
  productName: {
    minHeight: 38,
    color: '#203332',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  productPrice: {
    marginTop: 5,
    color: '#277068',
    fontSize: 15,
    fontWeight: '900',
  },
  productMeta: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  productLocation: {
    marginTop: 5,
    color: '#83918f',
    fontSize: 11,
    fontWeight: '600',
  },
  snackbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  snackbarText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
  },
});
