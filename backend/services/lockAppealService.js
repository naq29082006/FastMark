const Report = require("../models/Report");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const { REPORT_TYPE, REPORT_STATUS } = require("../constants");

const SHOP_LOCK_APPEAL_TITLE_PATTERN =
  /khóa gian hàng|khiếu nại.*gian hàng|yêu cầu xem xét lại.*gian/i;

function pickString(value) {
  return String(value || "").trim();
}

function isLegacyShopLockAppealReport(report) {
  const type = Number(report?.reportType);
  return (
    (type === REPORT_TYPE.OTHER || type === 9) &&
    Boolean(report?.shopId) &&
    SHOP_LOCK_APPEAL_TITLE_PATTERN.test(pickString(report?.title))
  );
}

function isShopLockAppealReport(report) {
  if (Number(report?.reportType) === REPORT_TYPE.SHOP_LOCK_APPEAL) {
    return true;
  }
  return isLegacyShopLockAppealReport(report);
}

function accountLockAppealBaseFilter(userId) {
  return {
    userId,
    reportType: REPORT_TYPE.ACCOUNT_LOCK_APPEAL,
  };
}

function shopLockAppealBaseFilter(userId, shopId) {
  return {
    userId,
    shopId,
    $or: [
      { reportType: REPORT_TYPE.SHOP_LOCK_APPEAL },
      { reportType: 11 },
      {
        reportType: REPORT_TYPE.OTHER,
        title: { $regex: SHOP_LOCK_APPEAL_TITLE_PATTERN },
      },
      {
        reportType: 9,
        title: { $regex: SHOP_LOCK_APPEAL_TITLE_PATTERN },
      },
    ],
  };
}

function withLockSessionFilter(filter, lockedAt) {
  if (!lockedAt) {
    return filter;
  }
  return {
    ...filter,
    CreatedAt: { $gte: lockedAt },
  };
}

async function findLatestAccountLockAppeal(userId, lockedAt) {
  return Report.findOne(withLockSessionFilter(accountLockAppealBaseFilter(userId), lockedAt))
    .sort({ CreatedAt: -1 })
    .lean();
}

async function findLatestShopLockAppeal(userId, shopId, lockedAt) {
  return Report.findOne(
    withLockSessionFilter(shopLockAppealBaseFilter(userId, shopId), lockedAt)
  )
    .sort({ CreatedAt: -1 })
    .lean();
}

/**
 * Gán lockedAt cho nick đang khóa nhưng chưa có mốc lượt khóa (dữ liệu cũ).
 */
async function ensureUserLockedAt(user) {
  if (!user?._id || user.lockedAt) {
    return user?.lockedAt || null;
  }

  const latestPending = await Report.findOne({
    ...accountLockAppealBaseFilter(user._id),
    status: REPORT_STATUS.PENDING,
  })
    .sort({ CreatedAt: -1 })
    .lean();

  const lockedAt = latestPending?.CreatedAt || new Date();
  await User.updateOne({ _id: user._id }, { $set: { lockedAt } });
  user.lockedAt = lockedAt;
  return lockedAt;
}

async function ensureShopLockedAt(shop) {
  if (!shop?._id || shop.lockedAt) {
    return shop?.lockedAt || null;
  }

  const latestPending = await Report.findOne({
    ...shopLockAppealBaseFilter(shop.userId, shop._id),
    status: REPORT_STATUS.PENDING,
  })
    .sort({ CreatedAt: -1 })
    .lean();

  const lockedAt = latestPending?.CreatedAt || new Date();
  await ShopProfile.updateOne({ _id: shop._id }, { $set: { lockedAt } });
  shop.lockedAt = lockedAt;
  return lockedAt;
}

async function closePendingAccountLockAppeals(
  userId,
  adminUserId = null,
  {
    adminDecision = "unblock-account",
    adminNote = "Khiếu nại đã kết thúc do tài khoản được mở khóa.",
  } = {}
) {
  const now = new Date();
  await Report.updateMany(
    {
      ...accountLockAppealBaseFilter(userId),
      status: REPORT_STATUS.PENDING,
    },
    {
      $set: {
        status: REPORT_STATUS.PROCESSED,
        processedBy: adminUserId || null,
        processedAt: now,
        adminDecision,
        adminNote,
        UpdatedAt: now,
      },
    }
  );
}

async function closePendingShopLockAppeals(
  shopId,
  adminUserId = null,
  {
    adminDecision = "unblock-shop",
    adminNote = "Khiếu nại đã kết thúc do gian hàng được mở khóa.",
  } = {}
) {
  const now = new Date();
  await Report.updateMany(
    {
      shopId,
      status: REPORT_STATUS.PENDING,
      $or: [
        { reportType: REPORT_TYPE.SHOP_LOCK_APPEAL },
        { reportType: 11 },
        {
          reportType: REPORT_TYPE.OTHER,
          title: { $regex: SHOP_LOCK_APPEAL_TITLE_PATTERN },
        },
        {
          reportType: 9,
          title: { $regex: SHOP_LOCK_APPEAL_TITLE_PATTERN },
        },
      ],
    },
    {
      $set: {
        status: REPORT_STATUS.PROCESSED,
        processedBy: adminUserId || null,
        processedAt: now,
        adminDecision,
        adminNote,
        UpdatedAt: now,
      },
    }
  );
}

module.exports = {
  SHOP_LOCK_APPEAL_TITLE_PATTERN,
  isLegacyShopLockAppealReport,
  isShopLockAppealReport,
  findLatestAccountLockAppeal,
  findLatestShopLockAppeal,
  ensureUserLockedAt,
  ensureShopLockedAt,
  closePendingAccountLockAppeals,
  closePendingShopLockAppeals,
};
