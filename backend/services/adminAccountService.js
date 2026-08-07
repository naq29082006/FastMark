const mongoose = require("mongoose");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const SellerVerification = require("../models/SellerVerification");
const Product = require("../models/Product");
const Reservation = require("../models/Reservation");
const Report = require("../models/Report");
const Review = require("../models/Review");
const { USER_ROLE, SELLER_VERIFICATION_STATUS, RESERVATION_STATUS } = require("../constants");
const { notDeletedReviewFilter } = require("../utils/reviewVisibility");
const { USER_STATUS } = require("../constants");
const { SHOP_STATUS } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const { buildSearchRegex } = require("../utils/searchText");
const {
  buildObjectIdSearchConditions,
  appendStatusLabelSearchConditions,
  appendUniqueOrConditions,
  buildStatusLabelEntries,
  resolveStatusesFromLabelSearch,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");
const { buildReportsReceivedFilter } = require("../utils/reportType");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");

const CANCELLED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.REFUNDED,
  RESERVATION_STATUS.CANCELLED,
];

const COMPLETED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.AUTO_COMPLETED,
];

const DISPUTE_RESERVATION_STATUSES = [
  RESERVATION_STATUS.DISPUTED,
  RESERVATION_STATUS.CANCELLED,
];
const { cancelActiveReservationsForAccountLock } = require("./reservationService");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const { notRemovedProductMatch } = require("../utils/productRemoval");

const ROLE_LABELS = {
  [USER_ROLE.BUYER]: "Người mua",
  [USER_ROLE.SELLER]: "Người bán",
  [USER_ROLE.ADMIN]: "Quản trị viên",
};

const STATUS_LABELS = {
  [USER_STATUS.ACTIVE]: "Hoạt động",
  [USER_STATUS.BLOCKED]: "Đã khóa",
};

const VERIFICATION_LABELS = {
  [SELLER_VERIFICATION_STATUS.PENDING]: "Chờ duyệt",
  [SELLER_VERIFICATION_STATUS.APPROVED]: "Đã duyệt",
  [SELLER_VERIFICATION_STATUS.REJECTED]: "Đã từ chối",
};

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickString(value) {
  return String(value || "").trim();
}

function activeProductFilter(extra = {}) {
  return {
    ...extra,
    ...notRemovedProductMatch(),
    $or: [
      { Status: PRODUCT_STATUS.ACTIVE },
      { Status: { $exists: false } },
    ],
  };
}

function toAdminUserBase(user, shop = null) {
  return {
    id: String(user._id),
    userId: String(user._id),
    avatar: user.Avatar || "",
    userName: user.UserName || "",
    fullName: user.FullName || "",
    email: user.Email || "",
    phone: user.Phone || "",
    role: user.Role,
    roleLabel:
      user.Role === USER_ROLE.ADMIN
        ? ROLE_LABELS[USER_ROLE.ADMIN]
        : shop
          ? "Người mua · Có gian hàng"
          : "Người mua",
    status: user.Status,
    statusLabel: STATUS_LABELS[user.Status] || "Không rõ",
    bio: "",
    createdAt: user.CreatedAt || null,
    updatedAt: user.UpdatedAt || null,
    lastActiveAt: user.LanHoatDongCuoi || null,
    followingCount: user.FollowingCount || 0,
    verifyAccount: Boolean(user.VerifyAccount),
    sellerPhoneVerified: require("../models/User").isPhoneVerified(user),
  };
}

function toAdminShopSummary(shop, owner = null) {
  if (!shop) {
    return null;
  }

  return {
    id: String(shop._id),
    shopName: resolveShopDisplayName(shop, owner),
    shopUsername: resolveShopUsername(shop, owner),
    avatar: resolveShopAvatar(shop, owner),
    status: shop.status,
    statusLabel: shop.status === SHOP_STATUS.ACTIVE ? "Hoạt động" : "Đã khóa",
    averageRating: Number(shop.averageRating) || 0,
    totalProducts: Number(shop.totalProducts) || 0,
    totalReviews: Number(shop.totalReviews) || 0,
    followersCount: Number(shop.followersCount) || 0,
    soldCount: Number(shop.soldCount) || 0,
    address: shop.addressHeThong || shop.address || "",
    phone: owner?.Phone || shop.phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    description: shop.description || "",
  };
}

