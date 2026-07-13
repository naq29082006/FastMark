import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getMyNotificationsOnBackend } from '../../api/notificationApi';

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

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedNotification, setSelectedNotification] = useState(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const items = await getMyNotificationsOnBackend();
      setNotifications(Array.isArray(items) ? items : []);
    } catch (error) {
      setNotifications([]);
      setLoadError(error.message || 'Không tải được thông báo.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  if (selectedNotification) {
    return (
      <NotificationDetailScreen
        notification={selectedNotification}
        onBack={() => setSelectedNotification(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        <Text style={styles.subtitle}>Cập nhật đơn hàng và hệ thống</Text>
      </View>

      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={loadNotifications}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
              <Text style={styles.emptySubtitle}>
                Thông báo hệ thống và cập nhật đơn hàng sẽ hiển thị tại đây.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.listItem} onPress={() => setSelectedNotification(item)}>
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
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { color: '#64748b', marginTop: 4, fontWeight: '600' },
  errorText: {
    color: '#dc2626',
    marginHorizontal: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
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
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#0d7377' },
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
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
