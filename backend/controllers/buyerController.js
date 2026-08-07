const buyerReviewService = require("../services/buyerReviewService");
const favoriteProductService = require("../services/favoriteProductService");
const userFollowService = require("../services/userFollowService");
const userDiscoveryService = require("../services/userDiscoveryService");
const reportService = require("../services/reportService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  if (!body || typeof body !== "object") {
    return "";
  }
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

exports.listReviews = async (req, res) => {
  const data = await buyerReviewService.listBuyerReviews(req.currentUser, {
    page: req.query.page,
    limit: req.query.limit,
  });
  return success(res, { data });
};

exports.createReview = async (req, res) => {
  const rating = req.body.rating;
  if (rating === undefined || rating === null || rating === "") {
    return fail(res, { status: 400, message: "Vui lòng chọn số sao." });
  }

  const review = await buyerReviewService.createBuyerReview(req.currentUser, {
    productId: pickBodyValue(req.body, ["productId", "product_id"]),
    reservationId: pickBodyValue(req.body, [
      "reservationId",
      "reservation_id",
      "orderCode",
      "order_code",
    ]),
    shopId: pickBodyValue(req.body, ["shopId", "shop_id", "storeId", "store_id"]),
    rating,
    comment: pickBodyValue(req.body, ["comment", "message", "content"]),
    images: req.body?.images || req.body?.imageUrls || undefined,
    imageUrl: pickBodyValue(req.body, ["imageUrl", "image_url", "imageContent", "imageUri"]),
  });

  return success(res, {
    status: 201,
    message: "Đã gửi đánh giá.",
    data: { review },
  });
};

exports.updateReview = async (req, res) => {
  const review = await buyerReviewService.updateBuyerReview(req.currentUser, req.params.id, {
    rating: req.body.rating,
    comment: req.body.comment ?? req.body.content,
    images: req.body?.images || req.body?.imageUrls,
    imageUrl: pickBodyValue(req.body, ["imageUrl", "image_url", "imageContent", "imageUri"]),
  });
  return success(res, {
    message: "Đã cập nhật đánh giá.",
    data: { review },
  });
};

exports.deleteReview = async (req, res) => {
  await buyerReviewService.deleteBuyerReview(req.currentUser, req.params.id);
  return success(res, { message: "Đã xóa đánh giá." });
};

exports.listFavorites = async (req, res) => {
  const result = await favoriteProductService.listFavorites(req.currentUser, req.query);
  if (Array.isArray(result)) {
    return success(res, { data: { favorites: result } });
  }
  return success(res, { data: result });
};

exports.listFavoriteIds = async (req, res) => {
  const productIds = await favoriteProductService.listFavoriteProductIds(req.currentUser);
  return success(res, { data: { productIds } });
};

exports.addFavorite = async (req, res) => {
  const productId = pickBodyValue(req.body, ["productId", "product_id"]);
  if (!productId) {
    return fail(res, { status: 400, message: "Thiếu productId." });
  }

  const favorite = await favoriteProductService.addFavorite(req.currentUser, productId);
  return success(res, {
    status: 201,
    message: "Đã thêm vào yêu thích.",
    data: { favorite },
  });
};

exports.removeFavorite = async (req, res) => {
  const result = await favoriteProductService.removeFavorite(req.currentUser, req.params.productId);
  return success(res, {
    message: "Đã bỏ yêu thích.",
    data: result,
  });
};

exports.followShop = async (req, res) => {
  const result = await userFollowService.followUser(req.currentUser, {
    followedUserId: pickBodyValue(req.body, [
      "followedUserId",
      "userId",
      "sellerUserId",
      "targetId",
    ]),
    shopId: pickBodyValue(req.body, ["shopId", "shop_id"]),
  });
  return success(res, {
    status: 201,
    message: "Đã theo dõi.",
    data: result,
  });
};

exports.unfollowShop = async (req, res) => {
  const result = await userFollowService.unfollowUser(req.currentUser, {
    followedUserId:
      pickBodyValue(req.params, ["targetId"]) ||
      pickBodyValue(req.body, ["followedUserId", "userId", "sellerUserId", "targetId"]) ||
      pickBodyValue(req.query, ["followedUserId", "userId", "sellerUserId"]),
    shopId:
      pickBodyValue(req.params, ["targetId", "shopId"]) ||
      pickBodyValue(req.body, ["shopId", "shop_id"]) ||
      pickBodyValue(req.query, ["shopId", "shop_id"]),
    targetId: pickBodyValue(req.params, ["targetId"]),
  });
  return success(res, {
    message: "Đã bỏ theo dõi.",
    data: result,
  });
};

exports.getFollowStatus = async (req, res) => {
  const result = await userFollowService.getFollowStatus(req.currentUser, {
    followedUserId: pickBodyValue(req.query, [
      "followedUserId",
      "userId",
      "sellerUserId",
      "targetId",
    ]),
    shopId: pickBodyValue(req.query, ["shopId", "shop_id"]),
  });
  return success(res, { data: result });
};

exports.listFollowing = async (req, res) => {
  const result = await userFollowService.listFollowing(req.currentUser, req.query);
  return success(res, { data: result });
};

exports.listFollowers = async (req, res) => {
  const result = await userFollowService.listFollowers(req.currentUser, req.query);
  return success(res, { data: result });
};

exports.createReport = async (req, res) => {
  const title = pickBodyValue(req.body, ["title", "reason"]);
  const content = pickBodyValue(req.body, ["content", "message", "note"]);
  if (!title && !content) {
    return fail(res, { status: 400, message: "Vui lòng nhập nội dung tố cáo." });
  }

  const report = await reportService.createReport(req.currentUser, {
    reportType: req.body.reportType,
    shopId: pickBodyValue(req.body, ["shopId", "shop_id", "storeId", "store_id"]),
    shopName: pickBodyValue(req.body, ["shopName", "shop_name", "storeName", "store_name"]),
    productId: pickBodyValue(req.body, ["productId", "product_id"]),
    productName: pickBodyValue(req.body, ["productName", "product_name"]),
    reviewId: pickBodyValue(req.body, ["reviewId", "review_id"]),
    reviewerName: pickBodyValue(req.body, ["reviewerName", "userName", "user_name"]),
    title,
    content,
    images: req.body.images || req.body.imageUrls || [],
  });

  return success(res, {
    message: "Đã gửi báo cáo vi phạm.",
    data: { report },
  });
};

exports.searchUsers = async (req, res) => {
  const data = await userDiscoveryService.searchUsers(req.currentUser, req.query);
  return success(res, { data });
};

exports.getPublicUserProfile = async (req, res) => {
  const userId = String(req.params.userId || "").trim();
  const data = await userDiscoveryService.getPublicUserProfile(req.currentUser, userId);
  return success(res, { data });
};

exports.getPublicUserFollowing = async (req, res) => {
  const userId = String(req.params.userId || "").trim();
  const data = await userDiscoveryService.listPublicUserFollowing(userId, req.query);
  return success(res, { data });
};
