const messageService = require("../services/messageService");
const buyerReviewService = require("../services/buyerReviewService");
const favoriteProductService = require("../services/favoriteProductService");
const favoriteShopService = require("../services/favoriteShopService");
const userFollowService = require("../services/userFollowService");
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

exports.listConversations = async (req, res) => {
  const conversations = await messageService.listBuyerConversations(req.currentUser);
  return success(res, { data: { conversations } });
};

exports.listShops = async (req, res) => {
  const shops = await messageService.listShopsForBuyer(req.currentUser);
  return success(res, { data: { shops } });
};

exports.startConversation = async (req, res) => {
  const shopId = pickBodyValue(req.body, ["shopId", "shop_id"]);
  if (!shopId) {
    return fail(res, { status: 400, message: "Thiếu shopId." });
  }

  const content = pickBodyValue(req.body, ["content", "message"]);
  const shopName = pickBodyValue(req.body, ["shopName", "shop_name"]);
  const messageType = req.body.messageType;
  const imageContent = pickBodyValue(req.body, ["imageContent", "imageUri"]);

  const result = await messageService.startConversationWithShop(req.currentUser, shopId, {
    shopName,
    content,
    messageType,
    imageContent,
  });

  return success(res, {
    message: "Đã mở cuộc trò chuyện.",
    data: result,
  });
};

exports.listMessages = async (req, res) => {
  const result = await messageService.listBuyerConversationMessages(
    req.currentUser,
    req.params.id
  );
  return success(res, { data: result });
};

exports.sendMessage = async (req, res) => {
  const content = pickBodyValue(req.body, ["content", "message"]);
  const imageContent = pickBodyValue(req.body, ["imageContent", "imageUri"]);
  const messageType = req.body.messageType;

  if (!content && !imageContent && Number(messageType) !== 1) {
    return fail(res, { status: 400, message: "Thiếu nội dung tin nhắn." });
  }

  const message = await messageService.sendBuyerMessage(req.currentUser, req.params.id, {
    content,
    messageType,
    imageContent,
  });

  return success(res, {
    message: "Đã gửi tin nhắn.",
    data: { message },
  });
};

exports.deleteMessage = async (req, res) => {
  const message = await messageService.deleteMessage(
    req.currentUser,
    req.params.id,
    req.params.messageId,
    { asSeller: false }
  );

  return success(res, {
    message: "Đã gỡ tin nhắn.",
    data: {
      message,
      lastMessage: message.conversationLastMessage || "",
    },
  });
};

exports.getConversationPeer = async (req, res) => {
  const peer = await messageService.getBuyerConversationPeer(req.currentUser, req.params.id);
  return success(res, { data: { peer } });
};

exports.listReviews = async (req, res) => {
  const reviews = await buyerReviewService.listBuyerReviews(req.currentUser);
  return success(res, { data: { reviews } });
};

exports.createReview = async (req, res) => {
  const rating = req.body.rating;
  if (rating === undefined || rating === null || rating === "") {
    return fail(res, { status: 400, message: "Vui lòng chọn số sao." });
  }

  const review = await buyerReviewService.createBuyerReview(req.currentUser, {
    storeId: pickBodyValue(req.body, ["storeId", "store_id"]),
    storeName: pickBodyValue(req.body, ["storeName", "store_name"]),
    productName: pickBodyValue(req.body, ["productName", "product_name"]),
    orderCode: pickBodyValue(req.body, ["orderCode", "order_code"]),
    rating,
    comment: pickBodyValue(req.body, ["comment", "message"]),
    imageUrl: pickBodyValue(req.body, ["imageUrl", "image_url", "imageContent", "imageUri"]),
  });

  return success(res, {
    message: "Đã gửi đánh giá.",
    data: { review },
  });
};

exports.updateReview = async (req, res) => {
  const review = await buyerReviewService.updateBuyerReview(req.currentUser, req.params.id, {
    rating: req.body.rating,
    comment: req.body.comment,
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

exports.listFavoriteShops = async (req, res) => {
  const result = await favoriteShopService.listFavoriteShops(req.currentUser, req.query);
  return success(res, { data: result });
};

exports.listFavoriteShopIds = async (req, res) => {
  const shopIds = await favoriteShopService.listFavoriteShopIds(req.currentUser);
  return success(res, { data: { shopIds } });
};

exports.getFavoriteShopStatus = async (req, res) => {
  const shopId =
    pickBodyValue(req.query, ["shopId", "shop_id"]) || pickBodyValue(req.params, ["shopId"]);
  if (!shopId) {
    return fail(res, { status: 400, message: "Thiếu shopId." });
  }
  const status = await favoriteShopService.getFavoriteShopStatus(req.currentUser, shopId);
  return success(res, { data: status });
};

exports.addFavoriteShop = async (req, res) => {
  const shopId = pickBodyValue(req.body, ["shopId", "shop_id"]);
  if (!shopId) {
    return fail(res, { status: 400, message: "Thiếu shopId." });
  }
  const favorite = await favoriteShopService.addFavoriteShop(req.currentUser, shopId);
  return success(res, {
    status: 201,
    message: "Đã thêm gian hàng vào yêu thích.",
    data: { favorite },
  });
};

exports.removeFavoriteShop = async (req, res) => {
  const result = await favoriteShopService.removeFavoriteShop(req.currentUser, req.params.shopId);
  return success(res, {
    message: "Đã bỏ yêu thích gian hàng.",
    data: result,
  });
};

exports.followUser = async (req, res) => {
  const result = await userFollowService.followUser(req.currentUser, {
    sellerUserId: pickBodyValue(req.body, ["sellerUserId", "userId", "followedUserId"]),
    shopId: pickBodyValue(req.body, ["shopId", "shop_id"]),
  });
  return success(res, {
    status: 201,
    message: "Đã theo dõi người bán.",
    data: result,
  });
};

exports.unfollowUser = async (req, res) => {
  const result = await userFollowService.unfollowUser(req.currentUser, {
    sellerUserId:
      pickBodyValue(req.params, ["targetId"]) ||
      pickBodyValue(req.body, ["sellerUserId", "userId", "followedUserId"]),
    shopId: pickBodyValue(req.body, ["shopId", "shop_id"]) || pickBodyValue(req.query, ["shopId"]),
  });
  return success(res, {
    message: "Đã bỏ theo dõi.",
    data: result,
  });
};

exports.getFollowStatus = async (req, res) => {
  const result = await userFollowService.getFollowStatus(req.currentUser, {
    sellerUserId: pickBodyValue(req.query, ["sellerUserId", "userId", "followedUserId"]),
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
  if (!title) {
    return fail(res, { status: 400, message: "Vui lòng chọn lý do báo cáo." });
  }

  const report = await reportService.createReport(req.currentUser, {
    reportType: req.body.reportType,
    shopId: pickBodyValue(req.body, ["shopId", "shop_id", "storeId", "store_id"]),
    shopName: pickBodyValue(req.body, ["shopName", "shop_name", "storeName", "store_name"]),
    productId: pickBodyValue(req.body, ["productId", "product_id"]),
    productName: pickBodyValue(req.body, ["productName", "product_name"]),
    title,
    content: pickBodyValue(req.body, ["content", "message", "note"]),
  });

  return success(res, {
    message: "Đã gửi báo cáo vi phạm.",
    data: { report },
  });
};
