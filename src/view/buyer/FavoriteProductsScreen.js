import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import {
  getFavoriteProductsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import ProductCard from '../shared/components/ProductCard';
import ClearableSearchField from '../shared/components/ClearableSearchField';

const SEARCH_DEBOUNCE_MS = 400;

function mapFavoriteToProduct(item) {
  const distanceMeters =
    item.distanceMeters == null || item.distanceMeters === ''
      ? null
      : Number(item.distanceMeters);

  return {
    id: item.productId,
    name: item.name,
    thumbnail: item.thumbnail,
    price: item.price,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    likeCount: item.likeCount,
    soldCount: item.soldCount,
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
    status: item.status,
    isUnavailable: item.isUnavailable,
    isOutOfStock: item.isOutOfStock,
    remainingQuantity: item.remainingQuantity,
    variants: item.variants,
  };
}

export default function FavoriteProductsScreen({
  onOpenProduct,
  onBack = null,
  title = 'Quản lý sản phẩm yêu thích',
}) {
  const searchTimerRef = useRef(null);
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

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

        const params = {
          page: nextPage,
          limit: 20,
          search: debouncedSearch,
        };
        if (hasValidLocation(currentLocation)) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }

        const result = await getFavoriteProductsOnBackend(idToken, params);
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
    [currentLocation, debouncedSearch]
  );

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

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
    loadFavorites({ nextPage: 1 });
  }, [loadFavorites]);

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
            Alert.alert('Thành công', 'Đã bỏ yêu thích sản phẩm.');
          } catch {
            Alert.alert('Lỗi', 'Không thể bỏ yêu thích sản phẩm.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pagination.total || favorites.length}</Text>
        </View>
      </View>

      <ClearableSearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm sản phẩm..."
        style={styles.searchField}
      />

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
              onRefresh={() => {
                loadLocation();
                loadFavorites({ refresh: true });
              }}
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
          renderItem={({ item }) => {
            const product = mapFavoriteToProduct(item);
            return (
              <ProductCard
                product={product}
                isLiked
                onToggleLike={() => confirmRemove(item.productId, item.name)}
                onPress={() => onOpenProduct?.(item.productId)}
              />
            );
          }}
        />
      )}
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
    marginBottom: 12,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    flex: 1,
    color: '#102a2a',
    fontSize: 18,
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
  searchField: {
    marginBottom: 12,
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
});
