const User = require("../models/User");
const Notification = require("../models/Notification");
const { USER_ROLE } = require("../constants");
const { createNotificationsBulk } = require("./notificationService");
const { NOTIFICATION_AUDIENCE, NOTIFICATION_INDEX } = require("../constants");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");

const AUDIENCE = {
  ALL: "all",
  BUYER: "buyer",
  SELLER: "seller",
};

function mapSystemAudienceToNotificationAudience(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return NOTIFICATION_AUDIENCE.BUYER;
    case AUDIENCE.SELLER:
      return NOTIFICATION_AUDIENCE.SELLER;
    case AUDIENCE.ALL:
    default:
      return NOTIFICATION_AUDIENCE.SYSTEM;
  }
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

const ShopProfile = require("../models/ShopProfile");

async function buildAudienceFilter(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return { Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] }, Status: 1 };
    case AUDIENCE.SELLER: {
      const ownerIds = await ShopProfile.distinct("userId");
      return { _id: { $in: ownerIds.filter(Boolean) }, Status: 1 };
    }
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

async function runBroadcastBulk(recipientIds, payload) {
  try {
    const inAppCount = await createNotificationsBulk(recipientIds, payload);
    console.log(
      `[admin-broadcast] inserted=${inAppCount} audience=${payload.audience} recipients=${recipientIds.length}`
    );
  } catch (error) {
    console.error("[admin-broadcast] bulk insert failed:", error?.message || error);
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

  const recipients = await User.find(await buildAudienceFilter(normalizedAudience))
    .select("_id")
    .lean();

  if (!recipients.length) {
    throw createServiceError("Không tìm thấy người dùng phù hợp để gửi thông báo.", 404);
  }

  const recipientIds = recipients.map((user) => user._id);
  const notificationAudience = mapSystemAudienceToNotificationAudience(normalizedAudience);
  const bulkPayload = {
    title: normalizedTitle,
    content: normalizedContent,
    audience: notificationAudience,
    index: NOTIFICATION_INDEX.SYSTEM,
    isAdminBroadcast: true,
  };

  // Trả response ngay — ghi DB hàng loạt nền (không socket/FCM từng user).
  setImmediate(() => {
    runBroadcastBulk(recipientIds, bulkPayload);
  });

  return {
    audience: normalizedAudience,
    audienceLabel: getAudienceLabel(normalizedAudience),
    title: normalizedTitle,
    content: normalizedContent,
    recipientCount: recipientIds.length,
    inAppCount: recipientIds.length,
    status: "queued",
    sentBy: {
      id: String(adminUser._id),
      fullName: adminUser.FullName || "",
      email: adminUser.Email || "",
    },
    sentAt: new Date(),
  };
}

/**
 * Lịch sử gửi broadcast: gộp Notification theo (title, content, audience, phút gửi).
 */
async function listBroadcastHistory({ page = 1, limit = 20, from = "", to = "" } = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));

  const pipeline = [];
  pipeline.push({ $match: { isAdminBroadcast: true } });
  const dateMatch = {};
  applyCreatedAtRange(dateMatch, { from, to });
  if (Object.keys(dateMatch).length) {
    pipeline.push({ $match: dateMatch });
  }

  pipeline.push(
    {
      $group: {
        _id: {
          title: "$title",
          content: "$content",
          audience: "$audience",
          minute: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$CreatedAt" } },
        },
        recipientCount: { $sum: 1 },
        readCount: { $sum: { $cond: [{ $eq: ["$isRead", 1] }, 1, 0] } },
        sentAt: { $max: "$CreatedAt" },
      },
    },
    { $sort: { sentAt: -1 } },
    {
      $facet: {
        items: [{ $skip: (currentPage - 1) * pageSize }, { $limit: pageSize }],
        total: [{ $count: "count" }],
      },
    }
  );

  const rows = await Notification.aggregate(pipeline);

  const items = (rows[0]?.items || []).map((row) => ({
    title: row._id.title || "",
    content: row._id.content || "",
    audience: row._id.audience || "",
    recipientCount: row.recipientCount,
    readCount: row.readCount,
    sentAt: row.sentAt || null,
  }));
  const total = rows[0]?.total?.[0]?.count || 0;

  return {
    items,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

module.exports = {
  AUDIENCE,
  sendSystemNotification,
  listBroadcastHistory,
};
