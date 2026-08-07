const mongoose = require("mongoose");
const Review = require("../models/Review");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const { NOTIFICATION_AUDIENCE, NOTIFICATION_INDEX } = require("../constants");
const {
  isReviewSoftDeleted,
  isReviewHidden,
  notDeletedReviewFilter,
  notAdminHiddenReviewFilter,
  adminHiddenReviewFilter,
  markReviewAdminHidden,
  markReviewAdminDeleted,
  clearReviewRemoval,
  toAdminReviewRemovalFields,
} = require("../utils/reviewRemoval");
const { refreshShopReviewStats, loadReviewImagesMap } = require("./buyerReviewService");
const { createNotification } = require("./notificationService");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");
const { resolveShopDisplayName, resolveShopUsername, resolveShopAvatar } = require("../utils/shopIdentity");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendUniqueOrConditions,
  resolveStatusesFromLabelSearch,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function toReviewerSummary(user, fallbackName = "") {
  if (!user) {
    return {
      fullName: fallbackName || "Khách hàng",
      email: "",
      userName: "",
    };
  }

  return {
    fullName: user.FullName || fallbackName || "Khách hàng",
    email: user.Email || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
  };
}

async function buildReviewFilter({ search, rating, status, productId, from, to }) {
  const filter = {
    ...notDeletedReviewFilter(),
  };
  const normalizedRating = pickString(rating);
  const normalizedStatus = pickString(status);
  const keyword = pickString(search);
  const normalizedProductId = pickString(productId);

  if (normalizedProductId && mongoose.Types.ObjectId.isValid(normalizedProductId)) {
    filter.productId = new mongoose.Types.ObjectId(normalizedProductId);
    applyCreatedAtRange(filter, { from, to });
    return filter;
  }

  if (normalizedRating !== "" && Number(normalizedRating) >= 1 && Number(normalizedRating) <= 5) {
    filter.rating = Number(normalizedRating);
  }

  if (normalizedStatus === "visible") {
    filter.$and = [...(filter.$and || []), notAdminHiddenReviewFilter()];
  } else if (normalizedStatus === "hidden") {
    filter.$and = [...(filter.$and || []), adminHiddenReviewFilter()];
  }

  if (!keyword) {
    applyCreatedAtRange(filter, { from, to });
    return filter;
  }

  const regex = buildSearchRegex(keyword);
  const orConditions = [];

  if (regex) {
    const [matchedUsers, matchedShops, matchedProducts] = await Promise.all([
      findUsersBySearchRegex(User, regex, ["UserName", "FullName", "Email"]),
      ShopProfile.find({
        $or: [{ shopName: regex }, { description: regex }],
      })
        .select("_id")
        .lean(),
      Product.find({ ProductName: regex }).select("_id").lean(),
    ]);

    const userIds = matchedUsers.map((user) => user._id);
    const shopIds = matchedShops.map((shop) => shop._id);
    const productIds = matchedProducts.map((product) => product._id);

    orConditions.push(
      { comment: regex },
      ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ...(shopIds.length ? [{ shopId: { $in: shopIds } }] : []),
      ...(productIds.length ? [{ productId: { $in: productIds } }] : [])
    );
  }

  const matchedVisibility = resolveStatusesFromLabelSearch(keyword, [
    { label: "Hiển thị", statuses: [0] },
    { label: "Đang hiển thị", statuses: [0] },
    { label: "Ẩn", statuses: [1] },
    { label: "Đã ẩn", statuses: [1] },
  ]);
  if (matchedVisibility.includes(0)) {
    orConditions.push(notAdminHiddenReviewFilter());
  }
  if (matchedVisibility.includes(1)) {
    orConditions.push(adminHiddenReviewFilter());
  }

  orConditions.push(...buildObjectIdSearchConditions(keyword));

  if (orConditions.length) {
    appendUniqueOrConditions(filter, orConditions);
  }

  applyCreatedAtRange(filter, { from, to });
  return filter;
}

async function enrichReviews(reviews) {
  const userIds = reviews.map((row) => row.userId).filter(Boolean);
  const shopIds = reviews.map((row) => row.shopId).filter(Boolean);
  const productIds = reviews.map((row) => row.productId).filter(Boolean);
  const reviewIds = reviews.map((row) => row._id).filter(Boolean);

  const [users, shops, products, imagesByReview] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).lean() : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } })
          .select("shopName shopUsername avatar userId")
          .lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
    loadReviewImagesMap(reviewIds),
  ]);

  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } }).select("FullName UserName Avatar").lean()
    : [];
  const ownerById = new Map(owners.map((user) => [String(user._id), user]));

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));
  const productById = new Map(products.map((product) => [String(product._id), product]));

  return reviews.map((review) => {
    const user = review.userId ? userById.get(String(review.userId)) : null;
    const shop = review.shopId ? shopById.get(String(review.shopId)) : null;
    const shopOwner = shop?.userId ? ownerById.get(String(shop.userId)) : null;
    const product = review.productId ? productById.get(String(review.productId)) : null;
    const images = imagesByReview.get(String(review._id)) || [];

    const removal = toAdminReviewRemovalFields(review);

    return {
      id: String(review._id),
      reviewer: toReviewerSummary(user),
      shopId: review.shopId ? String(review.shopId) : "",
      shopName: resolveShopDisplayName(shop, shopOwner),
      shopUsername: resolveShopUsername(shop, shopOwner),
      shopAvatar: resolveShopAvatar(shop, shopOwner),
      productId: review.productId ? String(review.productId) : "",
      productName: product?.ProductName || "—",
      reservationId: review.reservationId ? String(review.reservationId) : "",
      rating: review.rating,
      comment: review.comment || "",
      images,
      imageUrl: images[0]?.imageUrl || "",
      createdAt: review.CreatedAt || null,
      ...removal,
    };
  });
}

