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
  getFavoriteShopsOnBackend,
  removeFavoriteShopOnBackend,
} from '../../api/favoriteShopApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import CircularBackButton from '../shared/components/CircularBackButton';
import StarRating from '../store/components/StarRating';

const OPEN_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'open', label: 'Đang mở' },
  { key: 'closed', label: 'Đã đóng' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Mới lưu' },
  { key: 'rating', label: 'Đánh giá' },
  { key: 'likes', label: 'Yêu thích' },
  { key: 'products', label: 'Sản phẩm' },
];

export default function FavoriteShopsScreen({ onBack, onOpenStore }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [openFilter, setOpenFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const loadData = useCallback(
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
          setItems([]);
          setError('Đăng nhập để xem gian hàng yêu thích.');
          return;
        }

        const isOpen =
          openFilter === 'open' ? '1' : openFilter === 'closed' ? '0' : undefined;
        const result = await getFavoriteShopsOnBackend(idToken, {
          page: nextPage,
          limit: 20,
          search: appliedSearch,
          isOpen,
          sort,
        });

        const rows = Array.isArray(result?.items) ? result.items : [];
        setPagination(
          result?.pagination || { page: nextPage, limit: 20, total: rows.length, totalPages: 1 }
        );
        setPage(nextPage);
        setItems((current) => (nextPage > 1 ? [...current, ...rows] : rows));
      } catch (loadError) {
        if (nextPage === 1) {
          setItems([]);
        }
        setError(loadError.message || 'Không tải được danh sách gian hàng yêu thích.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [appliedSearch, openFilter, sort]
  );

  useEffect(() => {
    loadData({ nextPage: 1 });
  }, [loadData]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }
    const timer = setTimeout(() => setSnackbar(''), 2200);
    return () => clearTimeout(timer);
  }, [snackbar]);

  function confirmRemove(shop) {
    Alert.alert('Bỏ yêu thích', `Bỏ yêu thích gian hàng "${shop.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ yêu thích',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            if (!idToken) {
              return;
            }
            await removeFavoriteShopOnBackend(idToken, shop.shopId);
            setItems((current) =>
              current.filter((item) => String(item.shopId) !== String(shop.shopId))
            );
            setSnackbar('Đã bỏ yêu thích gian hàng.');
          } catch (removeError) {
            setSnackbar(removeError.message || 'Không thể bỏ yêu thích.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {onBack ? <CircularBackButton onPress={onBack} variant="surface" /> : <View style={styles.headerSpacer} />}
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>BỘ SƯU TẬP</Text>
          <Text style={styles.title}>Gian hàng yêu thích</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pagination.total || items.length}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm gian hàng..."
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

      <View style={styles.filterRow}>
        {OPEN_FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setOpenFilter(filter.key)}
            style={[styles.chip, openFilter === filter.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, openFilter === filter.key && styles.chipTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterRow}>
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
          <ActivityIndicator size="large" color="#0f766e" />
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.skeletonCard} />
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>{error}</Text>
          <Pressable onPress={() => loadData({ nextPage: 1 })} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id || item.shopId)}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadData({ refresh: true })} />
          }
          onEndReached={() => {
            if (!isLoadingMore && page < (pagination.totalPages || 1)) {
              loadData({ nextPage: page + 1 });
            }
          }}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏪</Text>
              <Text style={styles.emptyTitle}>Chưa có gian hàng yêu thích</Text>
              <Text style={styles.emptySubtitle}>
                Nhấn trái tim trên trang gian hàng để lưu vào đây.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#0f766e" />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => onOpenStore?.(item.shopId)}
            >
              <View style={styles.logoWrap}>
                {item.logo ? (
                  <Image source={{ uri: item.logo }} style={styles.logo} />
                ) : (
                  <Text style={styles.logoFallback}>{String(item.name || 'G').charAt(0)}</Text>
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={[styles.openBadge, item.isOpen ? styles.openOn : styles.openOff]}>
                    <Text style={styles.openText}>{item.isOpen ? 'Mở cửa' : 'Đóng cửa'}</Text>
                  </View>
                </View>
                <Text style={styles.address} numberOfLines={2}>
                  {item.address || 'Chưa có địa chỉ'}
                </Text>
                <View style={styles.metaRow}>
                  <StarRating rating={item.rating || 0} size={14} />
                  <Text style={styles.metaText}>{Number(item.rating || 0).toFixed(1)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{item.totalProducts || 0} SP</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{item.totalLikes || 0} thích</Text>
                </View>
              </View>
              <Pressable
                onPress={() => confirmRemove(item)}
                hitSlop={8}
                style={styles.heartBtn}
              >
                <Text style={styles.heartText}>♥</Text>
              </Pressable>
            </Pressable>
          )}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerSpacer: {
    width: 40,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: '#3a7d74',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 2,
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
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e9e7',
    padding: 12,
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.8,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#eef5f3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f766e',
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#102a2a',
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  openOn: {
    backgroundColor: '#dcfce7',
  },
  openOff: {
    backgroundColor: '#fee2e2',
  },
  openText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  address: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
    fontWeight: '600',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  metaDot: {
    color: '#94a3b8',
  },
  heartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
  },
  heartText: {
    color: '#e11d48',
    fontSize: 18,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  skeletonList: {
    width: '100%',
    gap: 10,
  },
  skeletonCard: {
    height: 92,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#203332',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#83918f',
    textAlign: 'center',
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f766e',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
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
