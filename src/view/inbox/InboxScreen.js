import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

const INBOX_TABS = [
  { key: 'messages', label: 'Tin nhắn' },
  { key: 'notifications', label: 'Thông báo' },
];

const MOCK_MESSAGES = [
  { id: '1', name: 'Cửa hàng ABC', preview: 'Sản phẩm còn hàng không ạ?', time: '10:30', unread: true },
  { id: '2', name: 'Nguyễn Văn A', preview: 'Giao hàng trong ngày được không?', time: 'Hôm qua', unread: false },
];

const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Đơn hàng mới', body: 'Bạn có 1 tin nhắn mới từ khách hàng.', time: '5 phút', unread: true },
  { id: '2', title: 'Khuyến mãi', body: 'Giảm 10% phí đăng tin tuần này.', time: '1 giờ', unread: false },
];

function MessagesList() {
  return (
    <FlatList
      data={MOCK_MESSAGES}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.listItem}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.listBody}>
            <View style={styles.listTopRow}>
              <Text style={styles.listTitle}>{item.name}</Text>
              <Text style={styles.listTime}>{item.time}</Text>
            </View>
            <Text style={styles.listPreview} numberOfLines={1}>
              {item.preview}
            </Text>
          </View>
          {item.unread ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      )}
    />
  );
}

function NotificationsList() {
  return (
    <FlatList
      data={MOCK_NOTIFICATIONS}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.listItem}>
          <View style={[styles.avatar, styles.notifyAvatar]}>
            <Text style={styles.avatarText}>🔔</Text>
          </View>
          <View style={styles.listBody}>
            <View style={styles.listTopRow}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.listTime}>{item.time}</Text>
            </View>
            <Text style={styles.listPreview} numberOfLines={2}>
              {item.body}
            </Text>
          </View>
          {item.unread ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      )}
    />
  );
}

export default function InboxScreen() {
  const [activeTab, setActiveTab] = useState('messages');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
      </View>

      <View style={styles.tabRow}>
        {INBOX_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        {activeTab === 'messages' ? <MessagesList /> : <NotificationsList />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1f2937',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: '#0d7377',
  },
  panel: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifyAvatar: {
    backgroundColor: '#fef3c7',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0d7377',
  },
  listBody: {
    flex: 1,
  },
  listTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  listTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  listTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  listPreview: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
});
