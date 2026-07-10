import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSelector } from 'react-redux';

import {
  deleteBuyerMessageOnBackend,
  getBuyerConversationPeerOnBackend,
  getBuyerMessagesOnBackend,
  sendBuyerMessageOnBackend,
  startBuyerConversationOnBackend,
} from '../../api/messageApi';
import {
  deleteSellerMessageOnBackend,
  getSellerConversationPeerOnBackend,
  getSellerMessagesOnBackend,
  getSellerShopSettingsOnBackend,
  sendSellerMessageOnBackend,
} from '../../api/sellerOpsApi';
import {
  buildChatImagePayload,
  chooseChatImageSource,
  pickChatImageFromLibrary,
} from '../../core/utils/chatImagePicker';
import { formatActivityLabel } from '../../core/utils/activityLabel';
import { buildChatListItems, markMessagesFromServer, mergeMessages, normalizeMessages, upsertMessage, applyMessageViewerContext } from '../../core/utils/chatMessageUtils';
import { useChatSocket } from '../../hooks/useChatSocket';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectAuthProfile, selectAuthUser } from '../../viewmodel/auth/authSelectors';
import ChatProfileScreen from './ChatProfileScreen';

const MESSAGE_STATUS_LABEL = {
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  seen: 'Đã xem',
};

function isRealConversationId(value) {
  const id = String(value || '');
  return id.length > 0 && !id.startsWith('mock-') && !id.startsWith('shop-');
}

