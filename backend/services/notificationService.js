const Notification = require("../models/Notification.js");
const {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
  normalizeNotificationAudience,
  normalizeNotificationIndex,
} = require("../constants");
// Lấy hàm khi gọi (không destructure lúc require) vì socket ↔ service là circular
// dependency: destructure sớm có thể nhận undefined và mất event realtime.
const socketBus = require("../socket");
const { sendPushToUser } = require("./pushNotificationService");

function buildAudienceListFilter(audience) {
  const normalized = normalizeNotificationAudience(audience, NOTIFICATION_AUDIENCE.BUYER);

  if (normalized === NOTIFICATION_AUDIENCE.SELLER) {
    return {
      $or: [
        { audience: NOTIFICATION_AUDIENCE.SELLER },
        { audience: NOTIFICATION_AUDIENCE.SYSTEM },
        // Thông báo cũ chưa gắn audience: chỉ hiện ở seller để khỏi lẫn sang buyer.
        { audience: { $exists: false } },
        { audience: null },
        { audience: "" },
      ],
    };
  }

  if (normalized === NOTIFICATION_AUDIENCE.SYSTEM) {
    return {
      $or: [
        { audience: NOTIFICATION_AUDIENCE.SYSTEM },
        { audience: { $exists: false } },
        { audience: null },
        { audience: "" },
      ],
    };
  }

  // buyer: không lấy thông báo seller / legacy chưa gắn (tránh lẫn shop → buyer)
  return {
    audience: { $in: [NOTIFICATION_AUDIENCE.BUYER, NOTIFICATION_AUDIENCE.SYSTEM] },
  };
}

/** tab: all | order | system — lọc theo index thông báo (1 đơn hàng, 2 hệ thống). */
function buildTabListFilter(tab) {
  const key = String(tab || "all")
    .trim()
    .toLowerCase();
  if (key === "order") {
    return { index: NOTIFICATION_INDEX.ORDER };
  }
  if (key === "system") {
    return { index: NOTIFICATION_INDEX.SYSTEM };
  }
  return {};
}

async function createNotificationsBulk(
  userIds,
  { title, content, audience, index, tbAdmin = false } = {}
) {
  const ids = (Array.isArray(userIds) ? userIds : []).filter(Boolean);
  if (!ids.length) {
    return 0;
  }

  const normalizedTitle = String(title || "").trim();
  const normalizedContent = String(content || "").trim();
  if (!normalizedTitle || !normalizedContent) {
    return 0;
  }

  const normalizedAudience = normalizeNotificationAudience(
    audience,
    NOTIFICATION_AUDIENCE.SYSTEM
  );
  const normalizedIndex = normalizeNotificationIndex(index, NOTIFICATION_INDEX.SYSTEM);
  const now = new Date();
  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
    const slice = ids.slice(offset, offset + CHUNK_SIZE);
    const docs = slice.map((userId) => ({
      userId,
      title: normalizedTitle,
      content: normalizedContent,
      audience: normalizedAudience,
      index: normalizedIndex,
      tbAdmin: Boolean(tbAdmin),
      isRead: 0,
      CreatedAt: now,
      UpdatedAt: now,
    }));
    const created = await Notification.insertMany(docs, { ordered: false });
    inserted += created.length;
  }

  return inserted;
}

