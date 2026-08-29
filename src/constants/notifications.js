/** 1 = đơn hàng, 2 = hệ thống */
export const NOTIFICATION_INDEX = {
  ORDER: 1,
  SYSTEM: 2,
};

export const NOTIFICATION_TAB = {
  ALL: 'all',
  ORDER: 'order',
  SYSTEM: 'system',
};

export const NOTIFICATION_TABS = [
  { key: NOTIFICATION_TAB.ALL, label: 'Tất cả' },
  { key: NOTIFICATION_TAB.ORDER, label: 'Đơn hàng', index: NOTIFICATION_INDEX.ORDER },
  { key: NOTIFICATION_TAB.SYSTEM, label: 'Hệ thống', index: NOTIFICATION_INDEX.SYSTEM },
];

const ORDER_HINT_PATTERNS = [
  /đơn giữ/i,
  /giữ hàng/i,
  /nhận hàng/i,
  /giao hàng/i,
  /shop đã/i,
  /shop từ/i,
  /shop báo/i,
  /khách đã/i,
  /yêu cầu giữ/i,
  /cọc/i,
  /tranh chấp/i,
  /báo cáo.*shop/i,
  /sắp đến giờ/i,
  /quá hạn nhận/i,
  /hoàn cọc/i,
  /nhận cọc/i,
];

/** Phân loại tab — ưu tiên index từ server, suy luận title cho dữ liệu cũ. */
export function resolveNotificationIndex(item) {
  const parsed = Number(item?.index);
  if (parsed === NOTIFICATION_INDEX.ORDER) {
    return NOTIFICATION_INDEX.ORDER;
  }
  if (parsed === NOTIFICATION_INDEX.SYSTEM && item?.tbAdmin) {
    return NOTIFICATION_INDEX.SYSTEM;
  }

  const text = `${item?.title || ''} ${item?.content || ''} ${item?.body || ''}`;
  if (ORDER_HINT_PATTERNS.some((pattern) => pattern.test(text))) {
    return NOTIFICATION_INDEX.ORDER;
  }

  if (parsed === NOTIFICATION_INDEX.SYSTEM) {
    return NOTIFICATION_INDEX.SYSTEM;
  }

  return NOTIFICATION_INDEX.SYSTEM;
}

export function filterNotificationsByTab(items, tabKey) {
  const list = Array.isArray(items) ? items : [];
  if (tabKey === NOTIFICATION_TAB.ALL) {
    return list;
  }
  const tab = NOTIFICATION_TABS.find((entry) => entry.key === tabKey);
  if (!tab?.index) {
    return list;
  }
  return list.filter((item) => resolveNotificationIndex(item) === tab.index);
}

export function notificationMatchesTab(item, tabKey) {
  if (tabKey === NOTIFICATION_TAB.ALL) {
    return true;
  }
  const tab = NOTIFICATION_TABS.find((entry) => entry.key === tabKey);
  if (!tab?.index) {
    return true;
  }
  return resolveNotificationIndex(item) === tab.index;
}