function createLocalMessage(content, extra = {}) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    content,
    isMine: true,
    status: 'sent',
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function formatTimeLabel(message) {
  if (message?.timeLabel) {
    return message.timeLabel;
  }

  const value = new Date(message?.createdAt || Date.now());
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSequenceLabel(sequence) {
  if (!sequence?.total) {
    return '';
  }

  const from = Number(sequence.from) || 1;
  const to = Number(sequence.to) || from;

  if (from === to) {
    return `Tin nhắn #${from}`;
  }

  return `Tin nhắn #${from}–#${to} · ${sequence.total} tin`;
}

function MessageStatus({ status }) {
  if (!status) {
    return null;
  }

  return <Text style={styles.messageStatus}>{MESSAGE_STATUS_LABEL[status] || 'Đã gửi'}</Text>;
}

function DateSeparator({ label }) {
  return (
    <View style={styles.dateSeparatorWrap}>
      <View style={styles.dateSeparatorPill}>
        <Text style={styles.dateSeparatorText}>{label}</Text>
      </View>
    </View>
  );
}

function ImageMessageContent({ imageUri, isMine, caption, isDeleted }) {
  if (isDeleted) {
    return <Text style={[styles.deletedText, isMine && styles.deletedTextMine]}>Tin nhắn đã được gỡ</Text>;
  }

  return (
    <View style={styles.imageMessageWrap}>
      <Image source={{ uri: imageUri }} style={styles.chatImage} resizeMode="cover" />
      {caption ? (
        <Text style={[styles.imageCaption, isMine && styles.bubbleTextMine]}>{caption}</Text>
      ) : null}
    </View>
  );
}

function ChatBubble({ item, peerAvatarUri, peerInitial, onLongPress }) {
  const isMine = Boolean(item.isMine);
  const isDeleted = Boolean(item.isDeleted);
  const timeLabel = formatTimeLabel(item);

  const bubbleBody = item.imageUri ? (
    <ImageMessageContent
      imageUri={item.imageUri}
      isMine={isMine}
      caption={item.content}
      isDeleted={isDeleted}
    />
  ) : (
    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine, isDeleted && (isMine ? styles.deletedTextMine : styles.deletedText)]}>
      {item.content}
    </Text>
  );

  if (isMine) {
    return (
      <Pressable onLongPress={() => onLongPress?.(item)} delayLongPress={350}>
        <View style={[styles.messageRow, styles.messageRowMine]}>
          <View
            style={[
              styles.bubble,
              styles.bubbleMine,
              item.imageUri && !isDeleted && styles.bubbleImage,
              isDeleted && styles.bubbleDeleted,
            ]}
          >
            {bubbleBody}
            <View style={styles.bubbleMetaMine}>
              {timeLabel ? <Text style={styles.bubbleTimeMine}>{timeLabel}</Text> : null}
              {!isDeleted ? <MessageStatus status={item.status} /> : null}
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.messageRowOtherWrap}>
      <View style={styles.peerAvatar}>
        {peerAvatarUri ? (
          <Image source={{ uri: peerAvatarUri }} style={styles.peerAvatarImage} />
        ) : (
          <Text style={styles.peerAvatarText}>{peerInitial || '?'}</Text>
        )}
      </View>
      <View style={styles.messageRowOther}>
        <View
          style={[
            styles.bubble,
            styles.bubbleOther,
            item.imageUri && !isDeleted && styles.bubbleImage,
            isDeleted && styles.bubbleDeleted,
          ]}
        >
          {bubbleBody}
          {timeLabel ? <Text style={styles.bubbleTimeOther}>{timeLabel}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function resolveOwnShopId(shop) {
  const raw = shop?.shopId || shop?.id || shop?._id;
  return raw ? String(raw) : null;
}

export default function ChatScreen({
  mode = 'buyer',
  conversationId,
  shopId,
  shopName,
  buyerId,
  buyerName,
  onBack,
  onViewShop,
}) {
  const listRef = useRef(null);
  const isSellerMode = mode === 'seller';
  const authUser = useSelector(selectAuthUser);
  const authProfile = useSelector(selectAuthProfile);
  const mongoUserId = authProfile?.mongoUserId || '';

  const [resolvedConversationId, setResolvedConversationId] = useState(
    isRealConversationId(conversationId) ? String(conversationId) : null
  );
  const [messages, setMessages] = useState([]);
  const [sequence, setSequence] = useState(null);
  const [ownShopId, setOwnShopId] = useState(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [peer, setPeer] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const displayName = useMemo(() => {
    if (isSellerMode) {
      return peer?.fullName || buyerName || 'Khách hàng';
    }
    return peer?.name || shopName || 'Gian hàng';
  }, [buyerName, isSellerMode, peer, shopName]);

  const peerInitial = displayName.charAt(0).toUpperCase();
  const activityStatus = peer?.isOnline
    ? 'Đang hoạt động'
    : peer?.activityLabel || formatActivityLabel(peer?.isOnline, peer?.lastActiveAt);
  const sequenceLabel = formatSequenceLabel(sequence);
  const viewerContext = useMemo(
    () => ({
      isSellerMode,
      userId: mongoUserId,
      shopId: ownShopId,
    }),
    [isSellerMode, mongoUserId, ownShopId]
  );
  const chatItems = useMemo(() => buildChatListItems(messages), [messages]);

  const canSend =
    draft.trim().length > 0 && !isSending && Boolean(resolvedConversationId || shopId || conversationId);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const ensureConversation = useCallback(async () => {
    if (resolvedConversationId) {
      return resolvedConversationId;
    }

    if (isSellerMode) {
      if (!isRealConversationId(conversationId)) {
        throw new Error('Không tìm thấy cuộc trò chuyện.');
      }
      setResolvedConversationId(String(conversationId));
      return String(conversationId);
    }

    if (!shopId) {
      throw new Error('Không tìm thấy gian hàng để nhắn tin.');
    }

    const result = await startBuyerConversationOnBackend({ shopId, shopName: displayName });
    const nextId = String(result.conversationId || '');
    if (!nextId) {
      throw new Error('Không tạo được cuộc trò chuyện.');
    }

    if (result.shop) {
      setPeer(result.shop);
    }

    setResolvedConversationId(nextId);
    return nextId;
  }, [conversationId, displayName, isSellerMode, resolvedConversationId, shopId]);

  useEffect(() => {
    if (isRealConversationId(conversationId)) {
      setResolvedConversationId(String(conversationId));
    }
  }, [conversationId]);

  const loadPeer = useCallback(
    async (activeConversationId) => {
      if (!activeConversationId) {
        return;
      }

      try {
        if (isSellerMode) {
          const idToken = await getCurrentUserIdToken();
          const nextPeer = await getSellerConversationPeerOnBackend(idToken, activeConversationId);
          setPeer(nextPeer);
          return;
        }

        const nextPeer = await getBuyerConversationPeerOnBackend(activeConversationId);
        setPeer(nextPeer);
      } catch {
        // Peer info is optional for chat rendering.
      }
    },
    [isSellerMode]
  );

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const activeConversationId = await ensureConversation();
      let activeShopId = ownShopId;
      let result = { messages: [], sequence: null };

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        if (!activeShopId) {
          const shop = await getSellerShopSettingsOnBackend(idToken);
          activeShopId = resolveOwnShopId(shop);
          setOwnShopId(activeShopId);
        }
        result = await getSellerMessagesOnBackend(idToken, activeConversationId);
      } else {
        result = await getBuyerMessagesOnBackend(activeConversationId);
      }

      setMessages(
        markMessagesFromServer(
          normalizeMessages(
            Array.isArray(result?.messages) ? result.messages : [],
            viewerContext,
            { trustServer: true }
          )
        )
      );
      setSequence(result?.sequence || null);
      await loadPeer(activeConversationId);
    } catch (loadError) {
      setMessages([]);
      setSequence(null);
      setError(loadError.message || 'Không tải được tin nhắn.');
    } finally {
      setIsLoading(false);
    }
  }, [ensureConversation, isSellerMode, loadPeer, ownShopId, viewerContext]);

  useEffect(() => {
    if (!isSellerMode) {
      setOwnShopId(null);
      return;
    }

    if (ownShopId) {
      return;
    }

    let cancelled = false;

    async function loadOwnShop() {
      try {
        const idToken = await getCurrentUserIdToken();
        const shop = await getSellerShopSettingsOnBackend(idToken);
        if (!cancelled) {
          setOwnShopId(resolveOwnShopId(shop));
        }
      } catch {
        if (!cancelled) {
          setOwnShopId(null);
        }
      }
    }

    loadOwnShop();

    return () => {
      cancelled = true;
    };
  }, [isSellerMode, ownShopId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!isLoading && chatItems.length > 0) {
      scrollToEnd();
    }
  }, [chatItems.length, isLoading, scrollToEnd]);

  const bumpSequence = useCallback((thuTu, shouldIncrement = true) => {
    if (!thuTu) {
      return;
    }

    setSequence((current) => ({
      from: current?.from ? Math.min(current.from, thuTu) : thuTu,
      to: current?.to ? Math.max(current.to, thuTu) : thuTu,
      total: shouldIncrement ? (current?.total || 0) + 1 : current?.total || 0,
      count: shouldIncrement ? (current?.count || 0) + 1 : current?.count || 0,
    }));
  }, []);

  useChatSocket({
    conversationId: resolvedConversationId,
    enabled: Boolean(resolvedConversationId),
    onMessageNew: (payload) => {
      if (!payload?.message) {
        return;
      }

      const normalized = applyMessageViewerContext(payload.message, viewerContext);
      if (normalized.isMine) {
        return;
      }

      setMessages((current) => {
        const alreadyExists = current.some(
          (item) => String(item.id) === String(normalized.id)
        );
        const next = mergeMessages(current, normalized);
        if (!alreadyExists) {
          bumpSequence(normalized.thuTu, true);
        }
        return next;
      });
      scrollToEnd();
    },
    onMessageRead: (payload) => {
      if (!payload?.messageIds?.length) {
        return;
      }
      const idSet = new Set(payload.messageIds.map(String));
      setMessages((current) =>
        current.map((item) =>
          idSet.has(String(item.id)) ? { ...item, status: 'seen' } : item
        )
      );
    },
    onMessageDeleted: (payload) => {
      if (!payload?.message) {
        return;
      }
      setMessages((current) =>
        mergeMessages(current, applyMessageViewerContext(payload.message, viewerContext))
      );
    },
    onPresenceUpdate: (payload) => {
      setPeer((current) => {
        if (!current) {
          return current;
        }

        const expectedTarget = isSellerMode ? 'user' : 'shop';
        if (payload?.target && payload.target !== expectedTarget) {
          return current;
        }

        const matchesPeer = isSellerMode
          ? payload?.userId && String(current.id) === String(payload.userId)
          : payload?.shopId && String(current.id) === String(payload.shopId);

        if (!matchesPeer) {
          return current;
        }

        return {
          ...current,
          isOnline: payload.isOnline,
          lastActiveAt: payload.lastActiveAt,
          activityLabel: payload.activityLabel,
        };
      });
    },
  });

  async function sendImageMessage(image) {
    if (!image) {
      return;
    }

    const { uri, imageContent } = buildChatImagePayload(image);
    const optimistic = {
      ...createLocalMessage('', { imageUri: uri, status: 'sent' }),
      isMine: true,
    };
    setMessages((current) => upsertMessage(current, optimistic));
    scrollToEnd();
    setIsSending(true);

    try {
      const activeConversationId = await ensureConversation();
      let message;

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        message = await sendSellerMessageOnBackend({
          idToken,
          conversationId: activeConversationId,
          imageContent,
        });
      } else {
        message = await sendBuyerMessageOnBackend({
          conversationId: activeConversationId,
          imageContent,
        });
      }

      setMessages((current) =>
        upsertMessage(
          current,
          {
            ...message,
            fromServer: true,
            imageUri: message.imageUri || uri,
          },
          {
            removePending: true,
            pendingId: optimistic.id,
          }
        )
      );
      bumpSequence(message?.thuTu);
    } catch (pickError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setError(pickError.message || 'Không gửi được ảnh.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    const optimistic = {
      ...createLocalMessage(content),
      isMine: true,
    };
    setMessages((current) => upsertMessage(current, optimistic));
    setDraft('');
    scrollToEnd();

    try {
      const activeConversationId = await ensureConversation();
      let message;

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        message = await sendSellerMessageOnBackend({
          idToken,
          conversationId: activeConversationId,
          content,
        });
      } else {
        message = await sendBuyerMessageOnBackend({
          conversationId: activeConversationId,
          content,
        });
      }

      setMessages((current) =>
        upsertMessage(
          current,
          {
            ...message,
            fromServer: true,
          },
          {
            removePending: true,
            pendingId: optimistic.id,
          }
        )
      );
      bumpSequence(message?.thuTu, true);
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(content);
      setError(sendError.message || 'Không gửi được tin nhắn.');
    } finally {
      setIsSending(false);
    }
  }

  async function handlePickImage() {
    try {
      const image = await pickChatImageFromLibrary();
      await sendImageMessage(image);
    } catch (pickError) {
      setError(pickError.message || 'Không gửi được ảnh.');
    }
  }

  async function handleAttachMenu() {
    try {
      const image = await chooseChatImageSource();
      await sendImageMessage(image);
    } catch (pickError) {
      setError(pickError.message || 'Không gửi được ảnh.');
    }
  }

  function handleLongPressMessage(item) {
    if (!item.isMine || item.isDeleted) {
      return;
    }

    Alert.alert('Tin nhắn', 'Bạn muốn gỡ tin nhắn này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Gỡ tin nhắn',
        style: 'destructive',
        onPress: async () => {
          try {
            const activeConversationId = resolvedConversationId || (await ensureConversation());
            let deleted;

            if (isSellerMode) {
              const idToken = await getCurrentUserIdToken();
              deleted = await deleteSellerMessageOnBackend(
                idToken,
                activeConversationId,
                item.id
              );
            } else {
              deleted = await deleteBuyerMessageOnBackend(activeConversationId, item.id);
            }

            setMessages((current) => mergeMessages(current, deleted));
          } catch (deleteError) {
            setError(deleteError.message || 'Không gỡ được tin nhắn.');
          }
        },
      },
    ]);
  }

  if (showProfile) {
    return (
      <ChatProfileScreen
        peer={peer}
        peerType={isSellerMode ? 'user' : 'shop'}
        onBack={() => setShowProfile(false)}
        onViewShop={
          !isSellerMode && onViewShop && peer?.id
            ? () => {
                setShowProfile(false);
                onViewShop(peer.id);
              }
            : undefined
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowProfile(true)}
          style={({ pressed }) => [styles.headerInfo, pressed && styles.buttonPressed]}
        >
          <View style={styles.headerAvatarWrap}>
            <View style={styles.headerAvatar}>
              {peer?.avatar ? (
                <Image source={{ uri: peer.avatar }} style={styles.headerAvatarImage} />
              ) : (
                <Text style={styles.headerAvatarText}>{peerInitial}</Text>
              )}
            </View>
            {peer?.isOnline ? <View style={styles.onlineDot} /> : null}
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {displayName}
            </Text>
            <Text
              style={[styles.activityStatus, peer?.isOnline && styles.activityOnline]}
              numberOfLines={1}
            >
              {activityStatus}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}>
            <Text style={styles.headerActionText}>⌕</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}>
            <Text style={styles.headerActionText}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {sequenceLabel ? <Text style={styles.sequenceText}>{sequenceLabel}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={chatItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return <DateSeparator label={item.label} />;
            }

            return (
              <ChatBubble
                item={item.message}
                peerAvatarUri={peer?.avatar}
                peerInitial={peerInitial}
                onLongPress={handleLongPressMessage}
              />
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có tin nhắn. Hãy gửi lời chào.</Text>}
        />
      )}

      <View style={styles.composer}>
        <Pressable
          onPress={handleAttachMenu}
          disabled={isSending}
          style={({ pressed }) => [styles.roundActionButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.roundActionText}>+</Text>
        </Pressable>

        <Pressable
          onPress={handlePickImage}
          disabled={isSending}
          style={({ pressed }) => [styles.roundActionButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.roundActionText}>🖼</Text>
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
          disabled={!canSend}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
            pressed && canSend && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.sendButtonText, !canSend && styles.sendButtonTextDisabled]}>
            {isSending ? '…' : '➤'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f8' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf2',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#0f172a', fontSize: 22, fontWeight: '700' },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    minWidth: 0,
  },
  headerAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: '100%', height: '100%' },
  headerAvatarText: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  activityStatus: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  activityOnline: { color: '#16a34a' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerActionText: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '700',
  },
  sequenceText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
  },
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  dateSeparatorPill: {
    backgroundColor: '#e8edf2',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  dateSeparatorText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  messageRow: { marginBottom: 12, maxWidth: '82%' },
  messageRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageRowOtherWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '88%',
    marginBottom: 12,
    gap: 8,
  },
  peerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  peerAvatarImage: { width: '100%', height: '100%' },
  peerAvatarText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  messageRowOther: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#0d7377', borderBottomRightRadius: 6 },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 6,
  },
  bubbleDeleted: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  bubbleText: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bubbleTextMine: { color: '#ffffff' },
  deletedText: { color: '#94a3b8', fontStyle: 'italic' },
  deletedTextMine: { color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' },
  bubbleImage: { padding: 4, overflow: 'hidden' },
  bubbleMetaMine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
  },
  bubbleTimeOther: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  imageMessageWrap: { maxWidth: 220 },
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
  messageStatus: { fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
    backgroundColor: '#ffffff',
  },
  roundActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  roundActionText: { fontSize: 18, color: '#334155', fontWeight: '700' },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: { backgroundColor: '#0d7377' },
  sendButtonDisabled: { backgroundColor: '#e2e8f0' },
  sendButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
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
