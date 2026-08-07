import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  getMyNotificationsOnBackend,
  markAllNotificationsReadOnBackend,
} from '../../api/notificationApi';
import {
  notificationMatchesAudience,
  prependUniqueNotification,
} from '../../core/utils/notificationRealtime';
import { showErrorAlert } from '../../core/utils/appAlert';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  NOTIFICATION_TAB,
  NOTIFICATION_TABS,
  notificationMatchesTab,
  resolveNotificationIndex,
} from '../../constants/notifications';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import OrderStatusTabBar from '../shared/components/OrderStatusTabBar';
import SubScreenHeader, {
  APP_HEADER_ICON_BUTTON_STYLE,
} from '../shared/components/SubScreenHeader';
import NotificationDetailScreen from './NotificationDetailScreen';

function formatNotificationTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'Vừa xong';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} phút`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} ngày`;
  }

  return date.toLocaleDateString('vi-VN');
}

function capitalizeFirstLetter(value = '') {
  const text = String(value).trim();
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Item được memo: chỉ thông báo nào đổi dữ liệu mới render lại. */
const NotificationRow = memo(function NotificationRow({ item, onPress }) {
  return (
    <Pressable style={styles.listItem} onPress={() => onPress?.(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>🔔</Text>
      </View>
      <View style={styles.listBody}>
        <View style={styles.listTopRow}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {capitalizeFirstLetter(item.title)}
          </Text>
          <Text style={styles.listTime}>{formatNotificationTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.content || item.body || ''}
        </Text>
      </View>
      {!item.isRead ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
});

export default function NotificationsScreen({
  onNavigationStateChange,
  audience = 'buyer',
  onBack = null,
  isScreenActive = true,
}) {
  const insets = useScreenInsets();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadingGuardRef = useRef(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [activeTab, setActiveTab] = useState(NOTIFICATION_TAB.ALL);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const fetchSeqRef = useRef(0);

  const hasUnread = useMemo(() => {
    if (unreadCount > 0) {
      return true;
    }
    return notifications.some((item) => !item.isRead);
  }, [notifications, unreadCount]);

  const loadNotifications = useCallback(
    async ({ nextPage = 1, refresh = false, tab = activeTab } = {}) => {
      if (loadingGuardRef.current && nextPage > 1) {
        return;
      }
      const fetchSeq = ++fetchSeqRef.current;

      if (nextPage === 1) {
        loadingGuardRef.current = true;
        setIsLoading(true);
      } else {
        if (loadingGuardRef.current) {
          return;
        }
        loadingGuardRef.current = true;
        setIsLoadingMore(true);
      }

      try {
        const result = await getMyNotificationsOnBackend(audience, {
          page: nextPage,
          limit: DEFAULT_PAGE_SIZE,
          tab,
        });
        if (fetchSeq !== fetchSeqRef.current) {
          return;
        }
        const items = (result.items || []).map((item) => ({
          ...item,
          index: resolveNotificationIndex(item),
        }));
        setNotifications((current) =>
          nextPage === 1 ? items : appendUniqueById(current, items)
        );
        setPage(Number(result.page) || nextPage);
        setHasMore(Boolean(result.hasMore));
        setTotalCount(Math.max(0, Number(result.total) || 0));
        setUnreadCount(Math.max(0, Number(result.unreadCount) || 0));
      } catch (error) {
        if (fetchSeq !== fetchSeqRef.current) {
          return;
        }
        if (nextPage === 1) {
          setNotifications([]);
          setHasMore(false);
          setTotalCount(0);
        }
        showErrorAlert(error.message || 'Không tải được thông báo.');
      } finally {
        if (fetchSeq !== fetchSeqRef.current) {
          return;
        }
        setIsLoading(false);
        setIsLoadingMore(false);
        loadingGuardRef.current = false;
      }
    },
    [activeTab, audience]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || loadingGuardRef.current) {
      return;
    }
    loadNotifications({ nextPage: page + 1 });
  }, [hasMore, isLoading, isLoadingMore, loadNotifications, page]);

  const renderNotificationItem = useCallback(
    ({ item }) => <NotificationRow item={item} onPress={setSelectedNotification} />,
    []
  );

  const handleRealtimeNotification = useCallback(
    (notification) => {
      if (!isScreenActive || !notificationMatchesAudience(notification, audience)) {
        return;
      }
      if (!notificationMatchesTab(notification, activeTab)) {
        return;
      }

      setNotifications((current) => prependUniqueNotification(current, notification));
    },
    [activeTab, audience, isScreenActive]
  );

  const handleNotificationReadAll = useCallback(
    (payload) => {
      if (!payload?.all) {
        return;
      }
      const eventAudience = String(payload?.audience || 'buyer').trim().toLowerCase();
      const screenAudience = String(audience || 'buyer').trim().toLowerCase();
      if (eventAudience !== screenAudience) {
        return;
      }
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    },
    [audience]
  );

  useNotificationSocket({
    enabled: isScreenActive,
    onNotificationNew: handleRealtimeNotification,
    onNotificationRead: handleNotificationReadAll,
  });

  const markAllReadMessage =
    audience === 'seller'
      ? 'Bạn có muốn đánh dấu tất cả thông báo gian hàng là đã đọc không?'
      : 'Bạn có muốn đánh dấu tất cả thông báo người mua là đã đọc không?';

  const confirmMarkAllRead = useCallback(async () => {
    if (isMarkingAllRead) {
      return;
    }
    setIsMarkingAllRead(true);
    try {
      await markAllNotificationsReadOnBackend(audience);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      showErrorAlert(error.message || 'Không đánh dấu được tất cả thông báo.');
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [audience, isMarkingAllRead]);

  const handleMarkAllReadPress = useCallback(() => {
    if (!hasUnread || isMarkingAllRead) {
      return;
    }
    Alert.alert('Đánh dấu đã đọc', markAllReadMessage, [
      { text: 'Không', style: 'cancel' },
      { text: 'Có', onPress: () => confirmMarkAllRead() },
    ]);
  }, [confirmMarkAllRead, hasUnread, isMarkingAllRead, markAllReadMessage]);

  useEffect(() => {
    if (!isScreenActive) {
      setSelectedNotification(null);
      setActiveTab(NOTIFICATION_TAB.ALL);
      return;
    }
    loadNotifications({ nextPage: 1, tab: activeTab });
  }, [isScreenActive, activeTab, loadNotifications]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(isScreenActive && selectedNotification));
  }, [isScreenActive, onNavigationStateChange, selectedNotification]);

  if (selectedNotification) {
    return (
      <NotificationDetailScreen
        notification={selectedNotification}
        audience={audience}
        onBack={() => {
          // Đã đọc được patch trực tiếp vào item (onMarkedRead) → không tải lại cả danh sách.
          setSelectedNotification(null);
        }}
        onMarkedRead={(id) => {
          setNotifications((current) =>
            current.map((item) =>
              String(item.id) === String(id) ? { ...item, isRead: true } : item
            )
          );
          setSelectedNotification((current) =>
            current && String(current.id) === String(id)
              ? { ...current, isRead: true }
              : current
          );
        }}
      />
    );
  }

  const markAllReadButton = (
    <Pressable
      onPress={handleMarkAllReadPress}
      disabled={isMarkingAllRead || !hasUnread}
      style={({ pressed }) => [
        styles.markAllBtn,
        !hasUnread && styles.markAllBtnMuted,
        pressed && hasUnread && !isMarkingAllRead && styles.markAllBtnPressed,
        isMarkingAllRead && styles.markAllBtnDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Đánh dấu tất cả đã đọc"
      hitSlop={8}
    >
      {isMarkingAllRead ? (
        <ActivityIndicator size="small" color="#076F32" />
      ) : (
        <Ionicons
          name="checkmark-done-outline"
          size={20}
          color={hasUnread ? '#076F32' : '#cbd5e1'}
        />
      )}
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Thông báo" onBack={onBack} rightSlot={markAllReadButton} />

      <OrderStatusTabBar
        tabs={NOTIFICATION_TABS}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        equalWidth
      />

      {isLoading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: onBack
                ? insets.nestedScrollPaddingBottom
                : insets.tabRootScrollPaddingBottom,
            },
          ]}
          refreshing={isLoading}
          onRefresh={() => loadNotifications({ nextPage: 1, refresh: true })}
          ListFooterComponent={
            notifications.length > 0 ? (
              <LoadMoreButton
                currentCount={notifications.length}
                totalCount={
                  hasMore
                    ? Math.max(totalCount, notifications.length + DEFAULT_PAGE_SIZE)
                    : Math.max(totalCount, notifications.length)
                }
                loading={isLoadingMore}
                onPress={handleLoadMore}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === NOTIFICATION_TAB.ALL
                  ? 'Chưa có thông báo'
                  : activeTab === NOTIFICATION_TAB.ORDER
                    ? 'Chưa có thông báo đơn hàng'
                    : 'Chưa có thông báo hệ thống'}
              </Text>
            </View>
          }
          renderItem={renderNotificationItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  markAllBtn: {
    ...APP_HEADER_ICON_BUTTON_STYLE,
  },
  markAllBtnPressed: {
    opacity: 0.82,
  },
  markAllBtnDisabled: {
    opacity: 0.65,
  },
  markAllBtnMuted: {
    opacity: 0.55,
  },
  errorText: {
    color: '#dc2626',
    marginHorizontal: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#076F32' },
  listBody: { flex: 1, minWidth: 0 },
  listTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  notificationTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  notificationBody: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  listTime: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e53935',
    marginLeft: 8,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
});
