const crypto = require("crypto");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
  RESERVATION_STATUS,
} = require("../constants");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { createNotification } = require("./notificationService");
const { emitAdminUpdated, emitUserResourceUpdated, emitPublicUpdated } = require("./realtimeService");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const {
  normalizeEmbeddedImages,
  toPublicImageList,
} = require("../utils/embeddedImages");
const {
  isReviewSoftDeleted,
  isReviewHidden,
  notDeletedReviewFilter,
  publicReviewFilter,
  markReviewBuyerDeleted,
  toAdminReviewRemovalFields,
} = require("../utils/reviewRemoval");
const { RECORD_STATUS } = require("../constants");

const REVIEWABLE_STATUSES = [
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.RECEIVED,
];

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

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createServiceError("Vui lòng chọn số sao từ 1 đến 5.");
  }
  return Math.round(rating);
}

async function resolveImageUrl(imageInput) {
  if (imageInput && typeof imageInput === "object") {
    const existing = pickString(imageInput.imageUrl || imageInput.ImageUrl);
    if (existing) {
      return existing;
    }
    const base64 = imageInput.imageBase64 || imageInput.ImageBase64 || imageInput.base64;
    if (base64) {
      return resolveImageUrl(
        String(base64).startsWith("data:")
          ? base64
          : `data:${imageInput.mimeType || "image/jpeg"};base64,${base64}`
      );
    }
  }

  const raw = pickString(imageInput);
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const match = raw.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    return raw;
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "review-images",
    fileName: `review-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${resolveFileExtension(mimeType)}`,
  });
  return uploaded.publicUrl;
}

function collectImageInputs(payload = {}) {
  if (Array.isArray(payload.images) && payload.images.length) {
    return payload.images;
  }
  if (Array.isArray(payload.imageUrls) && payload.imageUrls.length) {
    return payload.imageUrls;
  }
  const single =
    payload.imageUrl ||
    payload.image_url ||
    payload.imageContent ||
    payload.imageUri ||
    null;
  return single ? [single] : [];
}

async function resolveReviewImageUrls(reviewId, imageInputs = []) {
  const urls = [];
  for (let index = 0; index < imageInputs.length; index += 1) {
    const url = await resolveImageUrl(imageInputs[index]);
    if (url) {
      urls.push(url);
    }
  }
  return normalizeEmbeddedImages(urls);
}

async function replaceReviewImages(reviewId, imageInputs = []) {
  const urls = await resolveReviewImageUrls(reviewId, imageInputs);
  await Review.updateOne(
    { _id: reviewId },
    { $set: { images: urls, UpdatedAt: new Date() } }
  );
  return toPublicImageList(urls);
}

async function loadReviewImagesMap(reviewIds = []) {
  if (!reviewIds.length) {
    return new Map();
  }
  const rows = await Review.find({ _id: { $in: reviewIds } }).select("images").lean();
  return rows.reduce((map, row) => {
    map.set(String(row._id), toPublicImageList(row.images || []));
    return map;
  }, new Map());
}

async function toPublicReview(review, extras = {}) {
  const user =
    extras.user ||
    (review.userId
      ? await User.findById(review.userId).select("FullName UserName Avatar").lean()
      : null);
  const product =
    extras.product ||
    (review.productId
      ? await Product.findById(review.productId).select("ProductName").lean()
      : null);
  const shop =
    extras.shop ||
    (review.shopId ? await ShopProfile.findById(review.shopId).select("shopName").lean() : null);
  const images =
    extras.images ||
    (await loadReviewImagesMap([review._id])).get(String(review._id)) ||
    [];

  const userName = pickString(user?.FullName) || pickString(user?.UserName) || "Khách hàng";
  const avatar = pickString(user?.Avatar);
  const productName = pickString(product?.ProductName);
  let shopName = pickString(shop?.shopName);
  if (!shopName && shop?.userId) {
    const owner =
      extras.shopOwner ||
      (await User.findById(shop.userId).select("FullName UserName").lean());
    shopName = pickString(owner?.FullName) || pickString(owner?.UserName);
  }
  if (!shopName) {
    shopName = pickString(shop?.description);
  }
  const imageUrl = images[0]?.imageUrl || "";

  return {
    id: String(review._id),
    userId: review.userId ? String(review.userId) : "",
    shopId: review.shopId ? String(review.shopId) : "",
    storeId: review.shopId ? String(review.shopId) : "",
    store_id: review.shopId ? String(review.shopId) : "",
    storeName: shopName,
    productId: review.productId ? String(review.productId) : "",
    productName,
    reservationId: review.reservationId ? String(review.reservationId) : "",
    orderCode: review.reservationId ? String(review.reservationId) : "",
    userName,
    user_name: userName,
    avatar,
    photoUrl: avatar,
    rating: review.rating,
    comment: review.comment || "",
    images,
    imageUrl,
    image_url: imageUrl,
    createdAt: review.CreatedAt || null,
    created_at: review.CreatedAt || null,
    ...toAdminReviewRemovalFields(review),
  };
}

