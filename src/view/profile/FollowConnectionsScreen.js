import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getFollowersOnBackend, getFollowingOnBackend, unfollowUserOnBackend } from '../../api/followApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import CircularBackButton from '../shared/components/CircularBackButton';

const TABS = [
  { key: 'following', label: 'Đang theo dõi' },
  { key: 'followers', label: 'Người theo dõi' },
];

function UserRow({ item, showUnfollow, onUnfollow, onOpenShop }) {
  const avatar = item.shopAvatar || item.avatar;
  const title = item.shopName || item.fullName || item.userName || 'Người dùng';
  const subtitle = item.userName ? `@${item.userName}` : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => {
        if (item.shopId) {
          onOpenShop?.(item.shopId);
        }
      }}
    >
      <View style={styles.avatar}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{String(title).charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showUnfollow ? (
        <Pressable
          onPress={() => onUnfollow?.(item)}
          style={({ pressed }) => [styles.unfollowBtn, pressed && styles.rowPressed]}
        >
          <Text style={styles.unfollowText}>Bỏ theo dõi</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default function FollowConnectionsScreen({
  onBack,
  onOpenStore,
  initialTab = 'following',
}) {
  const [activeTab, setActiveTab] = useState(
    initialTab === 'followers' ? 'followers' : 'following'
  );
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
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
          setError('Đăng nhập để xem danh sách theo dõi.');
          return;
        }

        const params = { page: nextPage, limit: 20, search: appliedSearch };
        const result =
          activeTab === 'following'
            ? await getFollowingOnBackend(idToken, params)
            : await getFollowersOnBackend(idToken, params);

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
        setError(loadError.message || 'Không tải được danh sách.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [activeTab, appliedSearch]
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

  async function handleUnfollow(item) {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }
      await unfollowUserOnBackend({
        idToken,
        sellerUserId: item.id,
        shopId: item.shopId || undefined,
      });
      setItems((current) => current.filter((row) => String(row.id) !== String(item.id)));
      setSnackbar('Đã bỏ theo dõi.');
    } catch (unfollowError) {
      setSnackbar(unfollowError.message || 'Không thể bỏ theo dõi.');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CircularBackButton onPress={onBack} variant="surface" />
        <Text style={styles.title}>Kết nối</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => setAppliedSearch(search.trim())}
        />
        <Pressable
          onPress={() => setAppliedSearch(search.trim())}
          style={({ pressed }) => [styles.searchBtn, pressed && styles.rowPressed]}
        >
          <Text style={styles.searchBtnText}>Tìm</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.skeletonRow} />
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
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadData({ refresh: true })} />
          }
          onEndReached={() => {
            if (!isLoadingMore && page < (pagination.totalPages || 1)) {
              loadData({ nextPage: page + 1 });
            }
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>{activeTab === 'following' ? '👥' : '❤️'}</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'following' ? 'Chưa theo dõi ai' : 'Chưa có người theo dõi'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'following'
                  ? 'Theo dõi người bán từ trang gian hàng để xem tại đây.'
                  : 'Khi có người theo dõi bạn, danh sách sẽ hiển thị tại đây.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#0f766e" />
            ) : null
          }
          renderItem={({ item }) => (
            <UserRow
              item={item}
              showUnfollow={activeTab === 'following'}
              onUnfollow={handleUnfollow}
              onOpenShop={onOpenStore}
            />
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f766e',
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  rowPressed: {
    opacity: 0.78,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f766e',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  unfollowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
  },
  unfollowText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b91c1c',
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
    marginTop: 8,
  },
  skeletonRow: {
    height: 72,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
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
