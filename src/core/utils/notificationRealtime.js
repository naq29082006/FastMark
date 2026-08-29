import { resolveNotificationIndex } from '../../constants/notifications';

export function normalizeSocketNotification(payload) {
  if (!payload) {
    return null;
  }

  const id = String(payload.id || payload._id || '').trim();
  if (!id) {
    return null;
  }

  return {
    id,
    title: String(payload.title || '').trim(),
    content: String(payload.content || payload.body || '').trim(),
    body: String(payload.content || payload.body || '').trim(),
    audience: String(payload.audience || 'system').trim().toLowerCase() || 'system',
    index: resolveNotificationIndex(payload),
    tbAdmin: Boolean(payload.tbAdmin),
    isRead: Number(payload.isRead) === 1 || payload.isRead === true,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

export function notificationMatchesAudience(notification, screenAudience = 'buyer') {
  const audience = String(notification?.audience || '').trim().toLowerCase();
  const screen = String(screenAudience || 'buyer').trim().toLowerCase();

  if (screen === 'seller') {
    return audience === 'seller' || audience === 'system' || !audience;
  }

  if (screen === 'buyer') {
    return audience === 'buyer' || audience === 'system';
  }

  return audience === screen || audience === 'system';
}

/**
 * Lấy số chưa đọc đúng phạm vi (buyer/seller) từ event "notification:read".
 * Trả về null khi payload không mang số cho phạm vi đang xem.
 */
export function resolveUnreadCountFromReadEvent(payload, screenAudience = 'buyer') {
  const screen = String(screenAudience || 'buyer').trim().toLowerCase();
  const scopedCount = Number(payload?.unreadCounts?.[screen]);
  if (Number.isFinite(scopedCount)) {
    return Math.max(0, scopedCount);
  }

  // Backend cũ chỉ gửi 1 con số: chỉ dùng khi audience của event trùng phạm vi.
  const eventAudience = String(payload?.audience || '').trim().toLowerCase();
  const legacyCount = Number(payload?.unreadCount);
  if (eventAudience === screen && Number.isFinite(legacyCount)) {
    return Math.max(0, legacyCount);
  }

  return null;
}

export function prependUniqueNotification(currentItems, incomingItem) {
  if (!incomingItem?.id) {
    return currentItems;
  }

  const nextId = String(incomingItem.id);
  const filtered = (currentItems || []).filter((item) => String(item.id) !== nextId);
  return [incomingItem, ...filtered];
}
