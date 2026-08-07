const mongoose = require("mongoose");
const User = require("../models/User");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");
const { USER_STATUS } = require("../constants");
const { SHOP_STATUS } = require("../constants");
const { createNotification } = require("./notificationService");
const { NOTIFICATION_AUDIENCE, NOTIFICATION_INDEX } = require("../constants");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const { normalizeSearchText, matchesTokenSearchAny } = require("../utils/searchText");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function toObjectId(value) {
  const text = pickString(value);
  if (!isStrictMongoObjectId(text)) {
    return null;
  }
  return new mongoose.Types.ObjectId(text);
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Resolve gian hàng được follow từ shopId hoặc userId chủ shop (tương thích API cũ).
 */
async function resolveFollowedShop(payload = {}) {
  const shopIdCandidate = pickString(payload.shopId);
  if (shopIdCandidate && isStrictMongoObjectId(shopIdCandidate)) {
    const shop = await ShopProfile.findById(shopIdCandidate).lean();
    if (shop && Number(shop.status) !== SHOP_STATUS.BLOCKED) {
      return shop;
    }
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const userCandidates = [
    payload.followedUserId,
    payload.userId,
    payload.sellerUserId,
    payload.targetId,
    payload.id,
  ]
    .map(pickString)
    .filter(Boolean);

  for (const candidate of userCandidates) {
    if (!isStrictMongoObjectId(candidate)) {
      continue;
    }
    const user = await User.findById(candidate).select("_id Status").lean();
    if (!user?._id || Number(user.Status) === USER_STATUS.BLOCKED) {
      continue;
    }
    const shop = await ShopProfile.findOne({
      userId: user._id,
      status: { $ne: SHOP_STATUS.BLOCKED },
    })
      .sort({ CreatedAt: -1 })
      .lean();
    if (shop?._id) {
      return shop;
    }
  }

  throw createServiceError("Thiếu shopId hoặc không tìm thấy gian hàng tương ứng.", 404);
}

async function getShopOwner(shop) {
  if (!shop?.userId) {
    return null;
  }
  return User.findById(shop.userId).lean();
}

async function getShopForUser(userId) {
  if (!userId) {
    return null;
  }
  return ShopProfile.findOne({
    userId,
    status: { $ne: SHOP_STATUS.BLOCKED },
  })
    .sort({ CreatedAt: -1 })
    .lean();
}

function toClientShopCard(owner, shop, extra = {}) {
  return {
    id: shop?._id ? String(shop._id) : "",
    shopId: shop?._id ? String(shop._id) : "",
    userId: owner?._id ? String(owner._id) : "",
    followedUserId: owner?._id ? String(owner._id) : "",
    fullName: owner?.FullName || "",
    userName: owner?.UserName || "",
    avatar: owner?.Avatar || "",
    followersCount: Number(shop?.followersCount) || 0,
    followingCount: Number(owner?.FollowingCount) || 0,
    shopName: resolveShopDisplayName(shop, owner),
    shopUsername: resolveShopUsername(shop, owner),
    shopAvatar: resolveShopAvatar(shop, owner),
    address: shop?.addressHeThong || shop?.address || shop?.DiaChiHeThong || "",
    averageRating: Number(shop?.averageRating) || 0,
    totalProducts: Number(shop?.totalProducts) || 0,
    ...extra,
  };
}

function toClientUserCard(user, extra = {}, shop = null) {
  return toClientShopCard(user, shop, extra);
}

async function hasFollow(followerId, shopId) {
  const followerObjectId = toObjectId(followerId);
  const shopObjectId = toObjectId(shopId);
  if (!followerObjectId || !shopObjectId) {
    return false;
  }
  return Boolean(
    await Follow.exists({
      followerId: followerObjectId,
      shopId: shopObjectId,
    })
  );
}

async function runInOptionalTransaction(work) {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    const needsFallback =
      /transaction|replica set|not supported|IllegalOperation/i.test(message) ||
      error?.code === 20 ||
      error?.codeName === "IllegalOperation";
    if (!needsFallback || !work) {
      throw error;
    }
    return work(null);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

async function followShop(currentUser, payload = {}) {
  const shop = await resolveFollowedShop(payload);
  const owner = await getShopOwner(shop);
  if (!owner) {
    throw createServiceError("Không tìm thấy chủ gian hàng.", 404);
  }

  const followerObjectId = toObjectId(currentUser._id);
  const shopObjectId = toObjectId(shop._id);

  if (String(owner._id) === String(currentUser._id)) {
    throw createServiceError("Không thể theo dõi gian hàng của chính mình.", 400);
  }

  if (await hasFollow(followerObjectId, shopObjectId)) {
    throw createServiceError("Bạn đã theo dõi gian hàng này.", 409);
  }

  let followDoc = null;

  try {
    await runInOptionalTransaction(async (session) => {
      const now = new Date();
      const options = session ? { session } : undefined;
      const [created] = await Follow.create(
        [
          {
            followerId: followerObjectId,
            shopId: shopObjectId,
            CreatedAt: now,
          },
        ],
        options || {}
      );
      followDoc = created;

      await User.updateOne(
        { _id: followerObjectId },
        { $inc: { FollowingCount: 1 }, $set: { UpdatedAt: now } },
        options
      );

      await ShopProfile.updateOne(
        { _id: shopObjectId },
        { $inc: { followersCount: 1 }, $set: { UpdatedAt: now } },
        options
      );
    });
  } catch (error) {
    if (error?.code === 11000 || error?.statusCode === 409) {
      throw createServiceError("Bạn đã theo dõi gian hàng này.", 409);
    }
    throw error;
  }

  const followerName = currentUser.FullName || currentUser.UserName || "Một người dùng";
  await createNotification(owner._id, {
    title: "Có người theo dõi gian hàng",
    content: `${followerName} vừa theo dõi gian hàng của bạn.`,
    audience: NOTIFICATION_AUDIENCE.SYSTEM,
    index: NOTIFICATION_INDEX.SYSTEM,
  });

  const [freshFollower, freshShop] = await Promise.all([
    User.findById(currentUser._id).lean(),
    ShopProfile.findById(shop._id).lean(),
  ]);

  return {
    isFollowing: true,
    followId: followDoc?._id ? String(followDoc._id) : "",
    shopId: String(shop._id),
    followedUserId: String(owner._id),
    user: toClientShopCard(owner, freshShop || shop),
    shop: toClientShopCard(owner, freshShop || shop),
    followersCount: Number(freshShop?.followersCount ?? shop.followersCount) || 0,
    followingCount: Number(freshFollower?.FollowingCount) || 0,
  };
}

async function unfollowShop(currentUser, payload = {}) {
  const shop = await resolveFollowedShop(payload);
  const owner = await getShopOwner(shop);
  const followerObjectId = toObjectId(currentUser._id);
  const shopObjectId = toObjectId(shop._id);

  if (!followerObjectId || !shopObjectId) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  await runInOptionalTransaction(async (session) => {
    const options = session ? { session } : undefined;
    const removed = await Follow.findOneAndDelete(
      {
        followerId: followerObjectId,
        shopId: shopObjectId,
      },
      options
    );

    if (!removed) {
      return;
    }

    const now = new Date();
    await User.updateOne(
      { _id: followerObjectId, FollowingCount: { $gt: 0 } },
      { $inc: { FollowingCount: -1 }, $set: { UpdatedAt: now } },
      options
    );

    await ShopProfile.updateOne(
      { _id: shopObjectId, followersCount: { $gt: 0 } },
      { $inc: { followersCount: -1 }, $set: { UpdatedAt: now } },
      options
    );
  });

  const [freshFollower, freshShop] = await Promise.all([
    User.findById(currentUser._id).lean(),
    ShopProfile.findById(shop._id).lean(),
  ]);

  return {
    isFollowing: false,
    shopId: String(shop._id),
    followedUserId: owner?._id ? String(owner._id) : "",
    user: owner ? toClientShopCard(owner, freshShop || shop) : null,
    shop: owner ? toClientShopCard(owner, freshShop || shop) : null,
    followersCount: Number(freshShop?.followersCount ?? shop.followersCount) || 0,
    followingCount: Number(freshFollower?.FollowingCount) || 0,
  };
}

async function getFollowStatus(currentUser, payload = {}) {
  const shop = await resolveFollowedShop(payload);
  const owner = await getShopOwner(shop);
  const followerObjectId = toObjectId(currentUser._id);
  const shopObjectId = toObjectId(shop._id);

  const isFollowing = Boolean(
    followerObjectId &&
      shopObjectId &&
      (await Follow.exists({
        followerId: followerObjectId,
        shopId: shopObjectId,
      }))
  );

  const freshShop = await ShopProfile.findById(shop._id).select("followersCount").lean();

  return {
    shopId: String(shop._id),
    followedUserId: owner?._id ? String(owner._id) : "",
    isFollowing,
    followersCount: Number(freshShop?.followersCount ?? shop.followersCount) || 0,
  };
}

async function listFollowing(currentUser, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = normalizeSearchText(query.search || query.q);
  const followerObjectId = toObjectId(currentUser._id);

  const filter = { followerId: followerObjectId || currentUser._id };
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const shopIds = rows.map((row) => row.shopId).filter(Boolean);
  const shops = shopIds.length
    ? await ShopProfile.find({
        _id: { $in: shopIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      }).lean()
    : [];
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));

  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const users = ownerIds.length
    ? await User.find({
        _id: { $in: ownerIds },
        Status: { $ne: USER_STATUS.BLOCKED },
      }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  let items = rows
    .map((row) => {
      const shop = shopById.get(String(row.shopId));
      if (!shop) {
        return null;
      }
      const owner = userById.get(String(shop.userId));
      if (!owner) {
        return null;
      }
      return toClientShopCard(owner, shop, {
        followedAt: row.CreatedAt,
        isFollowing: true,
      });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) =>
      matchesTokenSearchAny(
        [item.fullName, item.userName, item.shopName, item.shopUsername],
        search
      )
    );
  }

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

async function listFollowers(currentUser, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = normalizeSearchText(query.search || query.q);

  let shop = null;
  const shopIdInput = pickString(query.shopId);
  if (shopIdInput) {
    shop = await resolveFollowedShop({ shopId: shopIdInput });
    if (String(shop.userId) !== String(currentUser._id)) {
      throw createServiceError("Chỉ xem được danh sách người theo dõi gian hàng của mình.", 403);
    }
  } else {
    shop = await getShopForUser(currentUser._id);
    if (!shop) {
      throw createServiceError("Bạn chưa có gian hàng.", 404);
    }
  }

  const shopObjectId = toObjectId(shop._id);
  const filter = { shopId: shopObjectId || shop._id };
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.followerId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds }, Status: { $ne: USER_STATUS.BLOCKED } }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followerId));
      if (!user) {
        return null;
      }
      return toClientUserCard(user, {
        followedAt: row.CreatedAt,
      });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) =>
      matchesTokenSearchAny([item.fullName, item.userName], search)
    );
  }

  return {
    shopId: String(shop._id),
    followedUserId: String(currentUser._id),
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

const followUser = followShop;
const unfollowUser = unfollowShop;

module.exports = {
  followUser,
  unfollowUser,
  followShop,
  unfollowShop,
  getFollowStatus,
  listFollowing,
  listFollowers,
};
