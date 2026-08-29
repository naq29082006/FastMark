const User = require("../models/User");
const { MF } = require("../constants/modelFields");
const ShopProfile = require("../models/ShopProfile");
const { mapPresenceFields } = require("../utils/activityLabel");

function buildPresencePayload({ userId, shopId, target, presence }) {
  return {
    target,
    userId: String(userId),
    shopId: shopId ? String(shopId) : null,
    ...presence,
  };
}

async function emitPresenceUpdate({ userId, shopId, target, presence }) {
  const { emitUserEvent } = require("../socket");
  const payload = buildPresencePayload({ userId, shopId, target, presence });
  emitUserEvent(String(userId), "presence:update", payload);
}

async function findShopByUser(user) {
  return ShopProfile.findOne({ userId: user._id });
}

async function touchUserActivity(user) {
  user[MF.HoatDongCuoi] = new Date();
  await user.save();
  return mapPresenceFields(user);
}

async function setUserOnline(user) {
  const presence = await touchUserActivity(user);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: null,
    target: "user",
    presence,
  });
  return presence;
}

async function setUserOffline(user) {
  const presence = await touchUserActivity(user);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: null,
    target: "user",
    presence,
  });
  return presence;
}

async function setShopOnline(user) {
  const shop = await findShopByUser(user);
  if (!shop) {
    const error = new Error("Chưa có gian hàng để bật trạng thái hoạt động.");
    error.statusCode = 404;
    throw error;
  }

  const freshUser = await User.findById(user._id);
  const presence = await touchUserActivity(freshUser || user);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: shop._id,
    target: "shop",
    presence,
  });
  return presence;
}

async function setShopOffline(user) {
  const shop = await findShopByUser(user);
  if (!shop) {
    return null;
  }

  const freshUser = await User.findById(user._id);
  const presence = await touchUserActivity(freshUser || user);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: shop._id,
    target: "shop",
    presence,
  });
  return presence;
}

module.exports = {
  setUserOnline,
  setUserOffline,
  setShopOnline,
  setShopOffline,
};
