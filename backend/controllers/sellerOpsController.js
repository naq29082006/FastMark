const shopSettingsService = require("../services/shopSettingsService");
const reservationService = require("../services/reservationService");
const dealOfferService = require("../services/dealOfferService");
const messageService = require("../services/messageService");
const sellerStatsService = require("../services/sellerStatsService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

exports.getShopSettings = async (req, res) => {
  const settings = await shopSettingsService.getShopSettings(req.currentUser);
  return success(res, { data: { shop: settings } });
};

exports.updateShopSettings = async (req, res) => {
  const settings = await shopSettingsService.updateShopSettings(req.currentUser, req.body);
  return success(res, {
    message: "Đã cập nhật cài đặt cửa hàng.",
    data: { shop: settings },
  });
};

exports.listOrders = async (req, res) => {
  const tab = req.query.tab || "holding";

  if (tab === "pending_price") {
    const deals = await reservationService.listPendingPriceDeals(req.currentUser);
    return success(res, { data: { deals, tab } });
  }

  const reservations = await reservationService.listSellerReservations(req.currentUser, { tab });
  return success(res, { data: { reservations, tab } });
};

exports.getReservationDetail = async (req, res) => {
  const reservation = await reservationService.getSellerReservationDetail(
    req.currentUser,
    req.params.id
  );
  return success(res, { data: { reservation } });
};

exports.confirmReservation = async (req, res) => {
  const reservation = await reservationService.confirmReservation(req.currentUser, req.params.id);
  return success(res, {
    message: "Đã xác nhận đơn giữ hàng.",
    data: { reservation },
  });
};

exports.rejectReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note"]);
  const reservation = await reservationService.rejectReservation(req.currentUser, req.params.id, {
    reason,
  });
  return success(res, {
    message: "Đã từ chối đơn giữ hàng.",
    data: { reservation },
  });
};

exports.cancelReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note"]);
  const reservation = await reservationService.cancelReservationBySeller(
    req.currentUser,
    req.params.id,
    { reason }
  );
  return success(res, {
    message: "Đã hủy đơn giữ hàng.",
    data: { reservation },
  });
};

exports.completeReservation = async (req, res) => {
  const reservation = await reservationService.completeReservation(req.currentUser, req.params.id);
  return success(res, {
    message: "Đã xác nhận khách nhận hàng.",
    data: { reservation },
  });
};

exports.listDeals = async (req, res) => {
  const deals = await dealOfferService.listSellerDeals(req.currentUser, {
    status: req.query.status,
  });
  return success(res, { data: { deals } });
};

exports.acceptDeal = async (req, res) => {
  const result = await dealOfferService.acceptDealOffer(req.currentUser, req.params.id);
  return success(res, {
    message: "Đã chấp nhận deal giá. Khách không thể hủy sau 15 phút.",
    data: result,
  });
};

exports.rejectDeal = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note", "sellerNote"]);
  const deal = await dealOfferService.rejectDealOffer(req.currentUser, req.params.id, { reason });
  return success(res, {
    message: "Đã từ chối deal giá.",
    data: { deal },
  });
};

exports.counterDeal = async (req, res) => {
  const counterPrice = req.body.counterPrice ?? req.body.sellerCounterPrice;
  if (counterPrice === undefined || counterPrice === null || counterPrice === "") {
    return fail(res, { status: 400, message: "Thiếu giá đề xuất." });
  }

  const deal = await dealOfferService.counterDealOffer(req.currentUser, req.params.id, req.body);
  return success(res, {
    message: "Đã gửi mức giá đề xuất cho khách.",
    data: { deal },
  });
};

exports.listConversations = async (req, res) => {
  const conversations = await messageService.listSellerConversations(req.currentUser);
  return success(res, { data: { conversations } });
};

exports.listMessages = async (req, res) => {
  const result = await messageService.listConversationMessages(
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

  const message = await messageService.sendSellerMessage(req.currentUser, req.params.id, {
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
    { asSeller: true }
  );

  return success(res, {
    message: "Đã gỡ tin nhắn.",
    data: { message },
  });
};

exports.getConversationPeer = async (req, res) => {
  const peer = await messageService.getSellerConversationPeer(req.currentUser, req.params.id);
  return success(res, { data: { peer } });
};

exports.getStats = async (req, res) => {
  const stats = await sellerStatsService.getSellerStats(req.currentUser);
  return success(res, { data: { stats } });
};
