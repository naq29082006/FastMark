const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SHOP_OPEN } = require("../constants");
const { isSubscriptionActive, isRecordActive } = require("../constants");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const {
  pickString,
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
  assertShopNameValid,
  assertShopUsernameAvailable,
  normalizeShopUsername,
} = require("../utils/shopIdentity");
const {
  resolveShopLatlong,
  applyShopLatlongFromPayload,
} = require("../utils/shopCoordinates");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveShopQrId(shop) {
  return String(shop?._id || shop?.id || "").trim();
}

function toPublicShopSettings(shop, user) {
  const categoryId = shop.categoryId?._id
    ? String(shop.categoryId._id)
    : shop.categoryId
      ? String(shop.categoryId)
      : "";

  const shopName = resolveShopDisplayName(shop, user);
  const shopUsername = resolveShopUsername(shop, user);
  const shopAvatar = resolveShopAvatar(shop, user);
  const ownerAvatar = pickString(user?.Avatar) || "";
  const systemAddress = pickString(shop.addressHeThong || shop.DiaChiHeThong || shop.address);
  const depositPercent = Math.max(
    0,
    Math.min(100, Number(shop.cocTien ?? shop.depositPercent) || 0)
  );
  const coords = resolveShopLatlong(shop);
  const shopQrId = resolveShopQrId(shop);

  return {
    id: shop._id,
    shopId: shop._id,
    shopName,
    shopUsername,
    shopAvatar,
    fullName: pickString(user?.FullName) || "",
    userName: pickString(user?.UserName) || "",
    avatar: ownerAvatar,
    userAvatar: ownerAvatar,
    categoryId,
    categoryName: shop.categoryId?.categoryName || "",
    description: shop.description || "",
    shopDescription: shop.description || "",
    systemAddress,
    addressHeThong: systemAddress,
    address: systemAddress,
    latlong: coords,
    latitude: coords.lat,
    longitude: coords.long,
    shopPhone: user?.Phone || "",
    userPhone: user?.Phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    isOpen: Number(shop.isOpen) === SHOP_OPEN.OPEN ? 1 : 0,
    status: shop.status ?? 1,
    followersCount: Number(shop.followersCount) || 0,
    depositPercent,
    cocTien: depositPercent,
    qrCodeValue: shopQrId,
    qrPayload: JSON.stringify({ shopId: shopQrId }),
    subscriptionActive: isSubscriptionActive(shop),
    isActive: isRecordActive(shop.isActive),
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
  const base = toPublicShopSettings(shop, freshUser);

  const { findActiveSubscription } = require("./sellerPlanAccessService");
  const { listShopPurchases } = require("./sellerSubscriptionService");
  const active = await findActiveSubscription(shop._id);
  const purchases = await listShopPurchases(shop._id);
  let expiresAt = active?.endDate || null;
  if (purchases.length) {
    const maxEnd = purchases.reduce((max, row) => {
      const end = row.endDate ? new Date(row.endDate).getTime() : 0;
      return end > max ? end : max;
    }, 0);
    if (maxEnd > 0) expiresAt = new Date(maxEnd);
  }
  const oldest = [...purchases].sort((a, b) => {
    const left = new Date(a.ngayMua || a.createdAt || a.startDate || 0).getTime();
    const right = new Date(b.ngayMua || b.createdAt || b.startDate || 0).getTime();
    return left - right;
  })[0];

  return {
    ...base,
    subscriptionPlan: active?.planName || null,
    goiDangki: active?.planName || null,
    ngayMua: oldest?.ngayMua || oldest?.createdAt || oldest?.startDate || active?.ngayMua || active?.CreatedAt || active?.startDate || null,
    subscriptionExpiresAt: expiresAt,
    ngayHetHan: expiresAt,
    subscriptionActive: Boolean(active) || purchases.length > 0,
    purchases,
    purchaseCount: purchases.length,
  };
}

function normalizeTime(value) {
  const text = pickString(value);
  if (!text) {
    return "";
  }

  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    throw createServiceError("Giờ mở/đóng cửa phải theo định dạng HH:mm.");
  }

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function updateShopSettings(user, payload) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);

  if (payload.shopName !== undefined || payload.storeName !== undefined) {
    try {
      shop.shopName = assertShopNameValid(payload.shopName ?? payload.storeName);
    } catch (nameError) {
      throw createServiceError(nameError.message, nameError.statusCode || 400);
    }
  }

  if (payload.shopUsername !== undefined || payload.storeUsername !== undefined) {
    const nextUsername = payload.shopUsername ?? payload.storeUsername;
    const normalizedCurrent = normalizeShopUsername(shop.shopUsername);
    const normalizedNext = normalizeShopUsername(nextUsername);
    if (normalizedNext && normalizedNext !== normalizedCurrent) {
      try {
        shop.shopUsername = await assertShopUsernameAvailable(normalizedNext, user._id);
      } catch (usernameError) {
        throw createServiceError(usernameError.message, usernameError.statusCode || 400);
      }
    } else if (normalizedNext) {
      shop.shopUsername = normalizedNext;
    }
  }

  if (payload.description !== undefined || payload.shopDescription !== undefined) {
    shop.description = pickString(payload.description ?? payload.shopDescription);
  }
  if (
    payload.systemAddress !== undefined ||
    payload.addressHeThong !== undefined ||
    payload.DiaChiHeThong !== undefined ||
    payload.address !== undefined
  ) {
    shop.addressHeThong = pickString(
      payload.systemAddress ??
        payload.addressHeThong ??
        payload.DiaChiHeThong ??
        payload.address
    );
  }
  if (
    payload.latlong !== undefined ||
    payload.latitude !== undefined ||
    payload.lat !== undefined ||
    payload.longitude !== undefined ||
    payload.lng !== undefined ||
    payload.long !== undefined
  ) {
    try {
      applyShopLatlongFromPayload(shop, payload);
    } catch (coordError) {
      throw createServiceError(coordError.message, coordError.statusCode || 400);
    }
  }
  if (payload.openTime !== undefined) {
    shop.openTime = normalizeTime(payload.openTime);
    shop.markModified("openTime");
  }
  if (payload.closeTime !== undefined) {
    shop.closeTime = normalizeTime(payload.closeTime);
    shop.markModified("closeTime");
  }
  if (payload.isOpen !== undefined) {
    shop.isOpen = Number(payload.isOpen) === SHOP_OPEN.OPEN ? SHOP_OPEN.OPEN : SHOP_OPEN.CLOSED;
  }

  if (payload.depositPercent !== undefined || payload.cocTien !== undefined) {
    const percent = Math.round(Number(payload.cocTien ?? payload.depositPercent));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw createServiceError("Phần trăm đặt cọc phải từ 0 đến 100.");
    }
    shop.cocTien = percent;
  }

  shop.UpdatedAt = new Date();
  await shop.save();

  const savedShop = await ShopProfile.findById(shop._id).populate("categoryId", "categoryName");
  return toPublicShopSettings(savedShop || shop, freshUser);
}

