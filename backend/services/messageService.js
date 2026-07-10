const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ShopProfile = require("../models/ShopProfile");
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

function mapStatusToString(messageStatus) {
  if (messageStatus === MESSAGE_STATUS.SEEN) {
    return "seen";
  }
  if (messageStatus === MESSAGE_STATUS.DELIVERED) {
    return "delivered";
  }
  return "sent";
}

function mapMessageToClient(message, userId) {
  const isMine = String(message.senderId) === String(userId);
  const isImage = Number(message.messageType) === MESSAGE_TYPE.IMAGE;

  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    isMine,
    messageType: message.messageType,
    content: isImage ? "" : message.content || "",
    imageUri: isImage ? message.content || "" : undefined,
    isRead: message.isRead,
    messageStatus: message.messageStatus,
    status: isMine ? mapStatusToString(message.messageStatus) : undefined,
    createdAt: message.CreatedAt,
  };
}

async function getShopPublicInfo(shop) {
  const seller = shop?.userId ? await User.findById(shop.userId) : null;
  const name =
    seller?.FullName ||
    seller?.UserName ||
    pickString(shop?.description).slice(0, 40) ||
    "Gian hàng";

  return {
    id: shop._id,
    name,
    avatar: seller?.Avatar || "",
    phone: shop.phone || seller?.Phone || "",
  };
}

function resolveMessagePayload(payload = {}) {
  const messageType = Number(payload.messageType ?? MESSAGE_TYPE.TEXT);
  if (messageType === MESSAGE_TYPE.IMAGE) {
    const imageContent = pickString(payload.imageContent || payload.content);
    if (!imageContent) {
      throw createServiceError("Thiếu dữ liệu ảnh.");
    }
    return {
      messageType: MESSAGE_TYPE.IMAGE,
      content: imageContent,
      preview: "[Ảnh]",
    };
  }

  const content = pickString(payload.content || payload.message);
  if (!content) {
    throw createServiceError("Nội dung tin nhắn không được để trống.");
  }

  return {
    messageType: MESSAGE_TYPE.TEXT,
    content,
    preview: content,
  };
}

async function createConversationMessage(conversation, senderId, payload) {
  const resolved = resolveMessagePayload(payload);
  const now = new Date();

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    messageType: resolved.messageType,
    content: resolved.content,
    isRead: MESSAGE_READ.UNREAD,
    messageStatus: MESSAGE_STATUS.SENT,
    CreatedAt: now,
    UpdatedAt: now,
  });

  conversation.lastMessage = resolved.preview;
  conversation.lastMessageAt = now;
  conversation.UpdatedAt = now;
  await conversation.save();

  return message;
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

async function getBuyerOwnedConversation(user, conversationId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId: user._id,
  });
  if (!conversation) {
    throw createServiceError("Không tìm thấy cuộc trò chuyện.", 404);
  }
  const shop = await ShopProfile.findById(conversation.shopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
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

  return messages.map((message) => mapMessageToClient(message, user._id));
}

async function listBuyerConversationMessages(user, conversationId) {
  const { conversation } = await getBuyerOwnedConversation(user, conversationId);
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

  return messages.map((message) => mapMessageToClient(message, user._id));
}

async function sendSellerMessage(user, conversationId, payload) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const message = await createConversationMessage(conversation, user._id, payload);
  return mapMessageToClient(message, user._id);
}

async function sendBuyerMessage(user, conversationId, payload) {
  const { conversation } = await getBuyerOwnedConversation(user, conversationId);
  const message = await createConversationMessage(conversation, user._id, payload);
  return mapMessageToClient(message, user._id);
}

async function listBuyerConversations(user) {
  const conversations = await Conversation.find({ userId: user._id })
    .sort({ lastMessageAt: -1, UpdatedAt: -1 })
    .limit(100);

  const result = [];
  for (const conversation of conversations) {
    const shop = await ShopProfile.findById(conversation.shopId);
    if (!shop) {
      continue;
    }

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
      shop: await getShopPublicInfo(shop),
    });
  }

  return result;
}

async function listShopsForBuyer() {
  const shops = await ShopProfile.find().sort({ UpdatedAt: -1 }).limit(30);
  const result = [];

  for (const shop of shops) {
    result.push({
      shop: await getShopPublicInfo(shop),
    });
  }

  return result;
}

async function findOrCreateBuyerConversation(user, shopId) {
  const shop = await ShopProfile.findById(shopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  let conversation = await Conversation.findOne({
    shopId: shop._id,
    userId: user._id,
  });

  const now = new Date();
  if (!conversation) {
    conversation = await Conversation.create({
      shopId: shop._id,
      userId: user._id,
      lastMessage: "",
      lastMessageAt: now,
      CreatedAt: now,
      UpdatedAt: now,
    });
  }

  return { shop, conversation };
}

async function startConversationWithShop(user, shopId, payload = {}) {
  const { shop, conversation } = await findOrCreateBuyerConversation(user, shopId);
  const content = pickString(payload.content);

  if (content || payload.messageType === MESSAGE_TYPE.IMAGE) {
    const message = await sendBuyerMessage(user, conversation._id, payload);
    return {
      conversationId: conversation._id,
      shop: await getShopPublicInfo(shop),
      message,
    };
  }

  return {
    conversationId: conversation._id,
    shop: await getShopPublicInfo(shop),
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
  if (content || payload.messageType === MESSAGE_TYPE.IMAGE) {
    return sendSellerMessage(user, conversation._id, payload);
  }

  return {
    conversationId: conversation._id,
  };
}

module.exports = {
  listSellerConversations,
  listBuyerConversations,
  listShopsForBuyer,
  listConversationMessages,
  listBuyerConversationMessages,
  sendSellerMessage,
  sendBuyerMessage,
  startConversationWithShop,
  startConversationWithBuyer,
};
