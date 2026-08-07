const {
  listNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  countUnreadNotifications,
  NOTIFICATION_AUDIENCE,
} = require("../services/notificationService");
const {
  registerDeviceToken,
  removeDeviceToken,
} = require("../services/pushDeviceTokenService");
const { normalizeNotificationAudience } = require("../constants");
const { success } = require("../utils/apiResponse");

function resolveAudience(req) {
  return normalizeNotificationAudience(
    req.query.audience ?? req.body?.audience,
    NOTIFICATION_AUDIENCE.BUYER
  );
}

exports.listMyNotifications = async (req, res) => {
  const audience = resolveAudience(req);
  const tab = String(req.query.tab || "all").trim().toLowerCase();
  const data = await listNotificationsForUser(req.currentUser._id, {
    page: req.query.page,
    limit: req.query.limit,
    audience,
    tab,
  });

  return success(res, { data });
};

exports.getUnreadCount = async (req, res) => {
  const audience = resolveAudience(req);
  const unreadCount = await countUnreadNotifications(req.currentUser._id, audience);
  return success(res, { data: { audience, unreadCount } });
};

exports.markAsRead = async (req, res) => {
  const audience = resolveAudience(req);
  const notification = await markNotificationAsRead(req.currentUser._id, req.params.id, {
    audience,
  });
  return success(res, {
    message: "Đã đánh dấu đã đọc.",
    data: { notification },
  });
};

exports.markAllAsRead = async (req, res) => {
  const audience = resolveAudience(req);
  const result = await markAllNotificationsAsRead(req.currentUser._id, { audience });
  return success(res, {
    message: "Đã đánh dấu tất cả thông báo là đã đọc.",
    data: result,
  });
};

exports.registerDeviceToken = async (req, res) => {
  const token = req.body?.token || req.body?.deviceToken || req.body?.fcmToken;
  const platform = req.body?.platform;

  const data = await registerDeviceToken(req.currentUser._id, { token, platform });
  return success(res, {
    message: "Đã lưu device token.",
    data,
  });
};

exports.removeDeviceToken = async (req, res) => {
  const token = req.body?.token || req.body?.deviceToken || req.body?.fcmToken;
  const result = await removeDeviceToken(req.currentUser._id, token);
  return success(res, {
    message: "Đã xóa device token.",
    data: result,
  });
};
