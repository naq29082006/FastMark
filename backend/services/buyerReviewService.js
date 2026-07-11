const crypto = require("crypto");
const BuyerReview = require("../models/BuyerReview");
const Review = require("../models/Review");
const Reservation = require("../models/Reservation");
const Restaurant = require("../models/Restaurant");
const ShopProfile = require("../models/ShopProfile");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createServiceError("Vui lòng chọn số sao từ 1 đến 5.");
  }
  return Math.round(rating);
}

function normalizeObjectIdString(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "object" && value._id) {
    return pickString(value._id);
  }

  const normalized = pickString(value);
  if (!normalized || normalized === "[object Object]") {
    return "";
  }

  return normalized;
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(normalizeObjectIdString(value));
}

async function findShopByObjectId(id) {
  if (!isStrictMongoObjectId(id)) {
    return null;
  }

  return ShopProfile.findById(id).lean();
}

async function findOrCreateShopFromRestaurant(restaurant) {
  const externalId = pickString(restaurant?.externalId);
  if (!externalId) {
    return null;
  }

  let shop = await ShopProfile.findOne({ externalRestaurantId: externalId }).lean();
  if (shop) {
    return shop;
  }

  try {
    const created = await ShopProfile.create({
      externalRestaurantId: externalId,
      description: restaurant.name,
      shopName: restaurant.name,
      address: restaurant.address || "",
      DiaChiHeThong: restaurant.address || "",
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      phone: restaurant.phone || restaurant.zalo || "",
    });
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      return ShopProfile.findOne({ externalRestaurantId: externalId }).lean();
    }
    throw error;
  }
}

async function findShopByExternalId(externalId, storeName = "") {
  const rawId = pickString(externalId);
  if (!rawId) {
    return null;
  }

  const linkedShop = await ShopProfile.findOne({ externalRestaurantId: rawId }).lean();
  if (linkedShop) {
    return linkedShop;
  }

  let restaurant = await Restaurant.findOne({ externalId: rawId }).lean();
  if (!restaurant && storeName) {
    restaurant = await Restaurant.findOne({ name: storeName }).lean();
  }

  if (!restaurant) {
    return null;
  }

  return findOrCreateShopFromRestaurant(restaurant);
}

async function resolveShopProfile(user, { storeId, orderCode, storeName } = {}) {
  const normalizedStoreId = normalizeObjectIdString(storeId);
  if (normalizedStoreId) {
    const shopByObjectId = await findShopByObjectId(normalizedStoreId);
    if (shopByObjectId) {
      return shopByObjectId;
    }

    const shopByExternalId = await findShopByExternalId(normalizedStoreId, storeName);
    if (shopByExternalId) {
      return shopByExternalId;
    }
  }

  const normalizedOrderCode = normalizeObjectIdString(orderCode);
  if (isStrictMongoObjectId(normalizedOrderCode) && user?._id) {
    const reservation = await Reservation.findOne({
      _id: normalizedOrderCode,
      userId: user._id,
    }).lean();

    if (reservation?.shopId) {
      const shop = await findShopByObjectId(String(reservation.shopId));
      if (shop) {
        return shop;
      }
    }
  }

  throw createServiceError("Không tìm thấy gian hàng để đánh giá.", 404);
}

async function resolveReviewImageUrl(imageInput) {
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

async function refreshShopReviewStats(storeId) {
  const normalizedStoreId = normalizeObjectIdString(storeId);
  if (!normalizedStoreId || !isStrictMongoObjectId(normalizedStoreId)) {
    return null;
  }

  const shop = await ShopProfile.findById(normalizedStoreId);
  if (!shop) {
    return null;
  }

  const reviews = await Review.find({
    store_id: normalizedStoreId,
    is_deleted: { $ne: true },
  }).lean();

  const total = reviews.length;
  const averageRating =
    total > 0
      ? Math.round((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / total) * 10) /
        10
      : 0;

  shop.totalReviews = total;
  shop.averageRating = averageRating;
  shop.UpdatedAt = new Date();
  await shop.save();
  return shop;
}

async function syncPublicReview({ buyerReview, user, storeId, imageUrl }) {
  const externalId = `buyer-${buyerReview._id}`;
  const userName = pickString(user.FullName) || pickString(user.UserName) || "Khách hàng";

  await Review.findOneAndUpdate(
    { externalId },
    {
      $set: {
        store_id: String(storeId),
        user_name: userName,
        rating: buyerReview.rating,
        comment: buyerReview.comment || "",
        is_hidden: false,
        is_deleted: false,
        created_at: buyerReview.CreatedAt || new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await refreshShopReviewStats(storeId);
}

async function listBuyerReviews(user) {
  const rows = await BuyerReview.find({ userId: user._id })
    .sort({ CreatedAt: -1 })
    .limit(100);
  return rows.map((row) => row.toClientReview());
}

async function createBuyerReview(user, payload = {}) {
  const rating = normalizeRating(payload.rating);
  const orderCode = pickString(payload.orderCode);
  const shop = await resolveShopProfile(user, {
    storeId: payload.storeId,
    orderCode,
    storeName: pickString(payload.storeName),
  });
  const storeId = String(shop._id);

  if (orderCode) {
    const existing = await BuyerReview.findOne({
      userId: user._id,
      orderCode,
    });
    if (existing) {
      throw createServiceError("Bạn đã đánh giá đơn hàng này.", 409);
    }
  }

  const imageUrl = await resolveReviewImageUrl(payload.imageUrl);
  const now = new Date();
  const review = await BuyerReview.create({
    userId: user._id,
    storeId,
    storeName: pickString(payload.storeName) || pickString(shop.shopName),
    productName: pickString(payload.productName),
    orderCode,
    rating,
    comment: pickString(payload.comment),
    imageUrl,
    CreatedAt: now,
    UpdatedAt: now,
  });

  await syncPublicReview({ buyerReview: review, user, storeId, imageUrl });

  return review.toClientReview();
}

async function updateBuyerReview(user, reviewId, payload = {}) {
  const review = await BuyerReview.findOne({ _id: reviewId, userId: user._id });
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

  const externalId = `buyer-${review._id}`;
  const publicReview = await Review.findOne({ externalId });
  if (publicReview) {
    publicReview.rating = review.rating;
    publicReview.comment = review.comment || "";
    await publicReview.save();
    await refreshShopReviewStats(review.storeId);
  }

  return review.toClientReview();
}

async function deleteBuyerReview(user, reviewId) {
  const review = await BuyerReview.findOneAndDelete({ _id: reviewId, userId: user._id });
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const externalId = `buyer-${review._id}`;
  await Review.findOneAndUpdate(
    { externalId },
    { $set: { is_deleted: true, is_hidden: true } }
  );
  await refreshShopReviewStats(review.storeId);

  return { id: review._id };
}

module.exports = {
  listBuyerReviews,
  createBuyerReview,
  updateBuyerReview,
  deleteBuyerReview,
};
