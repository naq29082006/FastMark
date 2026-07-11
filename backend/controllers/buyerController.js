const messageService = require("../services/messageService");
const buyerReviewService = require("../services/buyerReviewService");
const reportService = require("../services/reportService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
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
  const shops = await messageService.listShopsForBuyer();
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
    data: { message },
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
