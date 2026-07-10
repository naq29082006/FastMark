import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  getSellerMessagesOnBackend,
  sendSellerMessageOnBackend,
} from '../../api/sellerOpsApi';

const MESSAGE_STATUS_LABEL = {
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  seen: 'Đã xem',
};

function isMockConversation(conversationId) {
  return String(conversationId || '').startsWith('mock-');
}

function getActivityStatus(conversationId, buyerName) {
  if (conversationId === 'mock-1' || buyerName === 'Nguyễn Văn An') {
    return 'Đang hoạt động';
  }
  return 'Hoạt động 5 phút trước';
}

function getMockMessages(conversationId, buyerName) {
  if (conversationId === 'mock-1' || buyerName === 'Nguyễn Văn An') {
    return [
      {
        id: 'mock-msg-1',
        content: 'Shop ơi, sản phẩm này còn hàng không ạ?',
        isMine: false,
      },
      {
        id: 'mock-msg-2',
        content: 'Dạ shop còn hàng ạ, bạn cần đặt mấy phần?',
        isMine: true,
        status: 'seen',
      },
      {
        id: 'mock-msg-3',
        content: 'Cho mình 2 phần, giao chiều nay được không?',
        isMine: false,
      },
    ];
  }

  return [
    {
      id: `mock-msg-${conversationId}-1`,
      content: `Xin chào shop, mình là ${buyerName || 'khách hàng'}.`,
      isMine: false,
    },
    {
      id: `mock-msg-${conversationId}-2`,
      content: 'Dạ shop có thể hỗ trợ đơn hàng giúp mình nhé.',
      isMine: true,
      status: 'delivered',
    },
  ];
}

function createLocalMessage(content, extra = {}) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    content,
    isMine: true,
    status: 'sent',
    ...extra,
  };
}

function MessageStatus({ status }) {
  if (!status) {
    return null;
  }

  return <Text style={styles.messageStatus}>{MESSAGE_STATUS_LABEL[status] || 'Đã gửi'}</Text>;
}

function ChatBubble({ item }) {
  const isMine = Boolean(item.isMine);

  return (
    <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {item.imageUri ? (
          <View style={styles.imageBubble}>
            <Text style={styles.imageBubbleIcon}>🖼️</Text>
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]} numberOfLines={2}>
              {item.content || 'Ảnh sản phẩm'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
        )}
      </View>
      {isMine ? <MessageStatus status={item.status} /> : null}
    </View>
  );
}

export default function SellerChatScreen({ conversationId, buyerName, onBack }) {
  const listRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const displayName = buyerName || 'Tin nhắn';
  const activityStatus = getActivityStatus(conversationId, buyerName);
  const canSend = draft.trim().length > 0 && !isSending;
  const useMockData = isMockConversation(conversationId);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const loadMessages = useCallback(async () => {
    if (useMockData) {
      setMessages(getMockMessages(conversationId, buyerName));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const result = await getSellerMessagesOnBackend(idToken, conversationId);
      const data = Array.isArray(result) ? result : result?.messages;
      setMessages(Array.isArray(data) && data.length > 0 ? data : getMockMessages(conversationId, buyerName));
    } catch (loadError) {
      setMessages(getMockMessages(conversationId, buyerName));
      setError(loadError.message || 'Không tải được tin nhắn. Đang hiển thị dữ liệu mẫu.');
    } finally {
      setIsLoading(false);
    }
  }, [buyerName, conversationId, useMockData]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToEnd();
    }
  }, [isLoading, messages.length, scrollToEnd]);

  function promoteMessageStatus(messageId, status) {
    setMessages((current) =>
      current.map((item) => (item.id === messageId ? { ...item, status } : item))
    );
  }

  function appendLocalMessage(message) {
    setMessages((current) => [...current, message]);
    scrollToEnd();

    setTimeout(() => promoteMessageStatus(message.id, 'delivered'), 800);
    setTimeout(() => promoteMessageStatus(message.id, 'seen'), 1800);
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    if (useMockData) {
      const message = createLocalMessage(content);
      setDraft('');
      appendLocalMessage(message);
      return;
    }

    setIsSending(true);
    const optimistic = createLocalMessage(content);
    setMessages((current) => [...current, optimistic]);
    setDraft('');
    scrollToEnd();

    try {
      const idToken = await getCurrentUserIdToken();
      const message = await sendSellerMessageOnBackend({ idToken, conversationId, content });
      setMessages((current) =>
        current.map((item) =>
          item.id === optimistic.id
            ? { ...message, isMine: true, status: message.status || 'delivered' }
            : item
        )
      );
      promoteMessageStatus(message.id || optimistic.id, 'seen');
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(content);
      setError(sendError.message || 'Không gửi được tin nhắn.');
    } finally {
      setIsSending(false);
    }
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Cần quyền truy cập thư viện ảnh để gửi hình sản phẩm.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const message = createLocalMessage('Đã gửi ảnh sản phẩm', {
      imageUri: asset.uri,
    });

    if (useMockData) {
      appendLocalMessage(message);
      return;
    }

    appendLocalMessage(message);
    setError('Ảnh đã được thêm vào cuộc trò chuyện (demo UI). Tích hợp upload server sẽ bổ sung sau.');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>

        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.activityStatus} numberOfLines={1}>
              {activityStatus}
            </Text>
          </View>
        </View>

        <View style={styles.topBarSpacer} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }) => <ChatBubble item={item} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có tin nhắn.</Text>}
        />
      )}

      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          onPress={handlePickImage}
          style={({ pressed }) => [styles.attachButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.attachButtonText}>📷</Text>
        </Pressable>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          multiline
        />

        <Pressable
          accessibilityRole="button"
          disabled={!canSend}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
            pressed && canSend && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.sendButtonText, !canSend && styles.sendButtonTextDisabled]}>
            {isSending ? '...' : 'Gửi'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backButtonText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    minWidth: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  activityStatus: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  topBarSpacer: { width: 36 },
  listContent: { padding: 16, paddingBottom: 12 },
  messageRow: {
    marginBottom: 10,
    maxWidth: '82%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: '#0d7377',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bubbleTextMine: { color: '#ffffff' },
  imageBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  imageBubbleIcon: { fontSize: 18 },
  messageStatus: {
    marginTop: 4,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attachButtonText: { fontSize: 18 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  sendButton: {
    minHeight: 42,
    minWidth: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sendButtonActive: { backgroundColor: '#0d7377' },
  sendButtonDisabled: { backgroundColor: '#e2e8f0' },
  sendButtonText: { color: '#ffffff', fontWeight: '800' },
  sendButtonTextDisabled: { color: '#94a3b8' },
  buttonPressed: { opacity: 0.85 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  errorText: {
    color: '#b45309',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: '700',
    backgroundColor: '#fffbeb',
  },
});
