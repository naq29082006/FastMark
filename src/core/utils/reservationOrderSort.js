function pickTime(value) {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Timestamp để xếp mới nhất lên đầu theo tab đơn hàng. */
export function getReservationSortTime(item, tab) {
  const normalized = String(tab || '').trim().toLowerCase();
  if (normalized === 'completed') {
    return pickTime(item?.tgNhanHang || item?.completedAt || item?.updatedAt || item?.createdAt);
  }
  if (normalized === 'cancelled') {
    return pickTime(item?.cancelledAt || item?.updatedAt || item?.createdAt);
  }
  if (normalized === 'holding') {
    return pickTime(item?.tgShopXN || item?.updatedAt || item?.createdAt);
  }
  if (normalized === 'dispute') {
    return pickTime(item?.updatedAt || item?.disputedAt || item?.createdAt);
  }
  if (normalized === 'pending') {
    return pickTime(item?.createdAt || item?.updatedAt);
  }
  return pickTime(item?.updatedAt || item?.createdAt);
}

export function sortReservationsNewestFirst(items = [], tab) {
  return [...items].sort((left, right) => {
    const diff = getReservationSortTime(right, tab) - getReservationSortTime(left, tab);
    if (diff !== 0) {
      return diff;
    }
    return String(right?.id || '').localeCompare(String(left?.id || ''));
  });
}
