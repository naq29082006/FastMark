const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SHOP_OPEN } = require("../constants/shopStatus");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function toPublicShopSettings(shop, user) {
  const categoryId = shop.categoryId?._id
    ? String(shop.categoryId._id)
    : shop.categoryId
      ? String(shop.categoryId)
      : "";

  return {
    shopId: shop._id,
    shopUsername: shop.shopUsername || "",
    shopName: shop.shopName || "",
    categoryId,
    categoryName: shop.categoryId?.categoryName || "",
    description: shop.description || "",
    shopDescription: shop.description || "",
    address: shop.address || "",
    systemAddress: shop.DiaChiHeThong || "",
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    shopPhone: shop.phone || "",
    userPhone: user?.Phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    isOpen: Number(shop.isOpen) === SHOP_OPEN.OPEN ? 1 : 0,
    status: shop.status ?? 1,
  };
}

async function getShopForSeller(user) {
  const shop = await ShopProfile.findOne({ userId: user._id })
    .populate("categoryId", "categoryName")
    .sort({ CreatedAt: -1 });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng.", 404);
  }
  return shop;
}

async function getShopSettings(user) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);
  return toPublicShopSettings(shop, freshUser);
}

function normalizeTime(value) {
  const text = pickString(value);
  if (!text) {
    return "";
  }
  if (!/^\d{1,2}:\d{2}$/.test(text)) {
    throw createServiceError("Giờ mở/đóng cửa phải theo định dạng HH:mm.");
  }
  return text;
}

async function updateShopSettings(user, payload) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);

  if (payload.shopName !== undefined) {
    shop.shopName = pickString(payload.shopName);
  }
  if (payload.description !== undefined || payload.shopDescription !== undefined) {
    shop.description = pickString(payload.description ?? payload.shopDescription);
  }
  if (payload.address !== undefined) {
    shop.address = pickString(payload.address);
  }
  if (payload.systemAddress !== undefined || payload.DiaChiHeThong !== undefined) {
    shop.DiaChiHeThong = pickString(payload.systemAddress ?? payload.DiaChiHeThong);
  }
  if (payload.latitude !== undefined || payload.lat !== undefined) {
    const latitude = Number(payload.latitude ?? payload.lat);
    if (!Number.isFinite(latitude)) {
      throw createServiceError("Tọa độ vĩ độ không hợp lệ.");
    }
    shop.latitude = latitude;
  }
  if (payload.longitude !== undefined || payload.lng !== undefined) {
    const longitude = Number(payload.longitude ?? payload.lng);
    if (!Number.isFinite(longitude)) {
      throw createServiceError("Tọa độ kinh độ không hợp lệ.");
    }
    shop.longitude = longitude;
  }
  if (payload.openTime !== undefined) {
    shop.openTime = normalizeTime(payload.openTime);
  }
  if (payload.closeTime !== undefined) {
    shop.closeTime = normalizeTime(payload.closeTime);
  }
  if (payload.isOpen !== undefined) {
    shop.isOpen = Number(payload.isOpen) === SHOP_OPEN.OPEN ? SHOP_OPEN.OPEN : SHOP_OPEN.CLOSED;
  }

  shop.UpdatedAt = new Date();
  await shop.save();

  return toPublicShopSettings(shop, freshUser);
}

module.exports = {
  getShopSettings,
  updateShopSettings,
  getShopForSeller,
  toPublicShopSettings,
};
