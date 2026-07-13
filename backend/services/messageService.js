const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const MessageImage = require("../models/MessageImage");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { MESSAGE_TYPE } = require("../constants/messageType");
const { parseOfferMessageContent } = require("../utils/offerMessageFormat");
const { MESSAGE_READ, MESSAGE_STATUS } = require("../constants/messageStatus");
const { SENDER_TYPE } = require("../constants/messageSender");
const { getShopForSeller } = require("./shopSettingsService");
const { mapPresenceFields } = require("../utils/activityLabel");
const { emitConversationEvent } = require("../socket");
const {
  resolveFileExtension,
  uploadImageToSupabase,
} = require("./uploadService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function activeMessageFilter(extra = {}) {
  return {
    ...extra,
    DeletedAt: null,
  };
}

async function resolveShopForBuyerChat(shopId) {
  const rawId = pickString(shopId);
  if (!rawId) {
    throw createServiceError("Thiếu shopId.", 400);
  }

  if (!isMongoObjectId(rawId)) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const shop = await ShopProfile.findById(rawId);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  return shop;
}

function formatBubbleTime(date) {
  if (!date) {
    return "";
  }
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
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

function buildViewerContext(user, shop = null, mode = "buyer") {
  return {
    mode,
    userId: user?._id,
    shopId: shop?._id || null,
  };
}

function isMessageFromViewer(message, viewer) {
  if (!viewer || !message) {
    return false;
  }

  const senderType = Number(message.senderType ?? SENDER_TYPE.USER);
  const senderId = String(message.senderId || "");

  if (viewer.mode === "seller") {
    return senderType === SENDER_TYPE.SHOP && senderId === String(viewer.shopId || "");
  }

  return senderType === SENDER_TYPE.USER && senderId === String(viewer.userId || "");
}

function buildOpponentReadFilter(viewer) {
  if (viewer.mode === "seller") {
    return { senderType: SENDER_TYPE.USER };
  }

  return { senderType: SENDER_TYPE.SHOP };
}

function buildUnreadFilter(viewer) {
  return buildOpponentReadFilter(viewer);
}

async function repairMessageSenders(conversation, shop) {
  const rows = await Message.find({ conversationId: conversation._id }).select(
    "_id senderId senderType"
  );

  for (const row of rows) {
    const senderIdStr = String(row.senderId || "");
    let senderType = SENDER_TYPE.USER;
    let senderId = row.senderId;

    if (senderIdStr === String(conversation.userId)) {
      senderType = SENDER_TYPE.USER;
    } else if (senderIdStr === String(conversation.shopId)) {
      senderType = SENDER_TYPE.SHOP;
    } else if (shop?.userId && senderIdStr === String(shop.userId)) {
      senderType = SENDER_TYPE.SHOP;
      senderId = conversation.shopId;
    } else if (Number(row.senderType) === SENDER_TYPE.SHOP) {
      senderType = SENDER_TYPE.SHOP;
    }

    const needsUpdate =
      Number(row.senderType ?? SENDER_TYPE.USER) !== senderType ||
      String(row.senderId || "") !== String(senderId || "");

    if (needsUpdate) {
      await Message.updateOne(
        { _id: row._id },
        { $set: { senderId, senderType, UpdatedAt: new Date() } }
      );
    }
  }
}

async function ensureMessageSequences(conversation) {
  const missing = await Message.find({
    conversationId: conversation._id,
    $or: [{ ThuTu: { $exists: false } }, { ThuTu: null }, { ThuTu: 0 }],
  })
    .sort({ CreatedAt: 1 })
    .select("_id ThuTu CreatedAt");

  if (missing.length === 0) {
    return conversation;
  }

  const maxExisting = await Message.findOne({
    conversationId: conversation._id,
    ThuTu: { $gt: 0 },
  })
    .sort({ ThuTu: -1 })
    .select("ThuTu");

  let counter = Number(maxExisting?.ThuTu) || Number(conversation.nextThuTu) || 0;

  for (const row of missing) {
    counter += 1;
    await Message.updateOne({ _id: row._id }, { $set: { ThuTu: counter, UpdatedAt: new Date() } });
  }

  conversation.nextThuTu = counter;
  await conversation.save();
  return conversation;
}

function buildSequenceMeta(messages, totalCount) {
  const numbered = messages
    .map((message) => Number(message.thuTu))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    from: numbered.length > 0 ? Math.min(...numbered) : 0,
    to: numbered.length > 0 ? Math.max(...numbered) : 0,
    total: totalCount,
    count: messages.length,
  };
}

