/**
 * Thứ tự danh sách đơn — mới nhất lên đầu (theo tab).
 */

function pickTime(value) {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function reservationSortTimestamp(doc, tab) {
  const normalized = String(tab || "").trim().toLowerCase();
  if (normalized === "completed") {
    return pickTime(doc?.tgNhanHang || doc?.completedAt || doc?.updatedAt || doc?.createdAt);
  }
  if (normalized === "cancelled") {
    return pickTime(doc?.cancelledAt || doc?.updatedAt || doc?.createdAt);
  }
  if (normalized === "holding") {
    return pickTime(doc?.tgShopXN || doc?.updatedAt || doc?.createdAt);
  }
  if (
    normalized === "dispute" ||
    normalized === "dispute_admin" ||
    normalized === "dispute_admin_history" ||
    normalized === "dispute_history_admin" ||
    normalized === "dispute_both" ||
    normalized === "dispute_active" ||
    normalized === "dispute_history"
  ) {
    if (normalized === "dispute_history" || normalized === "dispute_admin_history" || normalized === "dispute_history_admin") {
      return pickTime(doc?.tgGiaiCoc || doc?.updatedAt || doc?.disputedAt || doc?.createdAt);
    }
    return pickTime(doc?.updatedAt || doc?.disputedAt || doc?.createdAt);
  }
  if (normalized === "pending") {
    return pickTime(doc?.createdAt || doc?.updatedAt);
  }
  return pickTime(doc?.updatedAt || doc?.createdAt);
}

function compareReservationsNewestFirst(left, right, tab) {
  const diff = reservationSortTimestamp(right, tab) - reservationSortTimestamp(left, tab);
  if (diff !== 0) {
    return diff;
  }
  const idLeft = String(left?.id || left?._id || "");
  const idRight = String(right?.id || right?._id || "");
  return idRight.localeCompare(idLeft);
}

function reservationListSortForTab(tab) {
  const normalized = String(tab || "").trim().toLowerCase();
  if (normalized === "completed") {
    return { tgNhanHang: -1, updatedAt: -1, _id: -1 };
  }
  if (normalized === "cancelled") {
    return { cancelledAt: -1, updatedAt: -1, _id: -1 };
  }
  if (normalized === "holding") {
    return { tgShopXN: -1, updatedAt: -1, createdAt: -1, _id: -1 };
  }
  if (
    normalized === "dispute" ||
    normalized === "dispute_admin" ||
    normalized === "dispute_admin_history" ||
    normalized === "dispute_history_admin" ||
    normalized === "dispute_both" ||
    normalized === "dispute_active" ||
    normalized === "dispute_history"
  ) {
    if (normalized === "dispute_history" || normalized === "dispute_admin_history" || normalized === "dispute_history_admin") {
      return { tgGiaiCoc: -1, updatedAt: -1, _id: -1 };
    }
    return { updatedAt: -1, createdAt: -1, _id: -1 };
  }
  if (normalized === "pending") {
    return { createdAt: -1, _id: -1 };
  }
  return { updatedAt: -1, createdAt: -1, _id: -1 };
}

module.exports = {
  reservationListSortForTab,
  reservationSortTimestamp,
  compareReservationsNewestFirst,
};
