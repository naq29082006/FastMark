const User = require("../models/User");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE, USER_STATUS, SHOP_STATUS } = require("../constants");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const { matchesNormalizedSearch } = require("../utils/adminSearchHelpers");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function parsePagination(query = {}, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function assertViewableUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }
  if (user.Role === USER_ROLE.ADMIN) {
    throw createServiceError("Không thể xem follow của tài khoản quản trị.", 403);
  }
  return user;
}

async function assertViewableShop(shopId) {
  const shop = await ShopProfile.findById(shopId).select("userId").lean();
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  return shop;
}

function toAdminFollowShopItem(owner, shop, extra = {}) {
  return {
    id: shop?._id ? String(shop._id) : "",
    shopId: shop?._id ? String(shop._id) : "",
    userId: owner?._id ? String(owner._id) : "",
    fullName: owner?.FullName || "",
    userName: owner?.UserName || "",
    avatar: owner?.Avatar || "",
    shopName: resolveShopDisplayName(shop, owner),
    shopUsername: resolveShopUsername(shop, owner),
    shopAvatar: resolveShopAvatar(shop, owner),
    followedAt: extra.followedAt || null,
  };
}

function toAdminFollowUserItem(user, extra = {}) {
  return {
    id: String(user._id),
    userId: String(user._id),
    fullName: user.FullName || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
    followedAt: extra.followedAt || null,
  };
}

async function loadOwnersByShopIds(shopIds) {
  if (!shopIds.length) {
    return { shopById: new Map(), ownerById: new Map() };
  }
  const shops = await ShopProfile.find({
    _id: { $in: shopIds },
    status: { $ne: SHOP_STATUS.BLOCKED },
  }).lean();
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));
  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const owners = ownerIds.length
    ? await User.find({
        _id: { $in: ownerIds },
        Status: { $ne: USER_STATUS.BLOCKED },
      }).lean()
    : [];
  const ownerById = new Map(owners.map((user) => [String(user._id), user]));
  return { shopById, ownerById };
}

async function listUserFollowing(userId, query = {}) {
  await assertViewableUser(userId);
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q);
  const filter = { followerId: userId };

  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const shopIds = rows.map((row) => row.shopId).filter(Boolean);
  const { shopById, ownerById } = await loadOwnersByShopIds(shopIds);

  let items = rows
    .map((row) => {
      const shop = shopById.get(String(row.shopId));
      if (!shop) {
        return null;
      }
      const owner = ownerById.get(String(shop.userId));
      if (!owner) {
        return null;
      }
      return toAdminFollowShopItem(owner, shop, { followedAt: row.CreatedAt });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) =>
      matchesNormalizedSearch(
        `${item.fullName} ${item.userName} ${item.shopName} ${item.shopUsername}`,
        search
      )
    );
  }

  return {
    type: "following",
    userId: String(userId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function listUserFollowers(userId, query = {}) {
  await assertViewableUser(userId);
  const shop = await ShopProfile.findOne({ userId }).select("_id").lean();
  if (!shop?._id) {
    return {
      type: "followers",
      userId: String(userId),
      shopId: "",
      items: [],
      pagination: buildPagination(
        Math.max(1, Number(query.page) || 1),
        Math.min(50, Math.max(1, Number(query.limit) || 20)),
        0
      ),
    };
  }
  return listShopFollowers(String(shop._id), query, { ownerUserId: userId });
}

async function listShopFollowing(shopId, query = {}) {
  const shop = await assertViewableShop(shopId);
  const data = await listUserFollowing(String(shop.userId), query);
  return { ...data, shopId: String(shopId) };
}

async function listShopFollowers(shopId, query = {}, meta = {}) {
  const shop = await assertViewableShop(shopId);
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q);
  const filter = { shopId: shop._id };

  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.followerId).filter(Boolean);
  const users = userIds.length
    ? await User.find({
        _id: { $in: userIds },
        Status: { $ne: USER_STATUS.BLOCKED },
      }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followerId));
      if (!user) {
        return null;
      }
      return toAdminFollowUserItem(user, { followedAt: row.CreatedAt });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) =>
      matchesNormalizedSearch(`${item.fullName} ${item.userName}`, search)
    );
  }

  return {
    type: "followers",
    userId: String(meta.ownerUserId || shop.userId),
    shopId: String(shopId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

module.exports = {
  listUserFollowing,
  listUserFollowers,
  listShopFollowing,
  listShopFollowers,
};
