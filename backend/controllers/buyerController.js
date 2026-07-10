const messageService = require("../services/messageService");
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
  const messageType = req.body.messageType;
  const imageContent = pickBodyValue(req.body, ["imageContent", "imageUri"]);

  const result = await messageService.startConversationWithShop(req.currentUser, shopId, {
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
  const messages = await messageService.listBuyerConversationMessages(
    req.currentUser,
    req.params.id
  );
  return success(res, { data: { messages } });
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