async function createNotification(userId, { title, content, audience, index, tbAdmin } = {}) {
  const normalizedUserId = userId;
  if (!normalizedUserId) {
    return null;
  }

  const normalizedAudience = normalizeNotificationAudience(
    audience,
    NOTIFICATION_AUDIENCE.SYSTEM
  );
  const normalizedIndex = normalizeNotificationIndex(
    index,
    NOTIFICATION_INDEX.SYSTEM
  );
  const now = new Date();
  const notification = await Notification.create({
    userId: normalizedUserId,
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    audience: normalizedAudience,
    index: normalizedIndex,
    tbAdmin: Boolean(tbAdmin),
    isRead: 0,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const payload = {
    id: notification._id,
    title: notification.title,
    content: notification.content,
    audience: notification.audience,
    index: notification.index,
    tbAdmin: Boolean(notification.tbAdmin),
    isRead: notification.isRead,
    createdAt: notification.CreatedAt,
  };

  socketBus.emitUserEvent(String(userId), "notification:new", payload);
  socketBus.emitUserEvent(String(userId), "notification_created", payload);

  sendPushToUser(normalizedUserId, {
    title: notification.title,
    content: notification.content,
    data: {
      notificationId: String(notification._id),
      audience: notification.audience,
      type: "in_app_notification",
    },
  }).catch((error) => {
    console.warn("[FCM] createNotification push failed:", error?.message || error);
  });

  return payload;
}

function toClientNotification(notification) {
  return {
    id: String(notification._id),
    title: notification.title || "",
    content: notification.content || "",
    body: notification.content || "",
    audience: notification.audience || NOTIFICATION_AUDIENCE.SYSTEM,
    index: normalizeNotificationIndex(notification.index, NOTIFICATION_INDEX.SYSTEM),
    tbAdmin: Boolean(notification.tbAdmin),
    isRead: Number(notification.isRead) === 1,
    createdAt: notification.CreatedAt || null,
  };
}

async function listNotificationsForUser(userId, { page = 1, limit = 20, audience, tab = "all" } = {}) {
  if (!userId) {
    return {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      hasMore: false,
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
    };
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;
  const filter = {
    userId,
    ...buildAudienceListFilter(audience),
    ...buildTabListFilter(tab),
  };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ CreatedAt: -1, _id: -1 }).skip(skip).limit(pageSize).lean(),
    Notification.countDocuments(filter),
    // Đếm trên toàn bộ phạm vi audience, không phụ thuộc trang đang tải.
    Notification.countDocuments({ ...filter, isRead: { $ne: 1 } }),
  ]);

  const pagination = {
    page: currentPage,
    limit: pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: currentPage * pageSize < total,
  };

  return {
    items: items.map(toClientNotification),
    unreadCount,
    ...pagination,
    pagination,
  };
}

async function countUnreadNotifications(userId, audience) {
  if (!userId) {
    return 0;
  }

  return Notification.countDocuments({
    userId,
    isRead: { $ne: 1 },
    ...buildAudienceListFilter(audience || NOTIFICATION_AUDIENCE.BUYER),
  });
}

async function emitNotificationReadEvent(userId, { id, audience, all = false } = {}) {
  if (!userId) {
    return;
  }

  const normalizedAudience = normalizeNotificationAudience(
    audience,
    NOTIFICATION_AUDIENCE.BUYER
  );

  // Thông báo audience "system" nằm trong cả phạm vi buyer và seller, nên phải gửi
  // kèm số chưa đọc của từng phạm vi để mỗi badge lấy đúng con số của mình.
  const [buyerUnread, sellerUnread] = await Promise.all([
    countUnreadNotifications(userId, NOTIFICATION_AUDIENCE.BUYER),
    countUnreadNotifications(userId, NOTIFICATION_AUDIENCE.SELLER),
  ]);

  socketBus.emitUserEvent(String(userId), "notification:read", {
    id: id ? String(id) : "",
    unreadCount:
      normalizedAudience === NOTIFICATION_AUDIENCE.SELLER ? sellerUnread : buyerUnread,
    unreadCounts: { buyer: buyerUnread, seller: sellerUnread },
    audience: normalizedAudience,
    all: Boolean(all),
  });
}

async function markNotificationAsRead(userId, notificationId, { audience } = {}) {
  if (!userId || !notificationId) {
    const error = new Error("Thiếu thông báo.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const filter = {
    _id: notificationId,
    userId,
    ...buildAudienceListFilter(audience || NOTIFICATION_AUDIENCE.BUYER),
  };

  const notification = await Notification.findOneAndUpdate(
    filter,
    { $set: { isRead: 1, UpdatedAt: now } },
    { returnDocument: "after" }
  );

  if (!notification) {
    const error = new Error("Không tìm thấy thông báo.");
    error.statusCode = 404;
    throw error;
  }

  await emitNotificationReadEvent(userId, {
    id: notification._id,
    audience,
  });

  return toClientNotification(notification);
}

async function markAllNotificationsAsRead(userId, { audience } = {}) {
  if (!userId) {
    return { updated: 0 };
  }

  const now = new Date();
  const result = await Notification.updateMany(
    {
      userId,
      isRead: { $ne: 1 },
      ...buildAudienceListFilter(audience || NOTIFICATION_AUDIENCE.BUYER),
    },
    { $set: { isRead: 1, UpdatedAt: now } }
  );

  await emitNotificationReadEvent(userId, {
    audience: audience || NOTIFICATION_AUDIENCE.BUYER,
    all: true,
  });

  return { updated: result.modifiedCount || 0 };
}

module.exports = {
  createNotification,
  createNotificationsBulk,
  listNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  countUnreadNotifications,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
};
