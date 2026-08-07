/**
 * Thứ tự danh sách đơn — mới nhất lên đầu (theo tab).
 */
function reservationListSortForTab(tab) {
  const normalized = String(tab || "").trim().toLowerCase();
  if (normalized === "completed") {
    return { completedAt: -1, UpdatedAt: -1, _id: -1 };
  }
  if (normalized === "cancelled") {
    return { cancelledAt: -1, UpdatedAt: -1, _id: -1 };
  }
  return { UpdatedAt: -1, _id: -1 };
}

module.exports = {
  reservationListSortForTab,
};
