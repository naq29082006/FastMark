const mongoose = require("mongoose");
const FavoriteShop = require("../models/FavoriteShop");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SHOP_STATUS, SHOP_OPEN } = require("../constants/shopStatus");
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

function pickShopAddress(shop) {
  return (
    pickString(shop?.DiaChiHeThong) ||
    pickString(shop?.address) ||
    pickString(shop?.description) ||
    ""
  );
}

function toClientFavoriteShop({ favorite, shop, seller }) {
  return {
    id: String(favorite._id),
    shopId: String(shop?._id || favorite.shopId),
    sellerUserId: shop?.userId ? String(shop.userId) : "",
    name: pickString(shop?.shopName) || pickString(seller?.UserName) || "Gian hàng",
    logo: pickString(shop?.avatar) || "",
    address: pickShopAddress(shop),
    rating: Number(shop?.averageRating) || 0,
    totalReviews: Number(shop?.totalReviews) || 0,
    totalProducts: Number(shop?.totalProducts) || 0,
    totalLikes: Number(shop?.totalLikes) || 0,
    isOpen: Number(shop?.isOpen) === SHOP_OPEN.OPEN,
    isOpenStatus: Number(shop?.isOpen) === SHOP_OPEN.OPEN ? 1 : 0,
    status: Number(shop?.status) || 0,
    savedAt: favorite.CreatedAt,
  };
}

function activeShopFilter(extra = {}) {
  return {
    ...extra,
    status: SHOP_STATUS.ACTIVE,
  };
}

async function listFavoriteShopIds(user) {
  const rows = await FavoriteShop.find({ userId: user._id }).select("shopId").lean();
  return rows.map((row) => String(row.shopId));
}

async function getFavoriteShopStatus(user, shopId) {
  const normalizedId = pickString(shopId);
  if (!isStrictMongoObjectId(normalizedId)) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  const isFavorite = Boolean(
    await FavoriteShop.exists({
      userId: user._id,
      shopId: normalizedId,
    })
  );

  const shop = await ShopProfile.findById(normalizedId).select("totalLikes").lean();
  return {
    shopId: normalizedId,
    isFavorite,
    totalLikes: Number(shop?.totalLikes) || 0,
  };
}

async function listFavoriteShops(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q).toLowerCase();
  const isOpenFilter = pickString(query.isOpen || query.open);
  const sort = pickString(query.sort || "newest").toLowerCase();

  const rows = await FavoriteShop.find({ userId: user._id }).sort({ CreatedAt: -1 }).lean();
  if (rows.length === 0) {
    return {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    };
  }

  const shopIds = rows.map((row) => row.shopId);
  const shops = await ShopProfile.find({ _id: { $in: shopIds } }).lean();
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));

  const sellerIds = [...new Set(shops.map((shop) => String(shop.userId)).filter(Boolean))];
  const sellers = sellerIds.length
    ? await User.find({
        _id: { $in: sellerIds },
        Status: { $ne: USER_STATUS.BLOCKED },
      }).lean()
    : [];
  const sellerById = new Map(sellers.map((seller) => [String(seller._id), seller]));

  let items = rows
    .map((favorite) => {
      const shop = shopById.get(String(favorite.shopId));
      if (!shop) {
        return null;
      }
      const seller = sellerById.get(String(shop.userId));
      return toClientFavoriteShop({ favorite, shop, seller });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.name} ${item.address}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  if (isOpenFilter === "1" || isOpenFilter === "true" || isOpenFilter === "open") {
    items = items.filter((item) => item.isOpen);
  } else if (isOpenFilter === "0" || isOpenFilter === "false" || isOpenFilter === "closed") {
    items = items.filter((item) => !item.isOpen);
  }

  if (sort === "rating" || sort === "rating_desc") {
    items.sort((a, b) => b.rating - a.rating || b.totalLikes - a.totalLikes);
  } else if (sort === "products" || sort === "products_desc") {
    items.sort((a, b) => b.totalProducts - a.totalProducts);
  } else if (sort === "likes" || sort === "likes_desc") {
    items.sort((a, b) => b.totalLikes - a.totalLikes);
  } else if (sort === "name") {
    items.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } else {
    items.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  }

  const total = items.length;
  const paged = items.slice(skip, skip + limit);

  return {
    items: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function addFavoriteShop(user, shopId) {
  const normalizedId = pickString(shopId);
  if (!isStrictMongoObjectId(normalizedId)) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  const shop = await ShopProfile.findOne(activeShopFilter({ _id: normalizedId }));
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  if (String(shop.userId) === String(user._id)) {
    throw createServiceError("Không thể yêu thích gian hàng của chính bạn.", 400);
  }

  const existing = await FavoriteShop.findOne({
    userId: user._id,
    shopId: shop._id,
  });
  if (existing) {
    const seller = shop.userId ? await User.findById(shop.userId).lean() : null;
    return toClientFavoriteShop({ favorite: existing, shop, seller });
  }

  const session = await mongoose.startSession();
  let favorite = null;

  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const [created] = await FavoriteShop.create(
        [
          {
            userId: user._id,
            shopId: shop._id,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        { session }
      );
      favorite = created;

      await ShopProfile.updateOne(
        { _id: shop._id },
        { $inc: { totalLikes: 1 }, $set: { UpdatedAt: now } },
        { session }
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existingDup = await FavoriteShop.findOne({
        userId: user._id,
        shopId: shop._id,
      });
      const seller = shop.userId ? await User.findById(shop.userId).lean() : null;
      return toClientFavoriteShop({ favorite: existingDup, shop, seller });
    }
    throw error;
  } finally {
    session.endSession();
  }

  const freshShop = await ShopProfile.findById(shop._id).lean();
  const seller = shop.userId ? await User.findById(shop.userId).lean() : null;

  if (seller?._id && String(seller._id) !== String(user._id)) {
    const buyerName = user.FullName || user.UserName || "Một người mua";
    const shopName = freshShop?.shopName || shop.shopName || "gian hàng";
    await createNotification(seller._id, {
      title: "Gian hàng được yêu thích",
      content: `${buyerName} đã yêu thích "${shopName}".`,
    });
  }

  return toClientFavoriteShop({ favorite, shop: freshShop || shop, seller });
}

async function removeFavoriteShop(user, shopId) {
  const normalizedId = pickString(shopId);
  if (!isStrictMongoObjectId(normalizedId)) {
    throw createServiceError("Mã gian hàng không hợp lệ.", 400);
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const removed = await FavoriteShop.findOneAndDelete(
        {
          userId: user._id,
          shopId: normalizedId,
        },
        { session }
      );

      if (!removed) {
        throw createServiceError("Gian hàng chưa có trong danh sách yêu thích.", 404);
      }

      const now = new Date();
      await ShopProfile.updateOne(
        { _id: normalizedId, totalLikes: { $gt: 0 } },
        { $inc: { totalLikes: -1 }, $set: { UpdatedAt: now } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  const shop = await ShopProfile.findById(normalizedId).select("totalLikes").lean();
  return {
    shopId: normalizedId,
    totalLikes: Number(shop?.totalLikes) || 0,
  };
}

module.exports = {
  listFavoriteShops,
  listFavoriteShopIds,
  getFavoriteShopStatus,
  addFavoriteShop,
  removeFavoriteShop,
};
