import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getReadableMessageContent, isOfferMessage } from '../../core/utils/offerMessageFormat';
import CircularBackButton from '../shared/components/CircularBackButton';

const MESSAGE_STATUS_LABEL = {
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  seen: 'Đã xem',
};

function isRealConversationId(value) {
  const id = String(value || '');
  return id.length > 0 && !id.startsWith('mock-') && !id.startsWith('shop-');
}

function getActivityStatus() {
  return 'Đang hoạt động';
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

function ImageMessageContent({ imageUri, isMine, caption }) {
  const showCaption = Boolean(caption);

  return (
    <View style={styles.imageMessageWrap}>
      <Image source={{ uri: imageUri }} style={styles.chatImage} resizeMode="cover" />
      {showCaption ? (
        <Text style={[styles.imageCaption, isMine && styles.bubbleTextMine]}>{caption}</Text>
      ) : null}
    </View>
  );
}

function ChatBubble({ item, shopInitial }) {
  const isMine = Boolean(item.isMine);
  const messageText = getReadableMessageContent(item);
  const isOffer = isOfferMessage(item);

  if (isMine) {
    return (
      <View style={[styles.messageRow, styles.messageRowMine]}>
        <View
          style={[
            styles.bubble,
            styles.bubbleMine,
            item.imageUri && styles.bubbleImage,
            isOffer && styles.bubbleOffer,
          ]}
        >
          {item.imageUri ? (
            <ImageMessageContent imageUri={item.imageUri} isMine caption={messageText} />
          ) : (
            <Text style={[styles.bubbleText, styles.bubbleTextMine, isOffer && styles.offerText]}>
              {messageText}
            </Text>
          )}
        </View>
        <MessageStatus status={item.status} />
      </View>
    );
  }

  return (
    <View style={styles.messageRowOtherWrap}>
      <View style={styles.shopAvatar}>
        <Text style={styles.shopAvatarText}>{shopInitial || 'S'}</Text>
      </View>
      <View style={styles.messageRowOther}>
        <View
          style={[
            styles.bubble,
            styles.bubbleOther,
            item.imageUri && styles.bubbleImage,
            isOffer && styles.bubbleOfferOther,
          ]}
        >
          {item.imageUri ? (
            <ImageMessageContent imageUri={item.imageUri} isMine={false} caption={messageText} />
          ) : (
            <Text style={[styles.bubbleText, isOffer && styles.offerTextOther]}>{messageText}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function BuyerChatScreen({ conversationId, shopId, shopName, onBack }) {
  const listRef = useRef(null);
  const [resolvedConversationId, setResolvedConversationId] = useState(
    isRealConversationId(conversationId) ? String(conversationId) : null
  );
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const displayName = shopName || 'Gian hàng';
  const shopInitial = displayName.charAt(0).toUpperCase();
  const activityStatus = getActivityStatus();
  const canSend = draft.trim().length > 0 && !isSending && Boolean(shopId || resolvedConversationId);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const ensureConversation = useCallback(async () => {
    if (resolvedConversationId) {
      return resolvedConversationId;
    }

    if (!shopId) {
      throw new Error('Không tìm thấy gian hàng để nhắn tin.');
    }

    const result = await startBuyerConversationOnBackend({ shopId, shopName: displayName });
    const nextId = String(result.conversationId || '');
    if (!nextId) {
      throw new Error('Không tạo được cuộc trò chuyện.');
    }

    setResolvedConversationId(nextId);
    return nextId;
  }, [resolvedConversationId, shopId, displayName]);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      if (!resolvedConversationId) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      const result = await getBuyerMessagesOnBackend(resolvedConversationId);
      const data = Array.isArray(result) ? result : result?.messages;
      setMessages(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setMessages([]);
      setError(loadError.message || 'Không tải được tin nhắn.');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedConversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToEnd();
    }
  }, [isLoading, messages.length, scrollToEnd]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    const optimistic = createLocalMessage(content);
    setMessages((current) => [...current, optimistic]);
    setDraft('');
    scrollToEnd();

    try {
      const activeConversationId = await ensureConversation();
      const message = await sendBuyerMessageOnBackend({
        conversationId: activeConversationId,
        content,
      });

      setMessages((current) =>
        current.map((item) => (item.id === optimistic.id ? message : item))
      );
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
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Không đọc được ảnh đã chọn. Vui lòng thử lại.');
      return;
    }

    const imageContent = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
    const optimistic = createLocalMessage('', { imageUri: asset.uri, status: 'sent' });
    setMessages((current) => [...current, optimistic]);
    scrollToEnd();
    setIsSending(true);

    try {
      const activeConversationId = await ensureConversation();
      const message = await sendBuyerMessageOnBackend({
        conversationId: activeConversationId,
        imageContent,
      });

      setMessages((current) =>
        current.map((item) =>
          item.id === optimistic.id
            ? { ...message, imageUri: message.imageUri || asset.uri }
            : item
        )
      );
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setError(sendError.message || 'Không gửi được ảnh.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.topBar}>
        <CircularBackButton onPress={onBack} variant="light" />

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
          renderItem={({ item }) => <ChatBubble item={item} shopInitial={shopInitial} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có tin nhắn. Hãy gửi lời chào.</Text>}
        />
      )}

      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          onPress={handlePickImage}
          disabled={isSending}
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
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
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
  messageRowOtherWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '88%',
    marginBottom: 10,
    gap: 8,
  },
  shopAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  shopAvatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  messageRowOther: {
    flex: 1,
    minWidth: 0,
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
  bubbleOffer: {
    backgroundColor: '#b45309',
  },
  bubbleOfferOther: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  offerText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  offerTextOther: {
    color: '#92400e',
    fontWeight: '700',
  },
  bubbleText: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bubbleTextMine: { color: '#ffffff' },
  bubbleImage: {
    padding: 4,
    overflow: 'hidden',
  },
  imageMessageWrap: {
    maxWidth: 220,
  },
  chatImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  imageCaption: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '500',
  },
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
