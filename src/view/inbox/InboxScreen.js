import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerConversationsOnBackend } from '../../api/sellerOpsApi';
import { selectIsSeller } from '../../viewmodel/auth/authSelectors';
import SellerChatScreen from '../seller/SellerChatScreen';

const INBOX_TABS = [
  { key: 'messages', label: 'Tin nhắn' },
  { key: 'notifications', label: 'Thông báo' },
];

const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Đơn hàng mới', body: 'Bạn có tin nhắn mới từ khách hàng.', time: '5 phút', unread: true },
  { id: '2', title: 'Khuyến mãi', body: 'Giảm 10% phí đăng tin tuần này.', time: '1 giờ', unread: false },
];

export default function InboxScreen({ buyerView = false }) {
  const isSeller = useSelector(selectIsSeller);
  const showSellerInbox = isSeller && !buyerView;
  const [activeTab, setActiveTab] = useState('messages');
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);

  const loadConversations = useCallback(async () => {
    if (!showSellerInbox) {
      setConversations([]);
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerConversationsOnBackend(idToken);
      setConversations(data);
    } catch {
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [showSellerInbox]);

  useEffect(() => {
    if (activeTab === 'messages') {
      loadConversations();
    }
  }, [activeTab, loadConversations]);

  if (selectedChat) {
    return (
      <SellerChatScreen
        conversationId={selectedChat.id}
        buyerName={selectedChat.buyerName}
        onBack={() => setSelectedChat(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.subtitle}>
          {showSellerInbox ? 'Tin nhắn khách hàng' : 'Tin nhắn và thông báo'}
        </Text>
      </View>

      <View style={styles.tabRow}>
        {INBOX_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'messages' ? (
        isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#0d7377" />
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.listItem}
                onPress={() =>
                  setSelectedChat({
                    id: item.id,
                    buyerName: item.buyer?.fullName || item.buyer?.userName || 'Khách hàng',
                  })
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.buyer?.fullName || 'K').charAt(0)}
                  </Text>
                </View>
                <View style={styles.listBody}>
                  <View style={styles.listTopRow}>
                    <Text style={styles.listTitle}>{item.buyer?.fullName || 'Khách hàng'}</Text>
                    <Text style={styles.listTime}>{item.timeLabel}</Text>
                  </View>
                  <Text style={styles.listPreview} numberOfLines={1}>
                    {item.lastMessage || 'Chưa có tin nhắn'}
                  </Text>
                </View>
                {item.unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            )}
          />
        )
      ) : (
        <FlatList
          data={MOCK_NOTIFICATIONS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable style={styles.listItem}>
              <View style={styles.avatar}>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#ffffff' },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { color: '#64748b', marginTop: 4, fontWeight: '600' },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  tabItemActive: { backgroundColor: '#e8f3f1' },
  tabText: { fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#0d7377' },
  listContent: { padding: 16, paddingBottom: 32 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#0d7377' },
  listBody: { flex: 1, minWidth: 0 },
  listTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  listTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  listTime: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  listPreview: { color: '#64748b', marginTop: 4, fontSize: 13 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748b' },
});
