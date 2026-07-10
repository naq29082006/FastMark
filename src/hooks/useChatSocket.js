import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

import { getNodeApiUrl } from '../core/config/env';
import { getCurrentUserIdToken } from '../repository/authRepository';

export function useChatSocket({
  conversationId,
  enabled = true,
  onMessageNew,
  onMessageRead,
  onMessageDeleted,
  onPresenceUpdate,
}) {
  const socketRef = useRef(null);
  const handlersRef = useRef({
    onMessageNew,
    onMessageRead,
    onMessageDeleted,
    onPresenceUpdate,
  });

  handlersRef.current = {
    onMessageNew,
    onMessageRead,
    onMessageDeleted,
    onPresenceUpdate,
  };

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;
    let activeSocket = null;

    async function connect() {
      const baseUrl = getNodeApiUrl();
      if (!baseUrl) {
        return;
      }

      const token = await getCurrentUserIdToken();
      if (!token || disposed) {
        return;
      }

      const socket = io(baseUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });

      activeSocket = socket;
      socketRef.current = socket;

      socket.on('message:new', (payload) => {
        handlersRef.current.onMessageNew?.(payload);
      });

      socket.on('message:read', (payload) => {
        handlersRef.current.onMessageRead?.(payload);
      });

      socket.on('message:deleted', (payload) => {
        handlersRef.current.onMessageDeleted?.(payload);
      });

      socket.on('presence:update', (payload) => {
        handlersRef.current.onPresenceUpdate?.(payload);
      });

      if (conversationId) {
        socket.emit('conversation:join', { conversationId: String(conversationId) });
      }
    }

    connect();

    return () => {
      disposed = true;
      if (activeSocket && conversationId) {
        activeSocket.emit('conversation:leave', { conversationId: String(conversationId) });
      }
      activeSocket?.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, enabled]);

  return socketRef;
}