async function loadMessageImages(messageIds) {
  if (!messageIds.length) {
    return new Map();
  }

  const rows = await MessageImage.find({
    messageId: { $in: messageIds },
    DeletedAt: null,
  }).sort({ sortOrder: 1, CreatedAt: 1 });

  return rows.reduce((map, row) => {
    const key = String(row.messageId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({
      id: row._id,
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
    });
    return map;
  }, new Map());
}

function mapMessageToBroadcast(message, images = []) {
  const isDeleted = Boolean(message.DeletedAt);
  const isImage = Number(message.messageType) === MESSAGE_TYPE.IMAGE;
  const isOffer = Number(message.messageType) === MESSAGE_TYPE.OFFER;
  const imageUri = isImage ? message.content || images[0]?.imageUrl || "" : undefined;
  const textContent = isImage
    ? ""
    : isOffer
      ? parseOfferMessageContent(message.content)
      : message.content || "";

  if (isDeleted) {
    return {
      id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: Number(message.senderType ?? SENDER_TYPE.USER),
      thuTu: message.ThuTu || 0,
      messageType: message.messageType,
      content: "Tin nhắn đã được gỡ",
      isDeleted: true,
      isRead: message.isRead,
      messageStatus: message.messageStatus,
      createdAt: message.CreatedAt,
      timeLabel: formatBubbleTime(message.CreatedAt),
      images: [],
    };
  }

  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderType: Number(message.senderType ?? SENDER_TYPE.USER),
    thuTu: message.ThuTu || 0,
    messageType: message.messageType,
    content: textContent,
    isOffer,
    imageUri,
    images,
    isDeleted: false,
    isRead: message.isRead,
    messageStatus: message.messageStatus,
    createdAt: message.CreatedAt,
    timeLabel: formatBubbleTime(message.CreatedAt),
  };
}

function mapMessageToClient(message, viewer, images = []) {
  const isMine = isMessageFromViewer(message, viewer);
  const isDeleted = Boolean(message.DeletedAt);
  const isImage = Number(message.messageType) === MESSAGE_TYPE.IMAGE;
  const isOffer = Number(message.messageType) === MESSAGE_TYPE.OFFER;
  const imageUri = isImage ? message.content || images[0]?.imageUrl || "" : undefined;
  const textContent = isImage
    ? ""
    : isOffer
      ? parseOfferMessageContent(message.content)
      : message.content || "";

  if (isDeleted) {
    return {
      id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: Number(message.senderType ?? SENDER_TYPE.USER),
      thuTu: message.ThuTu || 0,
      isMine,
      messageType: message.messageType,
      content: "Tin nhắn đã được gỡ",
      isDeleted: true,
      isRead: message.isRead,
      messageStatus: message.messageStatus,
      status: isMine ? mapStatusToString(message.messageStatus) : undefined,
      createdAt: message.CreatedAt,
      timeLabel: formatBubbleTime(message.CreatedAt),
      images: [],
    };
  }

  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderType: Number(message.senderType ?? SENDER_TYPE.USER),
    thuTu: message.ThuTu || 0,
    isMine,
    messageType: message.messageType,
    content: textContent,
    isOffer,
    imageUri,
    images,
    isDeleted: false,
    isRead: message.isRead,
    messageStatus: message.messageStatus,
    status: isMine ? mapStatusToString(message.messageStatus) : undefined,
    createdAt: message.CreatedAt,
    timeLabel: formatBubbleTime(message.CreatedAt),
  };
}

function mapBuyerPublicInfo(buyer) {
  if (!buyer) {
    return null;
  }

  return {
    id: buyer._id,
    fullName: buyer.FullName || "",
    userName: buyer.UserName || "",
    avatar: buyer.Avatar || "",
    phone: buyer.Phone || "",
    ...mapPresenceFields(buyer),
  };
}

async function getShopPublicInfo(shop) {
  const seller = shop?.userId ? await User.findById(shop.userId) : null;
  const displayName = shop?.shopName || seller?.FullName || seller?.UserName || "";

  const name =
    displayName ||
    pickString(shop?.description).slice(0, 40) ||
    "Gian hàng";

  const shopPresence = mapPresenceFields(shop);

  return {
    id: shop._id,
    name,
    shopName: shop.shopName || name,
    shopUsername: shop.shopUsername || "",
    avatar: seller?.Avatar || "",
    phone: shop.phone || seller?.Phone || "",
    description: shop.description || "",
    isOnline: shopPresence.isOnline,
    lastActiveAt: shopPresence.lastActiveAt,
    activityLabel: shopPresence.activityLabel,
  };
}