function toAdminVerificationSummary(verification) {
  if (!verification) {
    return null;
  }

  return {
    id: String(verification._id),
    status: verification.status,
    statusLabel: VERIFICATION_LABELS[verification.status] || "Không rõ",
    shopName: verification.shopName || "",
    shopUsername: verification.shopUsername || "",
    cccdFrontImage: verification.cccdFrontImage || "",
    cccdBackImage: verification.cccdBackImage || "",
    selfieImage: verification.selfieImage || "",
    businessImage:
      verification.businessImage ||
      verification.businessDocImage ||
      verification.businessDoc?.imageUrl ||
      "",
    address:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    systemAddress:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    submittedAt: verification.submittedAt || verification.CreatedAt || null,
    approvedAt:
      Number(verification.status) === SELLER_VERIFICATION_STATUS.APPROVED
        ? verification.approvedAt || verification.UpdatedAt || null
        : null,
    rejectedAt:
      Number(verification.status) === SELLER_VERIFICATION_STATUS.REJECTED
        ? verification.rejectedAt || verification.UpdatedAt || null
        : null,
    rejectionReason: verification.LyDoTuChoi || "",
  };
}

function toAdminAccountListItem(user, shop, verification) {
  const base = toAdminUserBase(user, shop);
  const shopSummary = toAdminShopSummary(shop, user);
  const verificationSummary = toAdminVerificationSummary(verification);

  return {
    ...base,
    shop: shopSummary,
    verification: verificationSummary,
    productCount: shopSummary?.totalProducts || 0,
    averageRating: shopSummary?.averageRating || 0,
  };
}

