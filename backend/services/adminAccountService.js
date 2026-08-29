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
const { readUserHoatDongCuoi } = require("../utils/fieldCompat");
const { MF } = require("../constants/modelFields");

const CANCELLED_RESERVATION_STATUSES = [RESERVATION_STATUS.CANCELLED];

const COMPLETED_RESERVATION_STATUSES = [RESERVATION_STATUS.COMPLETED];

const DISPUTE_RESERVATION_STATUSES = [RESERVATION_STATUS.DISPUTED];
const { cancelActiveReservationsForAccountLock } = require("./reservationService");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");
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
    lastActiveAt: readUserHoatDongCuoi(user),
    followingCount: user.SoTheoDoi || 0,
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
    diemTB: Number(shop.diemTB) || 0,
    tongSP: Number(shop.tongSP) || 0,
    tongDG: Number(shop.tongDG) || 0,
    soNguoiTheo: Number(shop.soNguoiTheo) || 0,
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
    anhCccdTruoc: verification.anhCccdTruoc || "",
    anhCccdSau: verification.anhCccdSau || "",
    selfieImage: verification.selfieImage || "",
    anhKD:
      verification.anhKD ||
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
    productCount: shopSummary?.tongSP || 0,
    diemTB: shopSummary?.diemTB || 0,
  };
}

function resolveAccountDbSort(sortKey) {
  switch (sortKey) {
    case "oldest":
      return { CreatedAt: 1 };
    case "last_active":
      return { [MF.HoatDongCuoi]: -1, CreatedAt: -1 };
    case "most_products":
      return null;
    case "newest":
    default:
      return { CreatedAt: -1 };
  }
}

async function loadLatestVerificationsByUserIds(userIds) {
  if (!userIds.length) {
    return new Map();
  }

  const rows = await SellerVerification.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $sort: { submittedAt: -1, CreatedAt: -1 } },
    { $group: { _id: "$userId", doc: { $first: "$$ROOT" } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.doc]));
}

function buildAccountListResponse({ users, shops, verificationByUserId, currentPage, pageSize, total }) {
  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));
  const items = users.map((user) =>
    toAdminAccountListItem(
      user,
      shopByUserId.get(String(user._id)),
      verificationByUserId.get(String(user._id))
    )
  );

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

async function listAccountsByProductCount({ match, skip, pageSize, currentPage }) {
  const shopCollection = ShopProfile.collection.name;
  const [facetResult] = await User.aggregate([
    { $match: match },
    {
      $lookup: {
        from: shopCollection,
        localField: "_id",
        foreignField: "userId",
        as: "shop",
      },
    },
    {
      $addFields: {
        productCount: {
          $ifNull: [{ $arrayElemAt: ["$shop.tongSP", 0] }, 0],
        },
      },
    },
    { $sort: { productCount: -1, FullName: 1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        users: [{ $skip: skip }, { $limit: pageSize }],
      },
    },
  ]);

  const total = facetResult?.total?.[0]?.count || 0;
  const users = facetResult?.users || [];
  const userIds = users.map((user) => user._id);

  const [shops, verificationByUserId] = await Promise.all([
    ShopProfile.find({ userId: { $in: userIds } }).lean(),
    loadLatestVerificationsByUserIds(userIds),
  ]);

  return buildAccountListResponse({
    users,
    shops,
    verificationByUserId,
    currentPage,
    pageSize,
    total,
  });
}

async function buildUserMatchFilter({ search, role, status, verificationStatus, hasShop }) {
  const andConditions = [];
  const normalizedRole = pickString(role);
  const normalizedHasShop = pickString(hasShop);
  const normalizedStatus = pickString(status);
  const normalizedVerificationStatus = pickString(verificationStatus);
  const keyword = pickString(search);

  if (normalizedRole === "3") {
    andConditions.push({ Role: USER_ROLE.ADMIN });
  } else if (normalizedRole === "2") {
    andConditions.push({ Role: USER_ROLE.SELLER });
  } else if (normalizedRole === "1") {
    andConditions.push({ Role: USER_ROLE.BUYER });
  } else {
    andConditions.push({
      Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER, USER_ROLE.ADMIN] },
    });
  }

  if (normalizedHasShop === "1") {
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

  if (sort === "most_products") {
    return listAccountsByProductCount({ match, skip, pageSize, currentPage });
  }

  const sortSpec = resolveAccountDbSort(sort);

  const [total, users] = await Promise.all([
    User.countDocuments(match),
    User.find(match).sort(sortSpec).skip(skip).limit(pageSize).lean(),
  ]);

  const userIds = users.map((user) => user._id);
  const [shops, verificationByUserId] = await Promise.all([
    ShopProfile.find({ userId: { $in: userIds } }).lean(),
    loadLatestVerificationsByUserIds(userIds),
  ]);

  return buildAccountListResponse({
    users,
    shops,
    verificationByUserId,
    currentPage,
    pageSize,
    total,
  });
}

async function getAccountStats(user) {
  const userId = user._id;
  const buyerFilter = { userId };

  const [
    totalOrders,
    totalCompletedOrders,
    totalCancelledOrders,
    totalDisputes,
    tongDGWritten,
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
    tongDGWritten,
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
    tgXuLy: report.tgXuLy || null,
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
async function getAccountStatistics() {
  const [userStatsRows, totalShops, tongSP, totalOrders] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          buyers: {
            $sum: {
              $cond: [{ $in: ["$Role", [USER_ROLE.BUYER, USER_ROLE.SELLER]] }, 1, 0],
            },
          },
          sellers: {
            $sum: { $cond: [{ $eq: ["$Role", USER_ROLE.SELLER] }, 1, 0] },
          },
          admins: {
            $sum: { $cond: [{ $eq: ["$Role", USER_ROLE.ADMIN] }, 1, 0] },
          },
          active: {
            $sum: { $cond: [{ $eq: ["$Status", USER_STATUS.ACTIVE] }, 1, 0] },
          },
          blocked: {
            $sum: { $cond: [{ $eq: ["$Status", USER_STATUS.BLOCKED] }, 1, 0] },
          },
        },
      },
    ]),
    ShopProfile.countDocuments({}),
    Product.countDocuments(notRemovedProductMatch()),
    Reservation.countDocuments({}),
  ]);

  const userStats = userStatsRows[0] || {};

  return {
    users: {
      total: userStats.total || 0,
      buyers: userStats.buyers || 0,
      sellers: userStats.sellers || 0,
      admins: userStats.admins || 0,
      active: userStats.active || 0,
      blocked: userStats.blocked || 0,
    },
    shops: {
      total: totalShops,
    },
    products: {
      total: tongSP,
    },
    orders: {
      total: totalOrders,
    },
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
