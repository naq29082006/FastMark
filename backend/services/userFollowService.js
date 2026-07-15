const mongoose = require("mongoose");
const User = require("../models/User");
const UserFollow = require("../models/UserFollow");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE } = require("../constants/sellerVerification");
const { USER_STATUS } = require("../constants/userStatus");
const { createNotification } = require("./notificationService");

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

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function resolveSellerUserId({ sellerUserId, shopId, userId }) {
  const directId = pickString(sellerUserId || userId);
  if (directId) {
    if (!isStrictMongoObjectId(directId)) {
      throw createServiceError("Mã người bán không hợp lệ.", 400);
    }
    return directId;
  }

  const normalizedShopId = pickString(shopId);
  if (!normalizedShopId) {
    throw createServiceError("Thiếu sellerUserId hoặc shopId.", 400);
  }
  if (!isStrictMongoObjectId(normalizedShopId)) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  const shop = await ShopProfile.findById(normalizedShopId).select("userId").lean();
  if (!shop?.userId) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  return String(shop.userId);
}

function toClientUserCard(user, shop = null, extra = {}) {
  return {
    id: String(user._id),
    userName: user.UserName || "",
    fullName: user.FullName || "",
    avatar: user.Avatar || "",
    role: Number(user.Role) || USER_ROLE.BUYER,
    followersCount: Number(user.FollowersCount) || 0,
    followingCount: Number(user.FollowingCount) || 0,
    shopId: shop?._id ? String(shop._id) : "",
    shopName: shop?.shopName || "",
    shopAvatar: shop?.avatar || "",
    ...extra,
  };
}

async function assertFollowableSeller(targetUserId, currentUserId) {
  if (String(targetUserId) === String(currentUserId)) {
    throw createServiceError("Không thể theo dõi chính mình.", 400);
  }

  const target = await User.findById(targetUserId);
  if (!target || Number(target.Status) === USER_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy người bán.", 404);
  }

  if (Number(target.Role) !== USER_ROLE.SELLER) {
    throw createServiceError("Chỉ được theo dõi tài khoản người bán.", 400);
  }

  return target;
}

async function followUser(currentUser, payload = {}) {
  const targetUserId = await resolveSellerUserId(payload);
  const target = await assertFollowableSeller(targetUserId, currentUser._id);

  const existing = await UserFollow.findOne({
    userId: currentUser._id,
    followedUserId: target._id,
  });

  if (existing) {
    throw createServiceError("Bạn đã theo dõi người bán này.", 409);
  }

  const session = await mongoose.startSession();
  let followDoc = null;

  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const [created] = await UserFollow.create(
        [
          {
            userId: currentUser._id,
            followedUserId: target._id,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        { session }
      );
      followDoc = created;

      await User.updateOne(
        { _id: currentUser._id },
        { $inc: { FollowingCount: 1 }, $set: { UpdatedAt: now } },
        { session }
      );
      await User.updateOne(
        { _id: target._id },
        { $inc: { FollowersCount: 1 }, $set: { UpdatedAt: now } },
        { session }
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw createServiceError("Bạn đã theo dõi người bán này.", 409);
    }
    throw error;
  } finally {
    session.endSession();
  }

  const followerName = currentUser.FullName || currentUser.UserName || "Một người mua";
  await createNotification(target._id, {
    title: "Có người theo dõi bạn",
    content: `${followerName} vừa theo dõi bạn trên FastMark.`,
  });

  const shop = await ShopProfile.findOne({ userId: target._id }).lean();
  const freshTarget = await User.findById(target._id).lean();
  const freshCurrent = await User.findById(currentUser._id).lean();

  return {
    isFollowing: true,
    followId: String(followDoc._id),
    seller: toClientUserCard(freshTarget || target, shop),
    followersCount: Number(freshTarget?.FollowersCount) || 0,
    followingCount: Number(freshCurrent?.FollowingCount) || 0,
  };
}

async function unfollowUser(currentUser, payload = {}) {
  const targetUserId = await resolveSellerUserId(payload);

  if (String(targetUserId) === String(currentUser._id)) {
    throw createServiceError("Không thể bỏ theo dõi chính mình.", 400);
  }

  const session = await mongoose.startSession();
  let removed = null;

  try {
    await session.withTransaction(async () => {
      removed = await UserFollow.findOneAndDelete(
        {
          userId: currentUser._id,
          followedUserId: targetUserId,
        },
        { session }
      );

      if (!removed) {
        throw createServiceError("Bạn chưa theo dõi người bán này.", 404);
      }

      const now = new Date();
      await User.updateOne(
        { _id: currentUser._id, FollowingCount: { $gt: 0 } },
        { $inc: { FollowingCount: -1 }, $set: { UpdatedAt: now } },
        { session }
      );
      await User.updateOne(
        { _id: targetUserId, FollowersCount: { $gt: 0 } },
        { $inc: { FollowersCount: -1 }, $set: { UpdatedAt: now } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  const shop = await ShopProfile.findOne({ userId: targetUserId }).lean();
  const freshTarget = await User.findById(targetUserId).lean();
  const freshCurrent = await User.findById(currentUser._id).lean();

  return {
    isFollowing: false,
    sellerUserId: String(targetUserId),
    seller: freshTarget ? toClientUserCard(freshTarget, shop) : null,
    followersCount: Number(freshTarget?.FollowersCount) || 0,
    followingCount: Number(freshCurrent?.FollowingCount) || 0,
  };
}

async function getFollowStatus(currentUser, payload = {}) {
  const targetUserId = await resolveSellerUserId(payload);
  const isFollowing = Boolean(
    await UserFollow.exists({
      userId: currentUser._id,
      followedUserId: targetUserId,
    })
  );

  const target = await User.findById(targetUserId).select("FollowersCount Role").lean();
  return {
    sellerUserId: String(targetUserId),
    isFollowing,
    followersCount: Number(target?.FollowersCount) || 0,
  };
}

async function listFollowing(currentUser, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q).toLowerCase();

  const filter = { userId: currentUser._id };
  const [rows, total] = await Promise.all([
    UserFollow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    UserFollow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.followedUserId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds }, Status: { $ne: USER_STATUS.BLOCKED } }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  const shops = userIds.length
    ? await ShopProfile.find({ userId: { $in: userIds } }).lean()
    : [];
  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followedUserId));
      if (!user) {
        return null;
      }
      return toClientUserCard(user, shopByUserId.get(String(user._id)), {
        followedAt: row.CreatedAt,
        isFollowing: true,
      });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.fullName} ${item.userName} ${item.shopName}`.toLowerCase();
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
  const targetUserId = pickString(query.userId || query.sellerUserId) || String(currentUser._id);

  if (!isStrictMongoObjectId(targetUserId)) {
    throw createServiceError("Mã người dùng không hợp lệ.", 400);
  }

  const filter = { followedUserId: targetUserId };
  const [rows, total] = await Promise.all([
    UserFollow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    UserFollow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds }, Status: { $ne: USER_STATUS.BLOCKED } }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  const myFollows = userIds.length
    ? await UserFollow.find({
        userId: currentUser._id,
        followedUserId: { $in: userIds },
      })
        .select("followedUserId")
        .lean()
    : [];
  const followingSet = new Set(myFollows.map((row) => String(row.followedUserId)));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.userId));
      if (!user) {
        return null;
      }
      return toClientUserCard(user, null, {
        followedAt: row.CreatedAt,
        isFollowing: followingSet.has(String(user._id)),
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
  followUser,
  unfollowUser,
  getFollowStatus,
  listFollowing,
  listFollowers,
};