async function checkShopUsernameAvailability(user, shopUsername) {
  try {
    const normalized = await assertShopUsernameAvailable(shopUsername, user._id);
    return {
      available: true,
      shopUsername: normalized,
      message: "",
    };
  } catch (error) {
    return {
      available: false,
      shopUsername: normalizeShopUsername(shopUsername),
      message: error.message || "Username shop đã được sử dụng.",
    };
  }
}

async function uploadShopAvatar(user, avatarPayload) {
  if (!avatarPayload?.buffer?.length) {
    throw createServiceError("Thiếu file ảnh đại diện gian hàng.", 400);
  }

  const shop = await getShopForSeller(user);
  const extension = resolveFileExtension(avatarPayload.mimeType, avatarPayload.originalName);
  const fileName = `${user.FirebaseUID || user._id}-shop-${Date.now()}.${extension}`;
  const uploadResult = await uploadImageToSupabase({
    buffer: avatarPayload.buffer,
    mimeType: avatarPayload.mimeType || "image/jpeg",
    folder: "shop-avatars",
    fileName,
  });

  shop.avatar = uploadResult.publicUrl;
  shop.UpdatedAt = new Date();
  await shop.save();

  const savedShop = await ShopProfile.findById(shop._id).populate("categoryId", "categoryName");
  const freshUser = await User.findById(user._id);
  return toPublicShopSettings(savedShop || shop, freshUser);
}

module.exports = {
  getShopSettings,
  updateShopSettings,
  uploadShopAvatar,
  checkShopUsernameAvailability,
  getShopForSeller,
  toPublicShopSettings,
};
