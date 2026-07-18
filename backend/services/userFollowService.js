const mongoose = require("mongoose");
const User = require("../models/User");
const ShopFollow = require("../models/ShopFollow");
const ShopProfile = require("../models/ShopProfile");
const { USER_STATUS } = require("../constants/userStatus");
const { SHOP_STATUS } = require("../constants/shopStatus");
const { createNotification } = require("./notificationService");
const { NOTIFICATION_AUDIENCE } = require("../constants/notificationAudience");

/** Collection cũ: user → seller (UserFollow). */
const LegacyUserFollow =
  mongoose.models.LegacyUserFollow ||
  mongoose.model(
    "LegacyUserFollow",
    new mongoose.Schema(
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        followedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        CreatedAt: { type: Date, default: Date.now },
        UpdatedAt: { type: Date, default: Date.now },
      },
      { collection: "userfollows" }
    )
  );

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

async function resolveShopId(payload = {}) {
  const candidates = [
    payload.shopId,
    payload.targetId,
    payload.id,
    payload.sellerUserId,
    payload.followedUserId,
    payload.userId,
  ]
    .map(pickString)
    .filter(Boolean);

  if (candidates.length === 0) {
    throw createServiceError("Thiếu shopId.", 400);
  }

  for (const candidate of candidates) {
    if (!isStrictMongoObjectId(candidate)) {
      continue;
    }

    const asShop = await ShopProfile.findById(candidate).select("_id").lean();
    if (asShop?._id) {
      return String(asShop._id);
    }

    const asOwnerShop = await ShopProfile.findOne({ userId: candidate })
      .sort({ CreatedAt: -1 })
      .select("_id")
      .lean();
    if (asOwnerShop?._id) {
      return String(asOwnerShop._id);
    }
  }

  throw createServiceError("Không tìm thấy gian hàng tương ứng.", 404);
}

