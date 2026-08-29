const User = require("../models/User");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE, USER_STATUS, SHOP_STATUS } = require("../constants");
const { buildSearchRegex, buildMongoTokenFieldFilter } = require("../utils/searchText");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const { getFollowStatus } = require("./userFollowService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function toUserCard(user, shop = null) {
  return {
    id: String(user._id),
    userId: String(user._id),
    fullName: user.FullName || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
    soNguoiTheo: Number(shop?.soNguoiTheo) || 0,
    followingCount: Number(user.SoTheoDoi) || 0,
    shopId: shop?._id ? String(shop._id) : "",
    shopName: shop ? resolveShopDisplayName(shop, user) : "",
    shopUsername: shop ? resolveShopUsername(shop, user) : "",
    shopAvatar: shop ? resolveShopAvatar(shop, user) : "",
  };
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function searchUsers(currentUser, query = {}) {
  const keyword = pickString(query.search || query.q);
  const { page, limit, skip } = parsePagination(query);
  const tokenFilter = buildMongoTokenFieldFilter(keyword, ["FullName", "UserName"], {
    minTokenLength: 1,
  });

  if (!tokenFilter) {
    return {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    };
  }

  const filter = {
    Status: USER_STATUS.ACTIVE,
    Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] },
    ...tokenFilter,
  };

  if (currentUser?._id) {
    filter._id = { $ne: currentUser._id };
  }

  const [rows, total] = await Promise.all([
    User.find(filter)
      .select("FullName UserName Avatar SoTheoDoi Role")
      .sort({ SoTheoDoi: -1, CreatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row._id);
  const shops = userIds.length
    ? await ShopProfile.find({
        userId: { $in: userIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      })
        .select("userId shopName shopUsername avatar soNguoiTheo")
        .lean()
    : [];
  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));

  const items = rows.map((user) =>
    toUserCard(user, shopByUserId.get(String(user._id)) || null)
  );

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getPublicUserProfile(currentUser, userIdInput) {
  const userId = pickString(userIdInput);
  if (!userId) {
    throw createServiceError("Thiếu mã người dùng.", 400);
  }

  const user = await User.findById(userId).lean();
  if (!user || Number(user.Status) === USER_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }
  if (Number(user.Role) === USER_ROLE.ADMIN) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }

  const shop = await ShopProfile.findOne({
    userId: user._id,
    status: { $ne: SHOP_STATUS.BLOCKED },
  }).lean();

  let followMeta = {
    isFollowing: false,
    soNguoiTheo: Number(shop?.soNguoiTheo) || 0,
    followingCount: Number(user.SoTheoDoi) || 0,
    shopId: shop?._id ? String(shop._id) : "",
  };

  if (currentUser?._id && shop?._id) {
    const status = await getFollowStatus(currentUser, { shopId: String(shop._id) });
    followMeta = {
      ...status,
      followingCount: Number(user.SoTheoDoi) || 0,
    };
  }

  return {
    user: toUserCard(user, shop),
    ...followMeta,
    isSelf: Boolean(currentUser?._id && String(currentUser._id) === String(user._id)),
  };
}

async function listPublicUserFollowing(userIdInput, query = {}) {
  const userId = pickString(userIdInput);
  if (!userId) {
    throw createServiceError("Thiếu mã người dùng.", 400);
  }

  const user = await User.findById(userId).select("_id Status Role").lean();
  if (!user || Number(user.Status) === USER_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }
  if (Number(user.Role) === USER_ROLE.ADMIN) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }

  const { page, limit, skip } = parsePagination(query);
  const filter = { followerId: user._id };
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const shopIds = rows.map((row) => row.shopId).filter(Boolean);
  const shops = shopIds.length
    ? await ShopProfile.find({
        _id: { $in: shopIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      })
        .select("userId shopName shopUsername avatar soNguoiTheo")
        .lean()
    : [];
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));

  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const users = ownerIds.length
    ? await User.find({
        _id: { $in: ownerIds },
        Status: { $ne: USER_STATUS.BLOCKED },
        Role: { $ne: USER_ROLE.ADMIN },
      })
        .select("FullName UserName Avatar SoTheoDoi")
        .lean()
    : [];
  const userById = new Map(users.map((row) => [String(row._id), row]));

  const items = rows
    .map((row) => {
      const shop = shopById.get(String(row.shopId));
      if (!shop) {
        return null;
      }
      const owner = userById.get(String(shop.userId));
      if (!owner) {
        return null;
      }
      return toUserCard(owner, shop);
    })
    .filter(Boolean);

  return {
    userId: String(user._id),
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

module.exports = {
  searchUsers,
  getPublicUserProfile,
  listPublicUserFollowing,
};
