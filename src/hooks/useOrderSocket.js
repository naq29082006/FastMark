import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { getNodeApiUrl } from '../core/config/env';
import { getCurrentUserIdToken } from '../repository/authRepository';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const listeners = new Set();
const recentEvents = new Map();
const ORDER_EVENT_DEDUPE_MS = 800;

function buildOrderEventKey(payload) {
  const reservationId = String(payload?.reservationId || payload?.id || '').trim();
  if (!reservationId) {
    return '';
  }
  return [
    reservationId,
    payload?.status ?? '',
    payload?.action ?? '',
    payload?.updatedAt ?? '',
  ].join(':');
}

function shouldSkipDuplicateOrderEvent(payload) {
  const key = buildOrderEventKey(payload);
  if (!key) {
    return false;
  }
  const now = Date.now();
  const lastSeen = recentEvents.get(key);
  if (lastSeen != null && now - lastSeen < ORDER_EVENT_DEDUPE_MS) {
    return true;
  }
  recentEvents.set(key, now);
  if (recentEvents.size > 200) {
    for (const [entryKey, seenAt] of recentEvents) {
      if (now - seenAt > ORDER_EVENT_DEDUPE_MS * 2) {
        recentEvents.delete(entryKey);
      }
    }
  }
  return false;
}

function notifyListeners(payload) {
  if (shouldSkipDuplicateOrderEvent(payload)) {
    return;
  }
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn('order socket listener failed:', error?.message || error);
    }
  });
}

function disconnectSharedSocket() {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  connectPromise = null;
}

async function ensureSharedSocket() {
  if (sharedSocket?.connected) {
    return sharedSocket;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const baseUrl = getNodeApiUrl();
    if (!baseUrl) {
      return null;
    }

    const token = await getCurrentUserIdToken();
    if (!token) {
      return null;
    }

    disconnectSharedSocket();

    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('order_updated', (payload) => {
      notifyListeners(payload);
    });

    socket.on('disconnect', () => {
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    });

    sharedSocket = socket;
    return socket;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function useOrderSocket({ enabled = true, onOrderUpdated } = {}) {
  useEffect(() => {
    if (!enabled || typeof onOrderUpdated !== 'function') {
      return undefined;
    }

    listeners.add(onOrderUpdated);
    listenerCount += 1;
    ensureSharedSocket();

    return () => {
      listeners.delete(onOrderUpdated);
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, onOrderUpdated]);
}