async function refreshShopReviewStats(shopId) {
  const id = pickString(shopId);
  if (!id || !isStrictMongoObjectId(id)) {
    return null;
  }

  const shop = await ShopProfile.findById(id);
  if (!shop) {
    return null;
  }

  const reviews = await Review.find({
    shopId: id,
    ...publicReviewFilter(),
  }).lean();

  const total = reviews.length;
  const diemTB =
    total > 0
      ? Math.round((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / total) * 10) /
        10
      : 0;

  shop.tongDG = total;
  shop.diemTB = diemTB;
  shop.UpdatedAt = new Date();
  await shop.save();
  return shop;
}

function buildReviewRealtimePayload(review, shop = null, extras = {}) {
  return {
    reviewId: review?._id ? String(review._id) : String(extras.reviewId || ""),
    shopId: review?.shopId ? String(review.shopId) : String(extras.shopId || ""),
    productId: review?.productId ? String(review.productId) : String(extras.productId || ""),
    reservationId: review?.reservationId
      ? String(review.reservationId)
      : String(extras.reservationId || ""),
    rating: Number(review?.rating || extras.rating || 0),
    tongDG: Number(shop?.tongDG || 0),
    diemTB: Number(shop?.diemTB || 0),
    action: extras.action || "updated",
  };
}

async function emitReviewRealtime(review, shop = null, extras = {}) {
  const payload = buildReviewRealtimePayload(review, shop, extras);
  emitAdminUpdated("review", payload);
  emitPublicUpdated("review", payload);

  const sellerUserId = shop?.userId;
  if (sellerUserId) {
    emitUserResourceUpdated(sellerUserId, "review", payload);
  }
}

async function notifyShopNewReview({ shop, buyer, product, rating }) {
  const sellerUserId = shop?.userId;
  if (!sellerUserId) {
    return;
  }
  if (String(sellerUserId) === String(buyer?._id)) {
    return;
  }

  const buyerName =
    pickString(buyer?.FullName) || pickString(buyer?.UserName) || "Khách hàng";
  const productName = pickString(product?.ProductName) || "sản phẩm";
  const stars = Number(rating) || 0;

  await createNotification(sellerUserId, {
    title: "Đánh giá mới từ khách hàng",
    content: `${buyerName} đã đánh giá ${stars}★ cho "${productName}".`,
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.SYSTEM,
  }).catch((error) => {
    console.warn("[review] notify shop failed:", error?.message || error);
  });
}

async function assertPurchasedProduct(user, { productId, reservationId, shopId } = {}) {
  const productObjectId = pickString(productId);
  if (!productObjectId || !isStrictMongoObjectId(productObjectId)) {
    throw createServiceError("Thiếu productId hợp lệ.");
  }

  const product = await Product.findById(productObjectId).lean();
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const filter = {
    userId: user._id,
    productId: product._id,
    status: { $in: REVIEWABLE_STATUSES },
  };

  if (reservationId && isStrictMongoObjectId(pickString(reservationId))) {
    filter._id = pickString(reservationId);
  }

  const reservation = await Reservation.findOne(filter).sort({ tgNhanHang: -1, updatedAt: -1 });
  if (!reservation) {
    throw createServiceError("Chỉ đánh giá được sản phẩm bạn đã mua / nhận hàng.", 403);
  }

  if (
    shopId &&
    String(reservation.shopId) !== String(shopId) &&
    String(product.ShopId) !== String(shopId)
  ) {
    throw createServiceError("Sản phẩm không thuộc gian hàng này.", 400);
  }

  return { product, reservation, shopId: reservation.shopId || product.ShopId };
}

