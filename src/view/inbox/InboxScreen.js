import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';

import {
  getBuyerConversationsOnBackend,
  getBuyerShopsOnBackend,
} from '../../api/messageApi';
import { getSellerConversationsOnBackend } from '../../api/sellerOpsApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectIsSeller } from '../../viewmodel/auth/authSelectors';
import ChatScreen from './ChatScreen';

const INBOX_TABS = [
  { key: 'messages', label: 'Tin nhắn' },
  { key: 'notifications', label: 'Thông báo' },
];

const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    title: 'Đơn hàng đã xác nhận',
    body: 'Gian hàng đã xác nhận đơn của bạn.',
    time: '5 phút',
    unread: true,
  },
  {
    id: '2',
    title: 'Khuyến mãi',
    body: 'Giảm 10% cho đơn đầu tiên tại cửa hàng đối tác.',
    time: '1 giờ',
    unread: false,
  },
];

function getConversationName(item) {
  return item.shop?.name || 'Gian hàng';
}

function getConversationKey(item) {
  return String(item.id || item.shop?.id || item.shopId);
}

function filterConversations(conversations, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return conversations;
  }

  return conversations.filter((item) => {
    const name = getConversationName(item).toLowerCase();
    const preview = String(item.lastMessage || '').toLowerCase();
    return name.includes(keyword) || preview.includes(keyword);
  });
}

function buildShopSuggestions(conversations, shops) {
  const existingShopIds = new Set(
    conversations.map((item) => String(item.shop?.id || '')).filter(Boolean)
  );

  return shops
    .filter((entry) => entry?.shop?.id && !existingShopIds.has(String(entry.shop.id)))
    .slice(0, 6)
    .map((entry) => ({
      id: `shop-${entry.shop.id}`,
      shopId: entry.shop.id,
      shop: entry.shop,
      lastMessage: 'Bắt đầu trò chuyện với gian hàng',
      timeLabel: '',
      unreadCount: 0,
      isNew: true,
    }));
}

export default function InboxScreen({ chatRequest = null, buyerView = false, onViewShop }) {
  const isSeller = useSelector(selectIsSeller);
  const showSellerInbox = isSeller && !buyerView;
  const [activeTab, setActiveTab] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [shopSuggestions, setShopSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    if (showSellerInbox) {
      try {
        const idToken = await getCurrentUserIdToken();
        const data = await getSellerConversationsOnBackend(idToken);
        setConversations(Array.isArray(data) ? data : []);
        setShopSuggestions([]);
      } catch {
        setConversations([]);
        setShopSuggestions([]);
        setLoadError('Không tải được hộp thư người bán.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const [conversationRows, shopRows] = await Promise.all([
        getBuyerConversationsOnBackend(),
        getBuyerShopsOnBackend(),
      ]);

      setConversations(Array.isArray(conversationRows) ? conversationRows : []);
      setShopSuggestions(buildShopSuggestions(conversationRows || [], shopRows || []));
    } catch (error) {
      setConversations([]);
      setShopSuggestions([]);
      setLoadError(error.message || 'Không tải được hộp thư. Vui lòng đăng nhập lại.');
    } finally {
      setIsLoading(false);
    }
  }, [showSellerInbox]);

  useEffect(() => {
    if (activeTab === 'messages') {
      loadConversations();
    }
  }, [activeTab, loadConversations]);

  useEffect(() => {
    if (!chatRequest?.shopId || showSellerInbox) {
      return;
    }

    setActiveTab('messages');
    setSelectedChat({
      conversationId: null,
      shopId: chatRequest.shopId,
      shopName: chatRequest.shopName || 'Gian hàng',
    });
  }, [chatRequest?.at, chatRequest?.shopId, chatRequest?.shopName, showSellerInbox]);

  const messageConversations = useMemo(() => {
    if (showSellerInbox) {
      return conversations;
    }
    const merged = [...conversations, ...shopSuggestions];
    return filterConversations(merged, searchQuery);
  }, [conversations, searchQuery, shopSuggestions, showSellerInbox]);

  if (selectedChat) {
    return (
      <ChatScreen
        mode={showSellerInbox ? 'seller' : 'buyer'}
        conversationId={selectedChat.conversationId || selectedChat.id}
        shopId={selectedChat.shopId}
        shopName={selectedChat.shopName}
        buyerId={selectedChat.buyerId}
        buyerName={selectedChat.buyerName}
        onBack={() => {
          setSelectedChat(null);
          loadConversations();
        }}
        onViewShop={onViewShop}
      />
    );
  }

  const subtitle = showSellerInbox
    ? 'Tin nhắn khách hàng'
    : 'Tin nhắn với gian hàng';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
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

      {activeTab === 'messages' && !showSellerInbox ? (
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      {activeTab === 'messages' ? (
        isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#0d7377" />
          </View>
        ) : (
          <FlatList
            data={messageConversations}
            keyExtractor={(item) =>
              showSellerInbox ? String(item.id) : getConversationKey(item)
            }
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {showSellerInbox ? 'Chưa có tin nhắn' : 'Chưa có cuộc trò chuyện'}
                </Text>
                {!showSellerInbox ? (
                  <Text style={styles.emptySubtitle}>
                    Hãy chọn gian hàng bên dưới để bắt đầu nhắn tin.
                  </Text>
                ) : null}
              </View>
            }
            renderItem={({ item }) =>
              showSellerInbox ? (
                <Pressable
                  style={styles.listItem}
                  onPress={() =>
                    setSelectedChat({
                      conversationId: item.id,
                      buyerId: item.buyer?.id,
                      buyerName:
                        item.buyer?.fullName || item.buyer?.userName || 'Khách hàng',
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
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {item.buyer?.fullName || 'Khách hàng'}
                      </Text>
                      <Text style={styles.listTime}>{item.timeLabel || ''}</Text>
                    </View>
                    <Text style={styles.listPreview} numberOfLines={1}>
                      {item.lastMessage || 'Chưa có tin nhắn'}
                    </Text>
                  </View>
                  {item.unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              ) : (
                <Pressable
                  style={styles.listItem}
                  onPress={() =>
                    setSelectedChat({
                      conversationId: item.isNew ? null : item.id,
                      shopId: item.shop?.id || item.shopId,
                      shopName: getConversationName(item),
                    })
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getConversationName(item).charAt(0)}</Text>
                  </View>
                  <View style={styles.listBody}>
                    <View style={styles.listTopRow}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {getConversationName(item)}
                      </Text>
                      <Text style={styles.listTime}>{item.timeLabel || ''}</Text>
                    </View>
                    <Text
                      style={[styles.listPreview, item.isNew && styles.listPreviewNew]}
                      numberOfLines={1}
                    >
                      {item.lastMessage || 'Chưa có tin nhắn'}
                    </Text>
                  </View>
                  {item.unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              )
            }
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
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
  listTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  listTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  listTime: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  listPreview: { color: '#64748b', marginTop: 4, fontSize: 13, fontWeight: '500' },
  listPreviewNew: { color: '#0d7377', fontWeight: '700' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748b', textAlign: 'center' },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
});
