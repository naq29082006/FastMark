const Notification = require("../models/Notification.js");
const { emitUserEvent } = require("../socket");

async function createNotification(userId, { title, content } = {}) {
  if (!userId) {
    return null;
  }

  const now = new Date();
  const notification = await Notification.create({
    userId,
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    isRead: 0,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const payload = {
    id: notification._id,
    title: notification.title,
    content: notification.content,
    isRead: notification.isRead,
    createdAt: notification.CreatedAt,
  };

  emitUserEvent(String(userId), "notification:new", payload);

  return payload;
}

function toClientNotification(notification) {
  return {
    id: String(notification._id),
    title: notification.title || "",
    content: notification.content || "",
    body: notification.content || "",
    isRead: Number(notification.isRead) === 1,
    createdAt: notification.CreatedAt || null,
  };
}

async function listNotificationsForUser(userId, { page = 1, limit = 50 } = {}) {
  if (!userId) {
    return { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } };
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (currentPage - 1) * pageSize;

  const [items, total] = await Promise.all([
    Notification.find({ userId })
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments({ userId }),
  ]);

  return {
    items: items.map(toClientNotification),
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

module.exports = {
  createNotification,
  listNotificationsForUser,
};
