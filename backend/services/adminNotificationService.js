const User = require("../models/User");
const { USER_ROLE } = require("../constants/sellerVerification");
const { createNotification } = require("./notificationService");
const { sendPushToTokens } = require("./pushNotificationService");

const AUDIENCE = {
  ALL: "all",
  BUYER: "buyer",
  SELLER: "seller",
};

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function buildAudienceFilter(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return { Role: USER_ROLE.BUYER, Status: 1 };
    case AUDIENCE.SELLER:
      return { Role: USER_ROLE.SELLER, Status: 1 };
    case AUDIENCE.ALL:
    default:
      return { Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] }, Status: 1 };
  }
}

function getAudienceLabel(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return "Người mua";
    case AUDIENCE.SELLER:
      return "Người bán";
    case AUDIENCE.ALL:
    default:
      return "Tất cả";
  }
}

async function sendSystemNotification(adminUser, { title, content, audience = AUDIENCE.ALL } = {}) {
  const normalizedTitle = pickString(title);
  const normalizedContent = pickString(content);
  const normalizedAudience = pickString(audience) || AUDIENCE.ALL;

  if (!normalizedTitle) {
    throw createServiceError("Tiêu đề thông báo không được để trống.");
  }

  if (!normalizedContent) {
    throw createServiceError("Nội dung thông báo không được để trống.");
  }

  if (!Object.values(AUDIENCE).includes(normalizedAudience)) {
    throw createServiceError("Đối tượng nhận thông báo không hợp lệ.");
  }

  const recipients = await User.find(buildAudienceFilter(normalizedAudience))
    .select("_id FcmToken")
    .lean();

  if (!recipients.length) {
    throw createServiceError("Không tìm thấy người dùng phù hợp để gửi thông báo.", 404);
  }

  let inAppCount = 0;
  await Promise.all(
    recipients.map(async (user) => {
      const created = await createNotification(user._id, {
        title: normalizedTitle,
        content: normalizedContent,
      });
      if (created) {
        inAppCount += 1;
      }
    })
  );

  const fcmTokens = recipients.map((user) => user.FcmToken).filter(Boolean);
  const fcmResult = await sendPushToTokens(fcmTokens, {
    title: normalizedTitle,
    content: normalizedContent,
  });

  return {
    audience: normalizedAudience,
    audienceLabel: getAudienceLabel(normalizedAudience),
    title: normalizedTitle,
    content: normalizedContent,
    recipientCount: recipients.length,
    inAppCount,
    fcmSent: fcmResult.sent,
    fcmFailed: fcmResult.failed,
    sentBy: {
      id: String(adminUser._id),
      fullName: adminUser.FullName || "",
      email: adminUser.Email || "",
    },
    sentAt: new Date(),
  };
}

module.exports = {
  AUDIENCE,
  sendSystemNotification,
};