async function getActiveShop(shopId) {
  const shop = await ShopProfile.findById(shopId);
  if (!shop || Number(shop.status) === SHOP_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  return shop;
}

function toClientShopCard(shop, extra = {}, owner = null) {
  const ownerName = pickString(owner?.FullName) || pickString(owner?.UserName) || "";
  const ownerUsername = pickString(owner?.UserName) || "";
  const displayName = ownerName || shop.shopName || "";
  const displayUsername = ownerUsername || shop.shopUsername || "";

  return {
    id: String(shop._id),
    shopId: String(shop._id),
    shopName: displayName,
    shopUsername: displayUsername,
    fullName: displayName,
    userName: displayUsername,
    ownerUserId: shop.userId ? String(shop.userId) : "",
    shopAvatar: shop.avatar || "",
    avatar: shop.avatar || owner?.Avatar || "",
    address: shop.address || shop.DiaChiHeThong || "",
    followersCount:
      Number(owner?.FollowersCount) || Number(shop.followersCount) || 0,
    averageRating: Number(shop.averageRating) || 0,
    totalProducts: Number(shop.totalProducts) || 0,
    ...extra,
  };
}

function toClientFollowerCard(user, extra = {}) {
  return {
    id: String(user._id),
    userName: user.UserName || "",
    fullName: user.FullName || "",
    avatar: user.Avatar || "",
    followingCount: Number(user.FollowingCount) || 0,
    ...extra,
  };
}

async function hasShopFollow(userId, shopId) {
  const userObjectId = toObjectId(userId);
  const shopObjectId = toObjectId(shopId);
  if (!userObjectId || !shopObjectId) {
    return false;
  }
  return Boolean(
    await ShopFollow.exists({
      userId: userObjectId,
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
  const shopId = await resolveShopId(payload);
  const shop = await getActiveShop(shopId);
  const userObjectId = toObjectId(currentUser._id);
  const shopObjectId = toObjectId(shop._id);

  if (await hasShopFollow(userObjectId, shopObjectId)) {
    throw createServiceError("Bạn đã theo dõi gian hàng này.", 409);
  }

  let followDoc = null;

  try {
    await runInOptionalTransaction(async (session) => {
      const now = new Date();
      const options = session ? { session } : undefined;
      const [created] = await ShopFollow.create(
        [
          {
            userId: userObjectId,
            shopId: shopObjectId,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        options || {}
      );
      followDoc = created;

      await User.updateOne(
        { _id: userObjectId },
        { $inc: { FollowingCount: 1 }, $set: { UpdatedAt: now } },
        options
      );
      await ShopProfile.updateOne(
        { _id: shopObjectId },
        { $inc: { followersCount: 1 }, $set: { UpdatedAt: now } },
        options
      );
      if (shop.userId) {
        await User.updateOne(
          { _id: shop.userId },
          { $inc: { FollowersCount: 1 }, $set: { UpdatedAt: now } },
          options
        );
      }
    });
  } catch (error) {
    if (error?.code === 11000 || error?.statusCode === 409) {
      throw createServiceError("Bạn đã theo dõi gian hàng này.", 409);
    }
    throw error;
  }

  // Dọn follow user↔user cũ nếu còn.
  if (shop.userId) {
    await LegacyUserFollow.deleteMany({
      userId: userObjectId,
      followedUserId: shop.userId,
    }).catch(() => null);
  }

  if (shop.userId && String(shop.userId) !== String(currentUser._id)) {
    const followerName = currentUser.FullName || currentUser.UserName || "Một người mua";
    const ownerName = shop.shopName || "";
    await createNotification(shop.userId, {
      title: "Có người theo dõi bạn",
      content: `${followerName} vừa theo dõi bạn${ownerName ? ` (${ownerName})` : ""}.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    });
  }

  const freshShop = await ShopProfile.findById(shop._id).lean();
  const freshCurrent = await User.findById(currentUser._id).lean();
  const freshOwner = shop.userId
    ? await User.findById(shop.userId).lean()
    : null;

  return {
    isFollowing: true,
    followId: followDoc?._id ? String(followDoc._id) : "",
    shopId: String(shop._id),
    shop: toClientShopCard(freshShop || shop, {}, freshOwner),
    followersCount:
      Number(freshOwner?.FollowersCount) || Number(freshShop?.followersCount) || 0,
    followingCount: Number(freshCurrent?.FollowingCount) || 0,
  };
}

async function unfollowShop(currentUser, payload = {}) {
  const shopId = await resolveShopId(payload);
  const shop = await ShopProfile.findById(shopId).lean();
  const userObjectId = toObjectId(currentUser._id);
  const shopObjectId = toObjectId(shopId);

  if (!userObjectId || !shopObjectId) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  let removed = null;
  let removedLegacy = null;

  await runInOptionalTransaction(async (session) => {
    const options = session ? { session } : undefined;
    removed = await ShopFollow.findOneAndDelete(
      {
        userId: userObjectId,
        shopId: shopObjectId,
      },
      options
    );

    if (shop?.userId) {
      removedLegacy = await LegacyUserFollow.findOneAndDelete(
        {
          userId: userObjectId,
          followedUserId: shop.userId,
        },
        options
      );
    }

    if (!removed && !removedLegacy) {
      // Idempotent: coi như đã hủy — đồng bộ đếm nếu cần.
      return;
    }

    const now = new Date();
    await User.updateOne(
      { _id: userObjectId, FollowingCount: { $gt: 0 } },
      { $inc: { FollowingCount: -1 }, $set: { UpdatedAt: now } },
      options
    );
    await ShopProfile.updateOne(
      { _id: shopObjectId, followersCount: { $gt: 0 } },
      { $inc: { followersCount: -1 }, $set: { UpdatedAt: now } },
      options
    );
    if (shop?.userId) {
      await User.updateOne(
        { _id: shop.userId, FollowersCount: { $gt: 0 } },
        { $inc: { FollowersCount: -1 }, $set: { UpdatedAt: now } },
        options
      );
    }
  });

  const freshShop = await ShopProfile.findById(shopId).lean();
  const freshCurrent = await User.findById(currentUser._id).lean();
  const freshOwner = shop?.userId ? await User.findById(shop.userId).lean() : null;

  return {
    isFollowing: false,
    shopId: String(shopId),
    shop: freshShop ? toClientShopCard(freshShop, {}, freshOwner) : null,
    followersCount:
      Number(freshOwner?.FollowersCount) || Number(freshShop?.followersCount) || 0,
    followingCount: Number(freshCurrent?.FollowingCount) || 0,
  };
}

async function getFollowStatus(currentUser, payload = {}) {
  const shopId = await resolveShopId(payload);
  const shop = await ShopProfile.findById(shopId).select("followersCount userId").lean();
  const userObjectId = toObjectId(currentUser._id);
  const shopObjectId = toObjectId(shopId);

  let isFollowing = Boolean(
    userObjectId &&
      shopObjectId &&
      (await ShopFollow.exists({
        userId: userObjectId,
        shopId: shopObjectId,
      }))
  );

  // Legacy userfollows: coi như đang follow shop của seller đó.
  if (!isFollowing && shop?.userId && userObjectId) {
    isFollowing = Boolean(
      await LegacyUserFollow.exists({
        userId: userObjectId,
        followedUserId: shop.userId,
      })
    );
  }

  const owner = shop?.userId
    ? await User.findById(shop.userId).select("FollowersCount").lean()
    : null;

  return {
    shopId: String(shopId),
    isFollowing,
    followersCount:
      Number(owner?.FollowersCount) || Number(shop?.followersCount) || 0,
  };
}

async function listFollowing(currentUser, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q).toLowerCase();
  const userObjectId = toObjectId(currentUser._id);

  const filter = { userId: userObjectId || currentUser._id };
  const [rows, total] = await Promise.all([
    ShopFollow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ShopFollow.countDocuments(filter),
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
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } })
        .select("FullName UserName Avatar FollowersCount")
        .lean()
    : [];
  const ownerById = new Map(owners.map((owner) => [String(owner._id), owner]));

  let items = rows
    .map((row) => {
      const shop = shopById.get(String(row.shopId));
      if (!shop) {
        return null;
      }
      const owner = ownerById.get(String(shop.userId));
      return toClientShopCard(
        shop,
        {
          followedAt: row.CreatedAt,
          isFollowing: true,
        },
        owner
      );
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.shopName} ${item.shopUsername} ${item.fullName} ${item.userName}`.toLowerCase();
      return haystack.includes(search);
    });
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
  const search = pickString(query.search || query.q).toLowerCase();
  let shopId = pickString(query.shopId);

  if (!shopId) {
    const ownShop = await ShopProfile.findOne({ userId: currentUser._id })
      .sort({ CreatedAt: -1 })
      .select("_id")
      .lean();
    shopId = ownShop?._id ? String(ownShop._id) : "";
  }

  if (!shopId) {
    throw createServiceError("Thiếu shopId.", 400);
  }
  if (!isStrictMongoObjectId(shopId)) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  const shop = await ShopProfile.findById(shopId).select("userId").lean();
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  if (String(shop.userId) !== String(currentUser._id)) {
    throw createServiceError("Chỉ chủ gian hàng mới xem được danh sách người theo dõi.", 403);
  }

  const shopObjectId = toObjectId(shopId);
  const filter = { shopId: shopObjectId || shopId };
  const [rows, total] = await Promise.all([
    ShopFollow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ShopFollow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds }, Status: { $ne: USER_STATUS.BLOCKED } }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.userId));
      if (!user) {
        return null;
      }
      return toClientFollowerCard(user, {
        followedAt: row.CreatedAt,
      });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.fullName} ${item.userName}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  return {
    shopId: String(shopId),
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
  followShop,
  unfollowShop,
  followUser,
  unfollowUser,
  getFollowStatus,
  listFollowing,
  listFollowers,
};