async function listReviews({
  page = 1,
  limit = 20,
  search = "",
  rating = "",
  status = "",
  productId = "",
  from = "",
  to = "",
} = {}) {
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
  const pageNumber = Math.max(1, Number(page) || 1);
  const skip = (pageNumber - 1) * pageSize;
  const filter = await buildReviewFilter({ search, rating, status, productId, from, to });

  const [reviews, total] = await Promise.all([
    Review.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    Review.countDocuments(filter),
  ]);

  const items = await enrichReviews(reviews);

  return {
    items,
    pagination: {
      page: pageNumber,
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

async function findReviewByPublicId(publicId) {
  const normalized = pickString(publicId);
  if (!normalized || !isStrictMongoObjectId(normalized)) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const review = await Review.findById(normalized);
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }
  return review;
}

async function resolveReviewProductLabel(review) {
  if (!review?.productId) {
    return "sản phẩm";
  }
  const product = await Product.findById(review.productId).select("ProductName").lean();
  const name = pickString(product?.ProductName);
  return name || "sản phẩm";
}

async function notifyReviewerReviewModerated(review, action, reason = "") {
  if (!review?.userId) {
    return;
  }

  const productLabel = await resolveReviewProductLabel(review);
  const target = `«${productLabel}»`;
  const reasonText = pickString(reason);
  const reasonSuffix = reasonText ? ` Lý do: ${reasonText}` : "";

  if (action === "hidden") {
    await createNotification(review.userId, {
      title: "Đánh giá đã bị ẩn",
      content: `Đánh giá của bạn cho sản phẩm ${target} đã bị ẩn bởi quản trị viên và không còn hiển thị công khai.${reasonSuffix}`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.SYSTEM,
    });
    return;
  }

  if (action === "deleted") {
    await createNotification(review.userId, {
      title: "Đánh giá đã bị xóa",
      content: `Đánh giá của bạn cho sản phẩm ${target} đã bị xóa bởi quản trị viên.${reasonSuffix}`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.SYSTEM,
    });
  }
}

function assertModerationReason(reason) {
  const text = pickString(reason);
  if (!text) {
    throw createServiceError("Vui lòng nhập lý do.");
  }
  return text;
}

async function setReviewVisibility(publicId, isHidden, { reason } = {}) {
  const review = await findReviewByPublicId(publicId);
  if (isReviewSoftDeleted(review)) {
    throw createServiceError("Đánh giá đã bị xóa mềm.", 400);
  }

  const wasHidden = isReviewHidden(review);
  let adminRemovalReason = "";

  if (Boolean(isHidden) && !wasHidden) {
    adminRemovalReason = assertModerationReason(reason);
    markReviewAdminHidden(review, adminRemovalReason);
  } else if (!Boolean(isHidden) && wasHidden) {
    clearReviewRemoval(review);
  }

  review.UpdatedAt = new Date();
  await review.save();
  const shop = await refreshShopReviewStats(review.shopId);

  if (Boolean(isHidden) && !wasHidden) {
    await notifyReviewerReviewModerated(review, "hidden", adminRemovalReason);
  }

  const [item] = await enrichReviews([review.toObject()]);
  const payload = {
    reviewId: String(review._id),
    shopId: review.shopId ? String(review.shopId) : "",
    action: Boolean(isHidden) ? "hidden" : "visible",
    totalReviews: Number(shop?.totalReviews || 0),
    averageRating: Number(shop?.averageRating || 0),
  };
  emitAdminUpdated("review", payload);
  if (shop?.userId) {
    emitUserResourceUpdated(shop.userId, "review", payload);
  }
  if (review.userId) {
    emitUserResourceUpdated(review.userId, "review", payload);
  }
  return item;
}

async function softDeleteReview(publicId, { reason } = {}) {
  const review = await findReviewByPublicId(publicId);
  if (isReviewSoftDeleted(review)) {
    throw createServiceError("Đánh giá đã bị xóa mềm.", 400);
  }

  const adminRemovalReason = assertModerationReason(reason);
  const now = new Date();
  markReviewAdminDeleted(review, adminRemovalReason, now);
  review.UpdatedAt = now;
  await review.save();
  const shop = await refreshShopReviewStats(review.shopId);
  await notifyReviewerReviewModerated(review, "deleted", adminRemovalReason);

  const payload = {
    reviewId: String(review._id),
    shopId: review.shopId ? String(review.shopId) : "",
    action: "deleted",
    totalReviews: Number(shop?.totalReviews || 0),
    averageRating: Number(shop?.averageRating || 0),
  };
  emitAdminUpdated("review", payload);
  if (shop?.userId) {
    emitUserResourceUpdated(shop.userId, "review", payload);
  }
  if (review.userId) {
    emitUserResourceUpdated(review.userId, "review", payload);
  }

  return { id: String(review._id), removedAt: now };
}

async function getReviewDetail(publicId) {
  const review = await findReviewByPublicId(publicId);
  const [item] = await enrichReviews([review.toObject()]);
  if (!item) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }
  return {
    ...item,
    meta: {
      dataSource: "mongodb",
      collection: "reviews",
    },
  };
}

module.exports = {
  listReviews,
  getReviewDetail,
  setReviewVisibility,
  softDeleteReview,
  findReviewByPublicId,
  notifyReviewerReviewModerated,
};
