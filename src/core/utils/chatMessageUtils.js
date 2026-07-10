function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function formatDateSeparator(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  const now = new Date();
  const today = startOfDay(now);
  const target = startOfDay(value);
  const diffDays = Math.round((today - target) / 86400000);

  if (diffDays === 0) {
    return 'Hôm nay';
  }
  if (diffDays === 1) {
    return 'Hôm qua';
  }

  return value.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isPendingMessage(message) {
  return String(message?.id || '').startsWith('local-');
}

export const SENDER_TYPE = {
  USER: 0,
  SHOP: 1,
};

export function applyMessageViewerContext(message, { isSellerMode, userId, shopId } = {}) {
  if (!message) {
    return message;
  }

  if (typeof message.isMine === 'boolean' && message.fromServer) {
    return message;
  }

  const senderType = Number(message.senderType ?? SENDER_TYPE.USER);
  const senderId = String(message.senderId || '');
  let isMine = false;

  if (isSellerMode) {
    if (senderType === SENDER_TYPE.SHOP) {
      isMine = shopId ? senderId === String(shopId) : true;
    }
  } else if (senderType === SENDER_TYPE.USER) {
    isMine = userId ? senderId === String(userId) : true;
  }

  return {
    ...message,
    isMine,
    status: isMine ? message.status : undefined,
  };
}

export function normalizeMessages(messages = [], viewerContext = {}, options = {}) {
  const mapped = options.trustServer
    ? messages
    : messages.map((message) => applyMessageViewerContext(message, viewerContext));

  return sortMessages(dedupeMessages(mapped));
}

export function markMessagesFromServer(messages = []) {
  return messages.map((message) => ({
    ...message,
    fromServer: true,
  }));
}

function dedupeMessages(messages = []) {
  const seen = new Set();
  return messages.filter((message) => {
    const id = String(message.id);
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export function sortMessages(messages = []) {
  return [...messages].sort((left, right) => {
    const leftSeq = Number(left.thuTu) || 0;
    const rightSeq = Number(right.thuTu) || 0;

    if (leftSeq && rightSeq && leftSeq !== rightSeq) {
      return leftSeq - rightSeq;
    }

    return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
  });
}

export function buildChatListItems(messages = []) {
  const sorted = sortMessages(dedupeMessages(messages));
  const items = [];
  let lastDayKey = null;

  sorted.forEach((message) => {
    const dayKey = startOfDay(message.createdAt || Date.now());
    if (dayKey !== lastDayKey) {
      items.push({
        type: 'date',
        id: `date-${dayKey}`,
        label: formatDateSeparator(message.createdAt),
      });
      lastDayKey = dayKey;
    }

    items.push({
      type: 'message',
      id: String(message.id),
      message,
    });
  });

  return items;
}

export function mergeMessages(current, incoming) {
  return upsertMessage(current, incoming);
}

export function upsertMessage(current = [], incoming, options = {}) {
  if (!incoming?.id) {
    return sortMessages(dedupeMessages(current));
  }

  const incomingId = String(incoming.id);
  let next = [...current];

  if (options.removePending) {
    next = next.filter((item) => {
      if (!isPendingMessage(item)) {
        return String(item.id) !== incomingId;
      }

      if (options.pendingId && String(item.id) === String(options.pendingId)) {
        return false;
      }

      if (incoming.isMine) {
        return false;
      }

      return true;
    });
  }

  const existingIndex = next.findIndex((item) => String(item.id) === incomingId);
  if (existingIndex === -1) {
    next.push(incoming);
  } else {
    next[existingIndex] = { ...next[existingIndex], ...incoming };
  }

  return sortMessages(dedupeMessages(next));
}

export function removePendingMessages(current = [], pendingId) {
  return sortMessages(
    dedupeMessages(current.filter((item) => String(item.id) !== String(pendingId)))
  );
}
