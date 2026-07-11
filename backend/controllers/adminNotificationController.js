const adminNotificationService = require("../services/adminNotificationService");
const { success } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

exports.sendSystemNotification = async (req, res) => {
  const result = await adminNotificationService.sendSystemNotification(req.currentUser, {
    title: pickBodyValue(req.body, ["title"]),
    content: pickBodyValue(req.body, ["content"]),
    audience: pickBodyValue(req.body, ["audience", "targetAudience"]) || "all",
  });

  return success(res, {
    message: "Đã gửi thông báo hệ thống thành công.",
    data: result,
  });
};
