import { useCallback, useEffect, useState } from 'react';
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
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  getSellerMessagesOnBackend,
  sendSellerMessageOnBackend,
} from '../../api/sellerOpsApi';

export default function SellerChatScreen({ conversationId, buyerName, onBack }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerMessagesOnBackend(idToken, conversationId);
      setMessages(data);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được tin nhắn.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }
    setIsSending(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const message = await sendSellerMessageOnBackend({ idToken, conversationId, content });
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (sendError) {
      setError(sendError.message || 'Không gửi được tin nhắn.');
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
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {buyerName || 'Tin nhắn'}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}>{item.content}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có tin nhắn.</Text>}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          multiline
        />
        <Pressable
          disabled={isSending}
          onPress={handleSend}
          style={({ pressed }) => [styles.sendButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.sendButtonText}>{isSending ? '...' : 'Gửi'}</Text>
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
  title: { flex: 1, marginHorizontal: 12, color: '#ffffff', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  topBarSpacer: { width: 36 },
  listContent: { padding: 16, paddingBottom: 12, gap: 8 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0d7377',
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bubbleText: { color: '#0f172a', fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#ffffff' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
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
  },
  sendButton: {
    minHeight: 42,
    minWidth: 64,
    borderRadius: 12,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sendButtonText: { color: '#ffffff', fontWeight: '800' },
  buttonPressed: { opacity: 0.85 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  errorText: { color: '#b91c1c', padding: 12, fontWeight: '700' },
});