async function resolveImageContent(imageContent) {
  const raw = pickString(imageContent);
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
    folder: "chat-images",
    fileName: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${resolveFileExtension(mimeType)}`,
  });

  return uploaded.publicUrl;
}

function resolveMessagePayload(payload = {}) {
  const messageType = Number(payload.messageType ?? MESSAGE_TYPE.TEXT);
  if (messageType === MESSAGE_TYPE.OFFER) {
    const content = pickString(payload.content || payload.message);
    if (!content) {
      throw createServiceError("Thiếu nội dung đề nghị giá.");
    }
    let preview = "Đề nghị deal giá";
    try {
      const parsed = JSON.parse(content);
      if (parsed.offeredPrice) {
        preview = `Deal: ${Number(parsed.offeredPrice).toLocaleString("vi-VN")}đ`;
      }
    } catch {
      preview = content.slice(0, 80);
    }
    return {
      messageType: MESSAGE_TYPE.OFFER,
      content,
      preview,
    };
  }
  if (messageType === MESSAGE_TYPE.IMAGE) {
    const imageContent = pickString(payload.imageContent || payload.content);
    if (!imageContent) {
      throw createServiceError("Thiếu dữ liệu ảnh.");
    }
    return {
      messageType: MESSAGE_TYPE.IMAGE,
      rawImageContent: imageContent,
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

async function createConversationMessage(conversation, senderId, senderType, payload, viewer) {
  const resolved = resolveMessagePayload(payload);
  const now = new Date();

  let content = resolved.content || "";
  if (resolved.messageType === MESSAGE_TYPE.IMAGE) {
    content = await resolveImageContent(resolved.rawImageContent);
  }

  const updatedConversation = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $inc: { nextThuTu: 1 },
      $set: {
        lastMessage: resolved.preview,
        lastMessageAt: now,
        UpdatedAt: now,
      },
    },
    { new: true }
  );

  const thuTu = Number(updatedConversation?.nextThuTu) || 1;

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    senderType,
    ThuTu: thuTu,
    messageType: resolved.messageType,
    content,
    isRead: MESSAGE_READ.UNREAD,
    messageStatus: MESSAGE_STATUS.SENT,
    CreatedAt: now,
    UpdatedAt: now,
  });

  let images = [];
  if (resolved.messageType === MESSAGE_TYPE.IMAGE && content) {
    const imageDoc = await MessageImage.create({
      messageId: message._id,
      imageUrl: content,
      sortOrder: 0,
      CreatedAt: now,
      UpdatedAt: now,
    });
    images = [
      {
        id: imageDoc._id,
        imageUrl: imageDoc.imageUrl,
        sortOrder: imageDoc.sortOrder,
      },
    ];
  }

  const clientMessage = mapMessageToBroadcast(message, images);
  emitConversationEvent(String(conversation._id), "message:new", {
    conversationId: String(conversation._id),
    message: clientMessage,
  });

  return message;
}

async function markOpponentMessagesRead(conversation, viewer) {
  const unreadMessages = await Message.find({
    conversationId: conversation._id,
    ...buildOpponentReadFilter(viewer),
    isRead: MESSAGE_READ.UNREAD,
    DeletedAt: null,
  });

  if (unreadMessages.length === 0) {
    return [];
  }

  const messageIds = unreadMessages.map((message) => message._id);
  const now = new Date();

  await Message.updateMany(
    { _id: { $in: messageIds } },
    {
      $set: {
        isRead: MESSAGE_READ.READ,
        messageStatus: MESSAGE_STATUS.SEEN,
        UpdatedAt: now,
      },
    }
  );

  emitConversationEvent(String(conversation._id), "message:read", {
    conversationId: String(conversation._id),
    messageIds: messageIds.map(String),
    status: "seen",
  });

  return messageIds;
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
      ...buildUnreadFilter(buildViewerContext(user, shop, "seller")),
      isRead: MESSAGE_READ.UNREAD,
      DeletedAt: null,
    });

    result.push({
      id: conversation._id,
      lastMessage: conversation.lastMessage || "",
      lastMessageAt: conversation.lastMessageAt || conversation.UpdatedAt,
      timeLabel: formatTime(conversation.lastMessageAt || conversation.UpdatedAt),
      unreadCount,
      buyer: mapBuyerPublicInfo(buyer),
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

async function fetchConversationMessages(conversation, viewer, shop = null) {
  await ensureMessageSequences(conversation);
  await repairMessageSenders(conversation, shop);

  const rows = await Message.find({ conversationId: conversation._id })
    .sort({ ThuTu: 1, CreatedAt: 1 })
    .limit(200);

  const imageMap = await loadMessageImages(rows.map((row) => row._id));
  const clientMessages = rows.map((row) =>
    mapMessageToClient(row, viewer, imageMap.get(String(row._id)) || [])
  );

  const totalCount = await Message.countDocuments({
    conversationId: conversation._id,
    DeletedAt: null,
  });

  return {
    messages: clientMessages,
    sequence: buildSequenceMeta(clientMessages, totalCount),
  };
}

async function listConversationMessages(user, conversationId) {
  const { shop, conversation } = await getOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, shop, "seller");
  await markOpponentMessagesRead(conversation, viewer);
  return fetchConversationMessages(conversation, viewer, shop);
}

async function listBuyerConversationMessages(user, conversationId) {
  const { shop, conversation } = await getBuyerOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, shop, "buyer");
  await markOpponentMessagesRead(conversation, viewer);
  return fetchConversationMessages(conversation, viewer, shop);
}

async function sendSellerMessage(user, conversationId, payload) {
  const { shop, conversation } = await getOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, shop, "seller");
  const message = await createConversationMessage(
    conversation,
    shop._id,
    SENDER_TYPE.SHOP,
    payload,
    viewer
  );
  const images = await loadMessageImages([message._id]);
  return mapMessageToClient(message, viewer, images.get(String(message._id)) || []);
}

async function sendBuyerMessage(user, conversationId, payload) {
  const { shop, conversation } = await getBuyerOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, shop, "buyer");
  const message = await createConversationMessage(
    conversation,
    user._id,
    SENDER_TYPE.USER,
    payload,
    viewer
  );
  const images = await loadMessageImages([message._id]);
  return mapMessageToClient(message, viewer, images.get(String(message._id)) || []);
}

async function deleteMessage(user, conversationId, messageId, { asSeller = false } = {}) {
  const { shop, conversation } = asSeller
    ? await getOwnedConversation(user, conversationId)
    : await getBuyerOwnedConversation(user, conversationId);

  const viewer = buildViewerContext(user, shop, asSeller ? "seller" : "buyer");
  const ownerFilter = asSeller
    ? { senderId: shop._id, senderType: SENDER_TYPE.SHOP }
    : { senderId: user._id, senderType: SENDER_TYPE.USER };

  const message = await Message.findOne({
    _id: messageId,
    conversationId: conversation._id,
    ...ownerFilter,
    DeletedAt: null,
  });

  if (!message) {
    throw createServiceError("Không tìm thấy tin nhắn để gỡ.", 404);
  }

  message.DeletedAt = new Date();
  message.UpdatedAt = new Date();
  message.content = "";
  await message.save();

  const clientMessage = mapMessageToClient(message, viewer);
  emitConversationEvent(String(conversation._id), "message:deleted", {
    conversationId: String(conversation._id),
    message: mapMessageToBroadcast(message),
  });

  return clientMessage;
}

async function getSellerConversationPeer(user, conversationId) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const buyer = await User.findById(conversation.userId);
  return mapBuyerPublicInfo(buyer);
}

async function getBuyerConversationPeer(user, conversationId) {
  const { shop } = await getBuyerOwnedConversation(user, conversationId);
  return getShopPublicInfo(shop);
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
      ...buildUnreadFilter(buildViewerContext(user, shop, "buyer")),
      isRead: MESSAGE_READ.UNREAD,
      DeletedAt: null,
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

async function findOrCreateBuyerConversation(user, shopId, shopName = "") {
  const shop = await resolveShopForBuyerChat(shopId);
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
  const shopName = pickString(payload.shopName);
  const { shop, conversation } = await findOrCreateBuyerConversation(user, shopId, shopName);
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
  deleteMessage,
  getSellerConversationPeer,
  getBuyerConversationPeer,
  startConversationWithShop,
  startConversationWithBuyer,
  findOrCreateBuyerConversation,
  getShopPublicInfo,
  mapBuyerPublicInfo,
};