function sortAccountItems(items, sortKey) {
  const sorted = [...items];

  switch (sortKey) {
    case "oldest":
      sorted.sort(
        (left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
      );
      break;
    case "last_active":
      sorted.sort((left, right) => {
        const rightTime = new Date(right.lastActiveAt || 0).getTime();
        const leftTime = new Date(left.lastActiveAt || 0).getTime();
        return rightTime - leftTime;
      });
      break;
    case "most_products":
      sorted.sort((left, right) => {
        const diff = (right.productCount || 0) - (left.productCount || 0);
        if (diff !== 0) {
          return diff;
        }
        return (left.fullName || "").localeCompare(right.fullName || "", "vi");
      });
      break;
    case "newest":
    default:
      sorted.sort(
        (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
      );
      break;
  }

  return sorted;
}

async function buildUserMatchFilter({ search, role, status, verificationStatus, hasShop }) {
  const andConditions = [];
  const normalizedRole = pickString(role);
  const normalizedHasShop = pickString(hasShop);
  const normalizedStatus = pickString(status);
  const normalizedVerificationStatus = pickString(verificationStatus);
  const keyword = pickString(search);

  andConditions.push({ Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] } });

  if (normalizedHasShop === "1" || normalizedRole === "2") {
    const shopUserIds = await ShopProfile.distinct("userId");
    andConditions.push({ _id: { $in: shopUserIds.filter(Boolean) } });
  } else if (normalizedHasShop === "0") {
    const shopUserIds = await ShopProfile.distinct("userId");
    andConditions.push({ _id: { $nin: shopUserIds.filter(Boolean) } });
  }

  if (normalizedStatus !== "") {
    andConditions.push({ Status: Number(normalizedStatus) });
  }

  if (keyword) {
    const regex = buildSearchRegex(keyword);
    const searchOr = [];

    if (regex) {
      const shopMatches = await ShopProfile.find({
        $or: [{ shopName: regex }, { shopUsername: regex }],
      })
        .select("userId")
        .lean();

      const shopUserIds = shopMatches.map((shop) => shop.userId).filter(Boolean);
      searchOr.push(
        { UserName: regex },
        { FullName: regex },
        { Email: regex },
        { Phone: regex }
      );

      if (shopUserIds.length > 0) {
        searchOr.push({ _id: { $in: shopUserIds } });
      }
    }

    appendStatusLabelSearchConditions(searchOr, keyword, STATUS_LABELS, [], "Status");
    const matchedRoles = resolveStatusesFromLabelSearch(keyword, buildStatusLabelEntries(ROLE_LABELS));
    if (matchedRoles.length) {
      searchOr.push({ Role: { $in: matchedRoles } });
    }

    const matchedVerificationStatuses = resolveStatusesFromLabelSearch(
      keyword,
      buildStatusLabelEntries(VERIFICATION_LABELS)
    );
    if (matchedVerificationStatuses.length) {
      const verificationUserIds = await SellerVerification.find({
        status: { $in: matchedVerificationStatuses },
      })
        .distinct("userId")
        .lean();
      if (verificationUserIds.length) {
        searchOr.push({ _id: { $in: verificationUserIds } });
      }
    }

    searchOr.push(...buildObjectIdSearchConditions(keyword));

    if (searchOr.length) {
      andConditions.push({ $or: searchOr });
    }
  }

  if (normalizedVerificationStatus !== "") {
    const verificationUserIds = await SellerVerification.find({
      status: Number(normalizedVerificationStatus),
    })
      .distinct("userId")
      .lean();

    andConditions.push({ _id: { $in: verificationUserIds } });
  }

  if (!andConditions.length) {
    return {};
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  return { $and: andConditions };
}

async function listAccounts({
  search = "",
  role = "",
  status = "",
  verificationStatus = "",
  hasShop = "",
  sort = "newest",
  from = "",
  to = "",
  page = 1,
  limit = 20,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;
  const match = await buildUserMatchFilter({
    search,
    role,
    status,
    verificationStatus,
    hasShop,
  });
  applyCreatedAtRange(match, { from, to });

  const users = await User.find(match).lean();
  const userIds = users.map((user) => user._id);

  const [shops, verifications] = await Promise.all([
    ShopProfile.find({ userId: { $in: userIds } }).lean(),
    SellerVerification.find({ userId: { $in: userIds } })
      .sort({ submittedAt: -1, CreatedAt: -1 })
      .lean(),
  ]);

  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));
  const verificationByUserId = new Map();

  verifications.forEach((verification) => {
    const key = String(verification.userId);
    if (!verificationByUserId.has(key)) {
      verificationByUserId.set(key, verification);
    }
  });

  const items = sortAccountItems(
    users.map((user) =>
      toAdminAccountListItem(
        user,
        shopByUserId.get(String(user._id)),
        verificationByUserId.get(String(user._id))
      )
    ),
    sort
  );

  const total = items.length;
  const pagedItems = items.slice(skip, skip + pageSize);

  return {
    items: pagedItems,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function getAccountStats(user) {
  const userId = user._id;
  const buyerFilter = { userId };

  const [
    totalOrders,
    totalCompletedOrders,
    totalCancelledOrders,
    totalDisputes,
    totalReviewsWritten,
    totalReportsReceived,
  ] = await Promise.all([
    Reservation.countDocuments(buyerFilter),
    Reservation.countDocuments({
      ...buyerFilter,
      status: { $in: COMPLETED_RESERVATION_STATUSES },
    }),
    Reservation.countDocuments({
      ...buyerFilter,
      status: { $in: CANCELLED_RESERVATION_STATUSES },
    }),
    Reservation.countDocuments({
      ...buyerFilter,
      status: { $in: DISPUTE_RESERVATION_STATUSES },
    }),
    Review.countDocuments({ userId, ...notDeletedReviewFilter() }),
    Report.countDocuments(await buildReportsReceivedFilter(userId)),
  ]);

  return {
    totalOrders,
    totalCompletedOrders,
    totalCancelledOrders,
    totalDisputes,
    totalReviewsWritten,
    totalReportsReceived,
  };
}

async function getRecentReports(userId, limit = 5) {
  const filter = await buildReportsReceivedFilter(userId);
  const reports = await Report.find(filter)
    .sort({ CreatedAt: -1 })
    .limit(limit)
    .lean();

  return reports.map((report) => ({
    id: String(report._id),
    title: report.title || "",
    content: report.content || "",
    reportType: report.reportType,
    status: report.status,
    createdAt: report.CreatedAt || null,
    processedAt: report.processedAt || null,
  }));
}

async function getAccountDetail(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }

  if (user.Role === USER_ROLE.ADMIN) {
    throw createServiceError("Không thể xem tài khoản quản trị trong mục quản lý người dùng.", 403);
  }

  const shop = await ShopProfile.findOne({ userId: user._id }).lean();
  const [verification, stats, recentReports] = await Promise.all([
    SellerVerification.findOne({ userId: user._id })
      .sort({ submittedAt: -1, CreatedAt: -1 })
      .lean(),
    getAccountStats(user),
    getRecentReports(user._id),
  ]);

  return {
    user: toAdminUserBase(user, shop),
    shop: toAdminShopSummary(shop, user),
    verification: toAdminVerificationSummary(verification),
    stats,
    recentReports,
  };
}

async function setAccountStatus(adminUser, targetUserId, nextStatus) {
  const session = await mongoose.startSession();

  try {
    let updatedDetail = null;

    await session.withTransaction(async () => {
      const targetUser = await User.findById(targetUserId).session(session);
      if (!targetUser) {
        throw createServiceError("Không tìm thấy tài khoản.", 404);
      }

      if (String(targetUser._id) === String(adminUser._id)) {
        throw createServiceError("Không thể khóa hoặc mở khóa chính tài khoản quản trị.", 403);
      }

      if (targetUser.Role === USER_ROLE.ADMIN) {
        throw createServiceError("Không thể khóa tài khoản quản trị.", 403);
      }

      if (targetUser.Status === nextStatus) {
        throw createServiceError(
          nextStatus === USER_STATUS.BLOCKED
            ? "Tài khoản đã bị khóa."
            : "Tài khoản đang hoạt động."
        );
      }

      const now = new Date();
      targetUser.Status = nextStatus;
      targetUser.UpdatedAt = now;
      if (nextStatus === USER_STATUS.BLOCKED) {
        targetUser.lockedAt = now;
      } else {
        targetUser.lockedAt = null;
      }
      await targetUser.save({ session });

      const shop = await ShopProfile.findOne({ userId: targetUser._id }).session(session);
      if (shop) {
        shop.status =
          nextStatus === USER_STATUS.ACTIVE ? SHOP_STATUS.ACTIVE : SHOP_STATUS.BLOCKED;
        if (nextStatus === USER_STATUS.BLOCKED) {
          shop.isOpen = 0;
          shop.permanentlyClosedAt = shop.permanentlyClosedAt || now;
          shop.lockedAt = now;
        } else {
          shop.suspendedUntil = null;
          shop.permanentlyClosedAt = null;
          shop.visibilityRestrictedUntil = null;
          shop.lockedAt = null;
        }
        shop.UpdatedAt = now;
        await shop.save({ session });
      }
    });

    if (nextStatus === USER_STATUS.BLOCKED) {
      const shopAfter = await ShopProfile.findOne({ userId: targetUserId }).select("_id").lean();
      if (shopAfter?._id) {
        await Product.updateMany(
          { ShopId: shopAfter._id, Status: PRODUCT_STATUS.ACTIVE },
          { $set: { Status: PRODUCT_STATUS.HIDDEN, UpdatedAt: new Date() } }
        );
      }
      try {
        await cancelActiveReservationsForAccountLock(targetUserId);
      } catch (error) {
        console.error(
          "setAccountStatus: cancel reservations on account lock failed:",
          targetUserId,
          error.message
        );
      }
    } else if (nextStatus === USER_STATUS.ACTIVE) {
      const shopAfter = await ShopProfile.findOne({ userId: targetUserId }).select("_id").lean();
      if (shopAfter?._id) {
        await Product.updateMany(
          { ShopId: shopAfter._id, Status: PRODUCT_STATUS.HIDDEN },
          { $set: { Status: PRODUCT_STATUS.ACTIVE, UpdatedAt: new Date() } }
        );
      }
    }

    updatedDetail = await getAccountDetail(targetUserId);

    const shopAfter = await ShopProfile.findOne({ userId: targetUserId })
      .select("_id status")
      .lean();
    emitUserResourceUpdated(targetUserId, "account", {
      status: nextStatus,
      locked: nextStatus === USER_STATUS.BLOCKED,
      shopId: shopAfter?._id ? String(shopAfter._id) : "",
      shopStatus: shopAfter ? Number(shopAfter.status) : undefined,
    });
    emitAdminUpdated("account", {
      userId: String(targetUserId),
      status: nextStatus,
      locked: nextStatus === USER_STATUS.BLOCKED,
    });

    return updatedDetail;
  } finally {
    session.endSession();
  }
}

async function blockAccount(adminUser, targetUserId) {
  return setAccountStatus(adminUser, targetUserId, USER_STATUS.BLOCKED);
}

async function unblockAccount(adminUser, targetUserId) {
  const detail = await setAccountStatus(adminUser, targetUserId, USER_STATUS.ACTIVE);

  const { closePendingAccountLockAppeals, closePendingShopLockAppeals } = require("./lockAppealService");
  const ShopProfile = require("../models/ShopProfile");

  try {
    await closePendingAccountLockAppeals(targetUserId, adminUser._id);
    const shop = await ShopProfile.findOne({ userId: targetUserId }).select("_id").lean();
    if (shop?._id) {
      await closePendingShopLockAppeals(shop._id, adminUser._id);
    }
  } catch {
    // Không chặn luồng mở khóa nếu đóng khiếu nại lỗi.
  }

  return detail;
}

function assertUserIsActive(user) {
  if (!user) {
    return;
  }

  if (user.Status === USER_STATUS.BLOCKED) {
    throw createServiceError(
      "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
      403
    );
  }
}
async function getAccountStatistics(query = {}) {

  const [
    totalUsers,
    buyers,
    sellers,
    admins,
    activeUsers,
    blockedUsers,
    totalShops,
    totalProducts,
    totalOrders
  ] = await Promise.all([

    User.countDocuments({}), // total tất cả tài khoản

    // Buyer = USER + SELLER (seller vẫn mua hàng)
    User.countDocuments({
      Role: { 
        $in: [1, 2]
      }
    }),
    
    // Seller
    User.countDocuments({
      Role: 2
    }),
    
    // Admin
    User.countDocuments({
      Role: 3
    }),
    
    // Active
    User.countDocuments({
      Status: 1
    }),
    
    // Blocked
    User.countDocuments({
      Status: 0
    }),
    ShopProfile.countDocuments({}),

    Product.countDocuments(notRemovedProductMatch()),

    Reservation.countDocuments({})

  ]);


  return {
    users: {
      total: totalUsers,
      buyers,
      sellers,
      admins,
      active: activeUsers,
      blocked: blockedUsers
    },

    shops: {
      total: totalShops
    },

    products: {
      total: totalProducts
    },

    orders: {
      total: totalOrders
    }
  };
}


module.exports = {
  listAccounts,
  getAccountDetail,
  blockAccount,
  unblockAccount,
  assertUserIsActive,
  ROLE_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
  getAccountStatistics
};
