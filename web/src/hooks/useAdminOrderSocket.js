import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { apiUrl } from '../config/env';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const listeners = new Set();

function notifyListeners(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn('admin order socket listener failed:', error?.message || error);
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

async function ensureSharedSocket(getIdToken) {
  if (sharedSocket?.connected) {
    return sharedSocket;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    if (!apiUrl || typeof getIdToken !== 'function') {
      return null;
    }

    const token = await getIdToken();
    if (!token) {
      return null;
    }

    disconnectSharedSocket();

    const socket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('order_updated', (payload) => {
      notifyListeners(payload);
    });
    socket.on('admin_updated', (payload) => {
      const type = String(payload?.type || '').trim().toLowerCase();
      if (type === 'order' || type === 'reservation') {
        notifyListeners(payload);
      }
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

export function useAdminOrderSocket({ enabled = true, getIdToken, onOrderUpdated } = {}) {
  useEffect(() => {
    if (!enabled || typeof onOrderUpdated !== 'function' || typeof getIdToken !== 'function') {
      return undefined;
    }

    listeners.add(onOrderUpdated);
    listenerCount += 1;
    ensureSharedSocket(getIdToken);

    return () => {
      listeners.delete(onOrderUpdated);
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, getIdToken, onOrderUpdated]);
}
