import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

export default function FavoriteProductsScreen({ onOpenProduct }) {
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadFavorites = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) {
      setIsRefreshing(true);
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

      const rows = await getFavoriteProductsOnBackend(idToken);
      setFavorites(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      setFavorites([]);
      setError(loadError.message || 'Không tải được danh sách yêu thích.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  async function handleRemoveFavorite(productId) {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }
      await removeFavoriteProductOnBackend(idToken, productId);
      setFavorites((current) => current.filter((item) => String(item.productId) !== String(productId)));
    } catch {
      // Keep list unchanged if remove fails.
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadFavorites({ refresh: true })} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BỘ SƯU TẬP CỦA BẠN</Text>
          <Text style={styles.title}>Sản phẩm yêu thích</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{favorites.length}</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>Lưu lại những sản phẩm bạn muốn xem và mua sau.</Text>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#277068" />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>🤍</Text>
          <Text style={styles.emptyTitle}>Chưa có sản phẩm yêu thích</Text>
          <Text style={styles.emptySubtitle}>
            Nhấn trái tim ở gian hàng để lưu sản phẩm vào đây.
          </Text>
        </View>
      ) : (
        <View style={styles.productGrid}>
          {favorites.map((product) => {
            const overlayLabel = getProductImageOverlayLabel(product);

            return (
            <Pressable
              key={product.id}
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
                  onPress={() => handleRemoveFavorite(product.productId)}
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
                {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
              </Text>
              <Text style={styles.productLocation}>⌖ {formatLocation(product.location)}</Text>
            </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f8f7',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
    flexGrow: 1,
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
    fontSize: 25,
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
    marginBottom: 20,
    color: '#70817f',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
  productLocation: {
    marginTop: 5,
    color: '#83918f',
    fontSize: 11,
    fontWeight: '600',
  },
});
