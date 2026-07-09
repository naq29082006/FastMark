const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { MESSAGE_TYPE } = require("../constants/messageType");
const { MESSAGE_READ, MESSAGE_STATUS } = require("../constants/messageStatus");
const { getShopForSeller } = require("./shopSettingsService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function formatTime(date) {
  if (!date) {
    return "";
  }
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  const now = new Date();
  const isToday = value.toDateString() === now.toDateString();
  if (isToday) {
    return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return value.toLocaleDateString("vi-VN");
}

async function listSellerConversations(user) {
  const shop = await getShopForSeller(user);
  const conversations = await Conversation.find({ shopId: shop._id })
    .sort({ lastMessageAt: -1, UpdatedAt: -1 })
    .limit(100);

  const result = [];
  for (const conversation of conversations) {
    const buyer = await User.findById(conversation.userId);
    const unreadCount = await Message.countDocuments({
      conversationId: conversation._id,
      senderId: { $ne: user._id },
      isRead: MESSAGE_READ.UNREAD,
    });

    result.push({
      id: conversation._id,
      lastMessage: conversation.lastMessage || "",
      lastMessageAt: conversation.lastMessageAt || conversation.UpdatedAt,
      timeLabel: formatTime(conversation.lastMessageAt || conversation.UpdatedAt),
      unreadCount,
      buyer: buyer
        ? {
            id: buyer._id,
            fullName: buyer.FullName || "",
            userName: buyer.UserName || "",
            avatar: buyer.Avatar || "",
            phone: buyer.Phone || "",
          }
        : null,
    });
  }

  return result;
}

async function getOwnedConversation(user, conversationId) {
  const shop = await getShopForSeller(user);
  const conversation = await Conversation.findOne({
    _id: conversationId,
    shopId: shop._id,
  });
  if (!conversation) {
    throw createServiceError("Không tìm thấy cuộc trò chuyện.", 404);
  }
  return { shop, conversation };
}

async function listConversationMessages(user, conversationId) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const messages = await Message.find({ conversationId: conversation._id })
    .sort({ CreatedAt: 1 })
    .limit(200);

  await Message.updateMany(
    {
      conversationId: conversation._id,
      senderId: { $ne: user._id },
      isRead: MESSAGE_READ.UNREAD,
    },
    {
      $set: {
        isRead: MESSAGE_READ.READ,
        messageStatus: MESSAGE_STATUS.SEEN,
        UpdatedAt: new Date(),
      },
    }
  );

  return messages.map((message) => ({
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    isMine: String(message.senderId) === String(user._id),
    messageType: message.messageType,
    content: message.content || "",
    isRead: message.isRead,
    messageStatus: message.messageStatus,
    createdAt: message.CreatedAt,
  }));
}

async function sendSellerMessage(user, conversationId, payload) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const content = pickString(payload.content);
  if (!content) {
    throw createServiceError("Nội dung tin nhắn không được để trống.");
  }

  const now = new Date();
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: user._id,
    messageType: MESSAGE_TYPE.TEXT,
    content,
    isRead: MESSAGE_READ.UNREAD,
    messageStatus: MESSAGE_STATUS.SENT,
    CreatedAt: now,
    UpdatedAt: now,
  });

  conversation.lastMessage = content;
  conversation.lastMessageAt = now;
  conversation.UpdatedAt = now;
  await conversation.save();

  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    isMine: true,
    messageType: message.messageType,
    content: message.content,
    createdAt: message.CreatedAt,
  };
}

async function startConversationWithBuyer(user, buyerId, payload = {}) {
  const shop = await getShopForSeller(user);
  const buyer = await User.findById(buyerId);
  if (!buyer) {
    throw createServiceError("Không tìm thấy khách hàng.", 404);
  }

  let conversation = await Conversation.findOne({
    shopId: shop._id,
    userId: buyer._id,
  });

  const now = new Date();
  if (!conversation) {
    conversation = await Conversation.create({
      shopId: shop._id,
      userId: buyer._id,
      lastMessage: "",
      lastMessageAt: now,
      CreatedAt: now,
      UpdatedAt: now,
    });
  }

  const content = pickString(payload.content);
  if (content) {
    return sendSellerMessage(user, conversation._id, { content });
  }

  return {
    conversationId: conversation._id,
  };
}

module.exports = {
  listSellerConversations,
  listConversationMessages,
  sendSellerMessage,
  startConversationWithBuyer,
};
