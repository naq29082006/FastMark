const ShopProfile = require("../models/ShopProfile");
const { mapPresenceFields } = require("../utils/activityLabel");
const { emitUserEvent } = require("../socket");

function emitPresenceUpdate({ userId, shopId, target, presence }) {
  emitUserEvent(String(userId), "presence:update", {
    target,
    userId: String(userId),
    shopId: shopId ? String(shopId) : null,
    ...presence,
  });
}

async function findShopByUser(user) {
  return ShopProfile.findOne({ userId: user._id });
}

async function setUserOnline(user) {
  user.DangHoatDong = true;
  user.LanHoatDongCuoi = new Date();
  await user.save();

  const presence = mapPresenceFields(user);
  emitPresenceUpdate({
    userId: user._id,
    shopId: null,
    target: "user",
    presence,
  });

  return presence;
}

async function setUserOffline(user) {
  user.DangHoatDong = false;
  user.LanHoatDongCuoi = new Date();
  await user.save();

  const presence = mapPresenceFields(user);
  emitPresenceUpdate({
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

  shop.DangHoatDong = true;
  shop.LanHoatDongCuoi = new Date();
  await shop.save();

  const presence = mapPresenceFields(shop);
  emitPresenceUpdate({
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

  shop.DangHoatDong = false;
  shop.LanHoatDongCuoi = new Date();
  await shop.save();

  const presence = mapPresenceFields(shop);
  emitPresenceUpdate({
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
