const shopSettingsService = require("../services/shopSettingsService");
const reservationService = require("../services/reservationService");
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

exports.uploadShopAvatar = async (req, res) => {
  const imageBase64 = pickBodyValue(req.body, ["imageBase64", "base64"]);
  const mimeType = pickBodyValue(req.body, ["mimeType", "contentType"]) || "image/jpeg";

  if (!imageBase64) {
    return fail(res, {
      status: 400,
      message: "Thiếu file ảnh gian hàng.",
    });
  }

  const result = await shopSettingsService.uploadShopAvatar(req.currentUser, {
    imageBase64,
    mimeType,
  });

  return success(res, {
    message: "Cập nhật ảnh gian hàng thành công.",
    data: result,
  });
};

exports.checkShopUsernameAvailability = async (req, res) => {
  const shopUsername =
    pickBodyValue(req.body, ["shopUsername", "username"]) ||
    pickBodyValue(req.query, ["shopUsername", "username"]);

  if (!shopUsername) {
    return fail(res, {
      status: 400,
      message: "Thiếu username shop.",
    });
  }

  const result = await shopSettingsService.checkShopUsernameAvailability(
    req.currentUser,
    shopUsername
  );

  return success(res, {
    data: result,
  });
};

exports.listOrders = async (req, res) => {
  const tab = req.query.tab || "holding";
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

exports.completeReservationByScan = async (req, res) => {
  const payload =
    pickBodyValue(req.body, ["qrPayload", "payload", "code", "pickupCode", "data"]) || "";
  const reservation = await reservationService.completeReservationByScan(
    req.currentUser,
    payload
  );
  return success(res, {
    message: "Đã quét mã — đơn hoàn thành.",
    data: { reservation },
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
    data: {
      message,
      lastMessage: message.conversationLastMessage || "",
    },
  });
};

exports.getConversationPeer = async (req, res) => {
  const peer = await messageService.getSellerConversationPeer(req.currentUser, req.params.id);
  return success(res, { data: { peer } });
};

exports.getStats = async (req, res) => {
  const stats = await sellerStatsService.getSellerStats(req.currentUser, req.query);
  return success(res, { data: { stats } });
};