async function listBuyerReviews(user, { page, limit } = {}) {
  const filter = {
    userId: user._id,
    ...notDeletedReviewFilter(),
  };
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ CreatedAt: -1, _id: -1 }).skip(skip).limit(safeLimit).lean(),
    Review.countDocuments(filter),
  ]);

  const imagesByReview = await loadReviewImagesMap(rows.map((row) => row._id));
  const productIds = rows.map((row) => row.productId).filter(Boolean);
  const shopIds = rows.map((row) => row.shopId).filter(Boolean);
  const [products, shops] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } }).select("shopName description userId").lean()
      : [],
  ]);
  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } }).select("FullName UserName").lean()
    : [];
  const productById = new Map(products.map((item) => [String(item._id), item]));
  const shopById = new Map(shops.map((item) => [String(item._id), item]));
  const ownerById = new Map(owners.map((item) => [String(item._id), item]));

  const items = await Promise.all(
    rows.map((row) => {
      const shop = shopById.get(String(row.shopId));
      return toPublicReview(row, {
        user,
        product: productById.get(String(row.productId)),
        shop,
        shopOwner: shop?.userId ? ownerById.get(String(shop.userId)) : null,
        images: imagesByReview.get(String(row._id)) || [],
      });
    })
  );

  return {
    reviews: items,
    items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function createBuyerReview(user, payload = {}) {
  const rating = normalizeRating(payload.rating);
  const reservationId = pickString(
    payload.reservationId || payload.orderCode || payload.order_code
  );
  if (!reservationId || !isStrictMongoObjectId(reservationId)) {
    throw createServiceError("Thiếu reservationId hợp lệ.");
  }

  const { product, reservation, shopId } = await assertPurchasedProduct(user, {
    productId: payload.productId || payload.product_id,
    reservationId,
    shopId: payload.shopId || payload.storeId || payload.store_id,
  });

  if (reservation.hasReview) {
    throw createServiceError("Bạn đã đánh giá đơn hàng này.", 409);
  }

  const existing = await Review.findOne({
    reservationId: reservation._id,
    ...notDeletedReviewFilter(),
  });
  if (existing) {
    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { hasReview: true } }
    );
    throw createServiceError("Bạn đã đánh giá đơn hàng này.", 409);
  }

  const now = new Date();
  const review = await Review.create({
    userId: user._id,
    shopId,
    productId: product._id,
    reservationId: reservation._id,
    rating,
    comment: pickString(payload.comment),
    isDeleted: RECORD_STATUS.ACTIVE,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const images = await replaceReviewImages(review._id, collectImageInputs(payload));
  let shop = await refreshShopReviewStats(shopId);
  if (!shop?.userId && shopId) {
    shop = await ShopProfile.findById(shopId).select("userId tongDG diemTB shopName");
  }
  await Reservation.updateOne(
    { _id: reservation._id },
    { $set: { hasReview: true } }
  );

  await notifyShopNewReview({
    shop,
    buyer: user,
    product,
    rating,
  });
  emitReviewRealtime(review, shop, { action: "created" });

  return toPublicReview(review, {
    user,
    product,
    shop,
    images,
  });
}

async function updateBuyerReview(user, reviewId, payload = {}) {
  const review = await Review.findOne({
    _id: reviewId,
    userId: user._id,
    ...notDeletedReviewFilter(),
  });
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  if (payload.rating !== undefined) {
    review.rating = normalizeRating(payload.rating);
  }
  if (payload.comment !== undefined) {
    review.comment = pickString(payload.comment);
  }
  review.UpdatedAt = new Date();
  await review.save();

  const imageInputs = collectImageInputs(payload);
  let images;
  if (
    imageInputs.length ||
    payload.images !== undefined ||
    payload.imageUrl !== undefined
  ) {
    images = await replaceReviewImages(review._id, imageInputs);
  }

  const shop = await refreshShopReviewStats(review.shopId);
  emitReviewRealtime(review, shop, { action: "updated" });
  return toPublicReview(review, { user, images, shop });
}

async function deleteBuyerReview(user, reviewId) {
  const review = await Review.findOne({
    _id: reviewId,
    userId: user._id,
    ...notDeletedReviewFilter(),
  });
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const now = new Date();
  markReviewBuyerDeleted(review, now);
  review.UpdatedAt = now;
  await review.save();

  const shop = await refreshShopReviewStats(review.shopId);
  emitReviewRealtime(review, shop, { action: "deleted" });
  return { id: String(review._id) };
}

async function loadActiveReviewsByReservationIds(reservationIds = [], userId = null) {
  const ids = [
    ...new Set(
      (Array.isArray(reservationIds) ? reservationIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];
  if (!ids.length) {
    return new Map();
  }

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) {
    return new Map();
  }

  const query = {
    reservationId: { $in: objectIds },
    ...notDeletedReviewFilter(),
  };
  if (userId) {
    query.userId = userId;
  }

  const rows = await Review.find(query).sort({ CreatedAt: -1 }).lean();
  if (!rows.length) {
    return new Map();
  }

  const imagesByReview = await loadReviewImagesMap(rows.map((row) => row._id));
  const byReservation = new Map();

  rows.forEach((row) => {
    const reservationKey = String(row.reservationId);
    if (byReservation.has(reservationKey)) {
      return;
    }
    const images = imagesByReview.get(String(row._id)) || [];
    byReservation.set(reservationKey, {
      id: String(row._id),
      reservationId: reservationKey,
      orderCode: reservationKey,
      rating: Number(row.rating) || 0,
      comment: row.comment || "",
      createdAt: row.CreatedAt || null,
      images,
      imageUrl: images[0]?.imageUrl || "",
    });
  });

  return byReservation;
}

async function loadActiveReviewIdsByReservationIds(reservationIds = []) {
  const reviews = await loadActiveReviewsByReservationIds(reservationIds);
  return new Map(
    [...reviews.entries()].map(([reservationId, review]) => [reservationId, review.id])
  );
}

module.exports = {
  listBuyerReviews,
  createBuyerReview,
  updateBuyerReview,
  deleteBuyerReview,
  refreshShopReviewStats,
  loadReviewImagesMap,
  loadActiveReviewIdsByReservationIds,
  loadActiveReviewsByReservationIds,
  toPublicReview,
};
