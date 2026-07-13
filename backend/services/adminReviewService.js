const Review = require("../models/Review");
const BuyerReview = require("../models/BuyerReview");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");

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

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function pickShopDisplayName(shop) {
  if (!shop) {
    return "";
  }
  return pickString(shop.shopName) || pickString(shop.description);
}

function extractBuyerReviewId(externalId) {
  const normalized = pickString(externalId);
  if (!normalized.startsWith("buyer-")) {
    return "";
  }
  return normalized.slice("buyer-".length);
}

async function loadShopNameMap(storeIds) {
  const uniqueIds = [...new Set(storeIds.filter(Boolean).map(String))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const objectIds = uniqueIds.filter(isStrictMongoObjectId);
  const externalIds = uniqueIds.filter((id) => !isStrictMongoObjectId(id));
  const query = [];

  if (objectIds.length) {
    query.push({ _id: { $in: objectIds } });
  }
  if (externalIds.length) {
    query.push({ externalRestaurantId: { $in: externalIds } });
  }

  const shops = query.length ? await ShopProfile.find({ $or: query }).lean() : [];
  const shopNameByKey = new Map();

  shops.forEach((shop) => {
    const displayName = pickShopDisplayName(shop);
    if (!displayName) {
      return;
    }
    shopNameByKey.set(String(shop._id), displayName);
    if (shop.externalRestaurantId) {
      shopNameByKey.set(String(shop.externalRestaurantId), displayName);
    }
  });

  return shopNameByKey;
}

function resolveShopName(storeId, shopNameByKey) {
  const normalized = pickString(storeId);
  if (!normalized) {
    return "";
  }
  return shopNameByKey.get(normalized) || "";
}

function toReviewerSummary(user, fallbackName = "") {
  if (user) {
    return {
      fullName: pickString(user.FullName) || pickString(user.UserName) || fallbackName || "Khách hàng",
      email: pickString(user.Email),
      userName: pickString(user.UserName),
    };
  }

  return {
    fullName: fallbackName || "Khách hàng",
    email: "",
    userName: "",
  };
}

async function buildReviewFilter({ search, rating, status }) {
  const filter = {
    is_deleted: { $ne: true },
    externalId: { $not: /^seed-admin-review/i },
  };
  const normalizedRating = pickString(rating);
  const normalizedStatus = pickString(status);
  const keyword = pickString(search);

  if (normalizedRating !== "" && Number(normalizedRating) >= 1 && Number(normalizedRating) <= 5) {
    filter.rating = Number(normalizedRating);
  }

  if (normalizedStatus === "visible") {
    filter.is_hidden = { $ne: true };
  } else if (normalizedStatus === "hidden") {
    filter.is_hidden = true;
  }

  if (!keyword) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(keyword), "i");
  const [matchedUsers, matchedBuyerReviews, matchedShops] = await Promise.all([
    User.find({
      $or: [{ UserName: regex }, { FullName: regex }, { Email: regex }],
    })
      .select("_id")
      .lean(),
    BuyerReview.find({
      $or: [{ productName: regex }, { storeName: regex }, { comment: regex }],
    })
      .select("_id")
      .lean(),
    ShopProfile.find({
      $or: [{ shopName: regex }, { description: regex }, { externalRestaurantId: regex }],
    })
      .select("_id externalRestaurantId")
      .lean(),
  ]);

  const userIds = matchedUsers.map((user) => user._id);
  const buyerExternalIds = matchedBuyerReviews.map((row) => `buyer-${row._id}`);
  const storeIds = matchedShops.flatMap((shop) =>
    [String(shop._id), shop.externalRestaurantId].filter(Boolean)
  );

  const buyerReviewsByUser =
    userIds.length > 0
      ? await BuyerReview.find({ userId: { $in: userIds } }).select("_id").lean()
      : [];
  buyerReviewsByUser.forEach((row) => buyerExternalIds.push(`buyer-${row._id}`));

  filter.$or = [
    { comment: regex },
    { user_name: regex },
    ...(buyerExternalIds.length ? [{ externalId: { $in: [...new Set(buyerExternalIds)] } }] : []),
    ...(storeIds.length ? [{ store_id: { $in: [...new Set(storeIds)] } }] : []),
  ];

  return filter;
}

async function enrichReviews(reviews) {
  const buyerReviewIds = reviews
    .map((review) => extractBuyerReviewId(review.externalId))
    .filter(Boolean);

  const buyerReviews = buyerReviewIds.length
    ? await BuyerReview.find({ _id: { $in: buyerReviewIds } }).lean()
    : [];
  const buyerReviewById = new Map(buyerReviews.map((row) => [String(row._id), row]));

  const userIds = buyerReviews.map((row) => row.userId).filter(Boolean);
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).lean() : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  const storeIds = reviews.map((review) => review.store_id).filter(Boolean);
  const shopNameByKey = await loadShopNameMap(storeIds);

  return reviews.map((review) => {
    const buyerReview = buyerReviewById.get(extractBuyerReviewId(review.externalId));
    const user = buyerReview?.userId ? userById.get(String(buyerReview.userId)) : null;
    const shopName =
      pickString(buyerReview?.storeName) || resolveShopName(review.store_id, shopNameByKey);

    return {
      id: review.externalId,
      reviewer: toReviewerSummary(user, review.user_name),
      productName: pickString(buyerReview?.productName) || "—",
      shopName: shopName || "—",
      rating: review.rating,
      comment: review.comment || "",
      createdAt: review.created_at || review.createdAt || null,
      isHidden: Boolean(review.is_hidden),
      deletedAt: review.deleted_at || null,
    };
  });
}

async function listReviews({
  search = "",
  rating = "",
  status = "",
  page = 1,
  limit = 20,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;
  const filter = await buildReviewFilter({ search, rating, status });

  const [reviews, total] = await Promise.all([
    Review.find(filter).sort({ created_at: -1, createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Review.countDocuments(filter),
  ]);

  const items = await enrichReviews(reviews);

  return {
    items,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    meta: {
      dataSource: "mongodb",
      collection: "reviews",
    },
  };
}

async function findReviewByExternalId(externalId) {
  const review = await Review.findOne({ externalId: pickString(externalId) });
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }
  return review;
}

async function setReviewVisibility(externalId, isHidden) {
  const review = await findReviewByExternalId(externalId);
  if (review.is_deleted) {
    throw createServiceError("Đánh giá đã bị xóa mềm.", 400);
  }

  review.is_hidden = Boolean(isHidden);
  await review.save();

  const [item] = await enrichReviews([review.toObject()]);
  return item;
}

async function softDeleteReview(externalId) {
  const review = await findReviewByExternalId(externalId);
  if (review.is_deleted) {
    throw createServiceError("Đánh giá đã bị xóa mềm.", 400);
  }

  const now = new Date();
  review.is_deleted = true;
  review.is_hidden = true;
  review.deleted_at = now;
  await review.save();

  return { id: review.externalId, deletedAt: now };
}

module.exports = {
  listReviews,
  setReviewVisibility,
  softDeleteReview,
};
