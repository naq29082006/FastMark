const ShopProfile = require("../models/ShopProfile");
const SellerVerification = require("../models/SellerVerification");
const User = require("../models/User");
const { SHOP_OPEN } = require("../constants/shopStatus");
const { SELLER_VERIFICATION_STATUS } = require("../constants/sellerVerification");
const { isSubscriptionActive } = require("../constants/sellerSubscription");
const {
  resolveFileExtension,
  uploadImageToSupabase,
} = require("./uploadService");

const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizeShopName(value) {
  return pickString(value).replace(/\s+/g, " ");
}

function normalizeShopUsername(value) {
  return pickString(value).toLowerCase();
}

function assertShopNameValid(shopName) {
  const normalized = normalizeShopName(shopName);
  if (normalized.length < 2 || normalized.length > 80) {
    throw createServiceError("Tên gian hàng phải từ 2-80 ký tự.");
  }
  return normalized;
}

async function assertShopUsernameAvailable(shopUsername, userId) {
  const normalized = normalizeShopUsername(shopUsername);

  if (!SHOP_USERNAME_PATTERN.test(normalized)) {
    throw createServiceError(
      "Username shop phải từ 3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới."
    );
  }

  const existingUserName = await User.findOne({
    UserName: {
      $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  }).lean();
  if (existingUserName) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  const existingShop = await ShopProfile.findOne({ shopUsername: normalized }).lean();
  if (existingShop && String(existingShop.userId) !== String(userId)) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  const pendingVerification = await SellerVerification.findOne({
    shopUsername: normalized,
    status: SELLER_VERIFICATION_STATUS.PENDING,
    userId: { $ne: userId },
  }).lean();

  if (pendingVerification) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  return normalized;
}

function toPublicShopSettings(shop, user) {
  const categoryId = shop.categoryId?._id
    ? String(shop.categoryId._id)
    : shop.categoryId
      ? String(shop.categoryId)
      : "";

  const ownerName = pickString(user?.FullName) || pickString(user?.UserName) || "";
  const ownerUsername = pickString(user?.UserName) || "";

  return {
    id: shop._id,
    shopId: shop._id,
    // Identity from User — shop no longer has a separate public name/handle.
    shopUsername: ownerUsername || shop.shopUsername || "",
    shopName: ownerName || shop.shopName || "",
    fullName: ownerName,
    userName: ownerUsername,
    categoryId,
    categoryName: shop.categoryId?.categoryName || "",
    description: shop.description || "",
    shopDescription: shop.description || "",
    avatar: shop.avatar || "",
    shopAvatar: shop.avatar || "",
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
    followersCount: Number(user?.FollowersCount) || Number(shop.followersCount) || 0,
    allowReserve: shop.allowReserve !== false,
    depositPercent: Math.max(0, Math.min(100, Number(shop.depositPercent) || 0)),
    pinHours: Boolean(shop.pinHours),
    subscriptionPlan: shop.subscriptionPlan || null,
    subscriptionExpiresAt: shop.subscriptionExpiresAt || null,
    subscriptionActive: isSubscriptionActive(shop),
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
  // Keep legacy shopName/shopUsername mirrored from User for older clients.
  const ownerName = pickString(freshUser?.FullName) || pickString(freshUser?.UserName);
  const ownerUsername = pickString(freshUser?.UserName);
  let dirty = false;
  if (ownerName && shop.shopName !== ownerName) {
    shop.shopName = ownerName;
    dirty = true;
  }
  if (ownerUsername && shop.shopUsername !== ownerUsername) {
    shop.shopUsername = ownerUsername;
    dirty = true;
  }
  if (dirty) {
    await shop.save().catch(() => null);
  }
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

  // Name / username always follow the buyer User identity.
  shop.shopName = pickString(freshUser?.FullName) || pickString(freshUser?.UserName) || shop.shopName;
  shop.shopUsername = pickString(freshUser?.UserName) || shop.shopUsername;

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

  if (payload.allowReserve !== undefined) {
    shop.allowReserve = Boolean(payload.allowReserve);
  }

  if (payload.depositPercent !== undefined) {
    const percent = Math.round(Number(payload.depositPercent));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw createServiceError("Phần trăm đặt cọc phải từ 0 đến 100.");
    }
    shop.depositPercent = percent;
  }

  if (payload.pinHours !== undefined) {
    shop.pinHours = Boolean(payload.pinHours);
  }

  if (payload.avatar !== undefined || payload.shopAvatar !== undefined) {
    shop.avatar = pickString(payload.avatar ?? payload.shopAvatar);
  }

  shop.UpdatedAt = new Date();
  await shop.save();

  return toPublicShopSettings(shop, freshUser);
}

async function uploadShopAvatar(user, { imageBase64, mimeType }) {
  if (!imageBase64) {
    throw createServiceError("Thiếu dữ liệu ảnh gian hàng.");
  }

  const normalizedBase64 = String(imageBase64).replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    ""
  );
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw createServiceError("Ảnh gian hàng không hợp lệ.");
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw createServiceError("Ảnh không được lớn hơn 5MB.");
  }

  const shop = await getShopForSeller(user);
  const extension = resolveFileExtension(mimeType || "image/jpeg");
  const fileName = `${user.FirebaseUID}-shop-${Date.now()}.${extension}`;
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType: mimeType || "image/jpeg",
    folder: "shop-avatars",
    fileName,
  });

  shop.avatar = uploadResult.publicUrl;
  shop.UpdatedAt = new Date();
  await shop.save();

  const freshUser = await User.findById(user._id);
  return {
    shop: toPublicShopSettings(shop, freshUser),
    avatarUrl: uploadResult.publicUrl,
    storagePath: uploadResult.path,
  };
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

module.exports = {
  getShopSettings,
  updateShopSettings,
  uploadShopAvatar,
  checkShopUsernameAvailability,
  getShopForSeller,
  toPublicShopSettings,
};
