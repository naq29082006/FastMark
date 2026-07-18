import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';
import { markNotificationReadOnBackend } from '../../api/notificationApi';

function formatNotificationTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function capitalizeFirstLetter(value = '') {
  const text = String(value).trim();
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function NotificationDetailScreen({
  notification,
  onBack,
  onMarkedRead,
  audience = 'buyer',
}) {
  const [isRead, setIsRead] = useState(Boolean(notification?.isRead));
  const title = capitalizeFirstLetter(notification?.title || 'Thông báo');
  const body = notification?.content || notification?.body || '';
  const createdAt = formatNotificationTime(notification?.createdAt);

  useEffect(() => {
    setIsRead(Boolean(notification?.isRead));
  }, [notification?.id, notification?.isRead]);

  useEffect(() => {
    const id = notification?.id;
    if (!id || notification?.isRead) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        await markNotificationReadOnBackend(id, audience);
        if (cancelled) {
          return;
        }
        setIsRead(true);
        onMarkedRead?.(id);
      } catch {
        // Keep unread UI if API fails; list can retry later.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audience, notification?.id, notification?.isRead, onMarkedRead]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CircularBackButton onPress={onBack} variant="surface" />
        <Text style={styles.headerTitle}>Chi tiết thông báo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🔔</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {createdAt ? <Text style={styles.time}>{createdAt}</Text> : null}
          <View style={styles.divider} />
          <Text style={styles.body}>{body || 'Không có nội dung chi tiết.'}</Text>
          {!isRead ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>Chưa đọc</Text>
            </View>
          ) : (
            <View style={styles.readBadge}>
              <Text style={styles.readBadgeText}>Đã đọc</Text>
            </View>
          )}
        </View>

        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Quay lại danh sách</Text>
        </Pressable>
      </ScrollView>
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 28,
  },
  time: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
    fontWeight: '500',
  },
  unreadBadge: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadBadgeText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  readBadge: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: '#E6F4EC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readBadgeText: {
    color: '#076F32',
    fontSize: 12,
    fontWeight: '800',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
});
