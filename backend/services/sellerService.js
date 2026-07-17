const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS, USER_ROLE } = require("../constants/sellerVerification");
const { assertCategoryExists } = require("./categoryService");
const { normalizeCategoryId } = require("../utils/categoryId");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { ensureDefaultShopAvatar } = require("./defaultShopAvatarService");

const PHONE_VERIFY_TTL_MS = 5 * 60 * 1000;
const PHONE_RESEND_COOLDOWN_MS = 3 * 60 * 1000;
const PHONE_VERIFY_MAX_ATTEMPTS = 5;
const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function normalizeShopUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeShopName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function pickPayloadValue(body, keys) {
  for (const key of keys) {
    const value = body?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function normalizeSellerRegistrationPayload(body = {}) {
  const shopName = pickPayloadValue(body, ["shopName", "storeName", "tenGianHang", "TenGianHang"]);
  const shopUsername = pickPayloadValue(body, ["shopUsername", "storeUsername"]);
  const shopDescription = pickPayloadValue(body, [
    "shopDescription",
    "description",
    "bio",
    "shopBio",
    "gioiThieuShop",
  ]);
  const categoryId = pickPayloadValue(body, ["categoryId"]);
  const address = pickPayloadValue(body, ["address", "Address"]);
  const systemAddress = pickPayloadValue(body, [
    "systemAddress",
    "DiaChiHeThong",
    "DiachiHethong",
  ]);

  return {
    ...body,
    shopName: shopName ?? body.shopName,
    shopUsername: shopUsername ?? body.shopUsername,
    shopDescription: shopDescription ?? body.shopDescription,
    categoryId: normalizeCategoryId(categoryId ?? body.categoryId),
    address: address ?? body.address,
    systemAddress: systemAddress ?? body.systemAddress ?? body.DiaChiHeThong,
    latitude: body.latitude ?? body.lat,
    longitude: body.longitude ?? body.lng,
  };
}

function resolveCategoryFields(verification) {
  const category = verification?.categoryId;
  if (category && typeof category === "object" && category.categoryName) {
    return {
      categoryId: normalizeCategoryId(category._id),
      categoryName: category.categoryName || "",
    };
  }

  return {
    categoryId: normalizeCategoryId(verification?.categoryId),
    categoryName: "",
  };
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
      "Tên shop phải từ 3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới."
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

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureUserHasPhone(user) {
  const phone = String(user.Phone || "").trim();
  if (!phone || phone.length !== 10) {
    throw createServiceError("Bạn cần thêm số điện thoại trước khi xác minh.");
  }
  return phone;
}

function normalizePhone(phone) {
  return String(phone || "").trim();
}

function assertPhoneFormat(phone) {
  const normalized = normalizePhone(phone);
  if (!/^\d{10}$/.test(normalized)) {
    throw createServiceError("Số điện thoại phải gồm đúng 10 chữ số.");
  }
  return normalized;
}

async function assertPhoneAvailable(phone, userId) {
  const normalized = assertPhoneFormat(phone);
  const existing = await User.findOne({
    Phone: normalized,
    _id: { $ne: userId },
  }).lean();
  if (existing) {
    throw createServiceError("Số điện thoại đã được sử dụng bởi tài khoản khác.");
  }
  return normalized;
}

function generatePhoneVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function encodePhoneVerifyPayload(phone, code) {
  return `${phone}|${code}`;
}

function decodePhoneVerifyPayload(payload) {
  const text = String(payload || "");
  const separator = text.lastIndexOf("|");
  if (separator <= 0 || separator === text.length - 1) {
    return { phone: "", code: "" };
  }
  return {
    phone: text.slice(0, separator),
    code: text.slice(separator + 1),
  };
}

function getResendWaitSeconds(user) {
  if (!user.SellerPhoneVerifyResendAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((new Date(user.SellerPhoneVerifyResendAt).getTime() - Date.now()) / 1000));
}

function clearPhoneVerifySession(user) {
  user.SellerPhoneVerifyCode = null;
  user.SellerPhoneVerifyCodeExpiresAt = null;
  user.SellerPhoneVerifyFailCount = 0;
}

async function requestSellerPhoneCode(user, phoneInput) {
  const targetPhone = await assertPhoneAvailable(phoneInput, user._id);

  const currentPhone = normalizePhone(user.Phone);
  if (user.SellerPhoneVerified && currentPhone && currentPhone === targetPhone) {
    return {
      phone: targetPhone,
      alreadyVerified: true,
      expiresAt: null,
      expiresInSeconds: 0,
      resendAvailableAt: null,
      resendCooldownSeconds: 0,
    };
  }

  const resendWaitSeconds = getResendWaitSeconds(user);
  if (resendWaitSeconds > 0) {
    const error = createServiceError(
      `Vui lòng đợi ${resendWaitSeconds} giây trước khi gửi lại mã.`,
      429
    );
    error.data = {
      resendAvailableAt: user.SellerPhoneVerifyResendAt,
      resendCooldownSeconds: resendWaitSeconds,
    };
    throw error;
  }

  const code = generatePhoneVerifyCode();
  const now = Date.now();
  user.SellerPhoneVerifyCode = encodePhoneVerifyPayload(targetPhone, code);
  user.SellerPhoneVerifyCodeExpiresAt = new Date(now + PHONE_VERIFY_TTL_MS);
  user.SellerPhoneVerifyResendAt = new Date(now + PHONE_RESEND_COOLDOWN_MS);
  user.SellerPhoneVerifyFailCount = 0;
  await user.save();

  return {
    phone: targetPhone,
    verificationCode: code,
    expiresAt: user.SellerPhoneVerifyCodeExpiresAt,
    expiresInSeconds: PHONE_VERIFY_TTL_MS / 1000,
    resendAvailableAt: user.SellerPhoneVerifyResendAt,
    resendCooldownSeconds: PHONE_RESEND_COOLDOWN_MS / 1000,
  };
}

async function confirmSellerPhoneCode(user, code, phoneInput) {
  const phone = await assertPhoneAvailable(phoneInput, user._id);
  const normalizedCode = String(code || "").trim();

  if (!normalizedCode) {
    throw createServiceError("Thiếu mã xác minh.");
  }

  if ((Number(user.SellerPhoneVerifyFailCount) || 0) >= PHONE_VERIFY_MAX_ATTEMPTS) {
    clearPhoneVerifySession(user);
    user.SellerPhoneVerifyResendAt = null;
    await user.save();
    const error = createServiceError(
      "Bạn đã nhập sai quá 5 lần. Phiên xác minh đã bị hủy.",
      429
    );
    error.data = { lockedOut: true };
    throw error;
  }

  if (!user.SellerPhoneVerifyCode) {
    throw createServiceError("Chưa có mã xác minh. Vui lòng gửi mã mới.");
  }

  if (
    !user.SellerPhoneVerifyCodeExpiresAt ||
    new Date() > user.SellerPhoneVerifyCodeExpiresAt
  ) {
    throw createServiceError("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
  }

  const stored = decodePhoneVerifyPayload(user.SellerPhoneVerifyCode);
  if (stored.phone !== phone || stored.code !== normalizedCode) {
    const failCount = (Number(user.SellerPhoneVerifyFailCount) || 0) + 1;
    user.SellerPhoneVerifyFailCount = failCount;

    if (failCount >= PHONE_VERIFY_MAX_ATTEMPTS) {
      clearPhoneVerifySession(user);
      user.SellerPhoneVerifyResendAt = null;
      await user.save();
      const error = createServiceError(
        "Bạn đã nhập sai quá 5 lần. Phiên xác minh đã bị hủy.",
        429
      );
      error.data = { lockedOut: true };
      throw error;
    }

    await user.save();
    throw createServiceError(
      `Mã xác minh không đúng. Còn ${PHONE_VERIFY_MAX_ATTEMPTS - failCount} lần thử.`
    );
  }

  user.Phone = phone;
  clearPhoneVerifySession(user);
  user.SellerPhoneVerifyResendAt = null;
  user.SellerPhoneVerified = true;
  await user.save();

  const shop = await ShopProfile.findOne({ userId: user._id }).sort({ CreatedAt: -1 });
  if (shop) {
    shop.phone = phone;
    shop.UpdatedAt = new Date();
    await shop.save();
  }

  return { verified: true, phone };
}

async function uploadSellerImage({ user, imageBase64, mimeType, folder, label }) {
  if (!imageBase64) {
    throw createServiceError(`Thiếu ảnh ${label}.`);
  }

  const normalizedBase64 = String(imageBase64).replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    ""
  );
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw createServiceError(`Ảnh ${label} không hợp lệ.`);
  }

  const extension = resolveFileExtension(mimeType);
  const fileName = `${user.FirebaseUID}-${label}-${Date.now()}.${extension}`;
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType: mimeType || "image/jpeg",
    folder,
    fileName,
  });

  return uploadResult.publicUrl;
}

async function resolveVerificationImage({
  user,
  imageBase64,
  mimeType,
  existingUrl,
  folder,
  label,
}) {
  if (imageBase64) {
    return uploadSellerImage({
      user,
      imageBase64,
      mimeType,
      folder,
      label,
    });
  }

  if (existingUrl) {
    return existingUrl;
  }

  throw createServiceError(`Thiếu ảnh ${label}.`);
}

async function getMySellerVerification(user) {
  return SellerVerification.findOne({ userId: user._id })
    .sort({ CreatedAt: -1 })
    .populate("categoryId", "categoryName");
}

async function reloadVerificationById(verificationId) {
  if (!verificationId) {
    return null;
  }

  return SellerVerification.findById(verificationId).populate("categoryId", "categoryName");
}

async function promoteUserToSeller(user, verification, approvedById = null) {
  verification.status = SELLER_VERIFICATION_STATUS.APPROVED;
  verification.approvedAt = new Date();
  verification.approvedBy = approvedById;
  verification.LyDoTuChoi = "";
  verification.rejectedAt = null;
  verification.UpdatedAt = new Date();
  await verification.save();

  user.Role = USER_ROLE.SELLER;
  await user.save();

  const categoryId = verification.categoryId?._id || verification.categoryId || null;

  const existingShop = await ShopProfile.findOne({ userId: user._id });
  let shop = existingShop;
  if (!existingShop) {
    shop = await ShopProfile.create({
      userId: user._id,
      shopUsername: verification.shopUsername || "",
      shopName: verification.shopName || user.FullName || user.UserName || "",
      categoryId,
      description: verification.shopDescription || "",
      avatar: "",
      address: verification.address,
      DiaChiHeThong: verification.DiaChiHeThong || "",
      latitude: verification.latitude,
      longitude: verification.longitude,
      phone: user.Phone,
    });
  } else {
    existingShop.shopUsername = verification.shopUsername || existingShop.shopUsername || "";
    existingShop.shopName =
      verification.shopName || existingShop.shopName || user.FullName || user.UserName || "";
    if (categoryId) {
      existingShop.categoryId = categoryId;
    }
    if (verification.shopDescription) {
      existingShop.description = verification.shopDescription;
    }
    existingShop.address = verification.address;
    existingShop.DiaChiHeThong = verification.DiaChiHeThong || "";
    existingShop.latitude = verification.latitude;
    existingShop.longitude = verification.longitude;
    existingShop.phone = user.Phone;
    existingShop.UpdatedAt = new Date();
    await existingShop.save();
    shop = existingShop;
  }

  await ensureDefaultShopAvatar(shop, user);

  return verification;
}

async function syncSellerRoleFromVerification(user) {
  const verification = await getMySellerVerification(user);

  if (!verification) {
    return verification;
  }

  if (verification.status === SELLER_VERIFICATION_STATUS.APPROVED) {
    if (user.Role !== USER_ROLE.SELLER) {
      await promoteUserToSeller(user, verification);
    } else {
      const shop = await ShopProfile.findOne({ userId: user._id }).sort({ CreatedAt: -1 });
      if (shop) {
        await ensureDefaultShopAvatar(shop, user);
      }
    }
    return verification;
  }

  if (user.Role === USER_ROLE.SELLER) {
    user.Role = USER_ROLE.BUYER;
    await user.save();
  }

  return verification;
}

async function submitSellerVerification(user, payload) {
  const normalizedPayload = normalizeSellerRegistrationPayload(payload);

  if (!user.SellerPhoneVerified) {
    throw createServiceError("Bạn cần xác minh số điện thoại trước khi đăng ký người bán.");
  }

  if (user.Role === USER_ROLE.SELLER) {
    throw createServiceError("Tài khoản đã là người bán.");
  }

  const existing = await getMySellerVerification(user);

  if (existing?.status === SELLER_VERIFICATION_STATUS.APPROVED) {
    throw createServiceError("Tài khoản đã được duyệt người bán.");
  }

  const address = String(normalizedPayload.address || "").trim();
  const systemAddress = String(normalizedPayload.systemAddress || "").trim();
  const latitude = Number(normalizedPayload.latitude);
  const longitude = Number(normalizedPayload.longitude);

  if (!address) {
    throw createServiceError("Vui lòng nhập địa chỉ.");
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createServiceError("Vui lòng chọn vị trí trên bản đồ.");
  }

  const shopUsername = await assertShopUsernameAvailable(
    normalizedPayload.shopUsername,
    user._id
  );
  const shopName = assertShopNameValid(normalizedPayload.shopName);
  const category = await assertCategoryExists(normalizedPayload.categoryId);
  const shopDescription = String(normalizedPayload.shopDescription || "").trim();

  if (!shopDescription) {
    throw createServiceError("Vui lòng nhập giới thiệu shop.");
  }

  const [cccdFrontImage, cccdBackImage, selfieImage] = await Promise.all([
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.cccdFrontImageBase64,
      mimeType: normalizedPayload.cccdFrontMimeType,
      existingUrl:
        existing?.cccdFrontImage || normalizedPayload.cccdFrontImageUrl || null,
      folder: "seller-verification",
      label: "cccd-front",
    }),
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.cccdBackImageBase64,
      mimeType: normalizedPayload.cccdBackMimeType,
      existingUrl: existing?.cccdBackImage || normalizedPayload.cccdBackImageUrl || null,
      folder: "seller-verification",
      label: "cccd-back",
    }),
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.selfieImageBase64,
      mimeType: normalizedPayload.selfieMimeType,
      existingUrl: existing?.selfieImage || normalizedPayload.selfieImageUrl || null,
      folder: "seller-verification",
      label: "selfie",
    }),
  ]);

  const sharedFields = {
    cccdFrontImage,
    cccdBackImage,
    selfieImage,
    shopUsername,
    shopName,
    categoryId: category._id,
    shopDescription,
    address,
    DiaChiHeThong: systemAddress,
    latitude,
    longitude,
    status: SELLER_VERIFICATION_STATUS.PENDING,
    LyDoTuChoi: "",
    rejectedAt: null,
    approvedAt: null,
    approvedBy: null,
    UpdatedAt: new Date(),
  };

  if (
    existing &&
    (existing.status === SELLER_VERIFICATION_STATUS.PENDING ||
      existing.status === SELLER_VERIFICATION_STATUS.REJECTED)
  ) {
    existing.set(sharedFields);
    if (!existing.submittedAt) {
      existing.submittedAt = new Date();
    }
    await existing.save();
    return reloadVerificationById(existing._id);
  }

  const verification = await SellerVerification.create({
    userId: user._id,
    ...sharedFields,
    submittedAt: new Date(),
  });

  return reloadVerificationById(verification._id);
}

async function listPendingSellerVerifications() {
  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.PENDING,
  })
    .sort({ submittedAt: 1 })
    .populate("userId", "FullName Email Phone UserName")
    .populate("categoryId", "categoryName");

  return verifications;
}

async function approveSellerVerificationByAdmin(adminUser, verificationId) {
  const verification = await SellerVerification.findById(verificationId);
  if (!verification) {
    throw createServiceError("Không tìm thấy hồ sơ đăng ký.", 404);
  }

  if (verification.status !== SELLER_VERIFICATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể duyệt hồ sơ đang chờ duyệt.");
  }

  const sellerUser = await User.findById(verification.userId);
  if (!sellerUser) {
    throw createServiceError("Không tìm thấy người dùng của hồ sơ.", 404);
  }

  await promoteUserToSeller(sellerUser, verification, adminUser._id);
  return verification;
}

async function rejectSellerVerificationByAdmin(adminUser, verificationId, reason) {
  const verification = await SellerVerification.findById(verificationId);
  if (!verification) {
    throw createServiceError("Không tìm thấy hồ sơ đăng ký.", 404);
  }

  if (verification.status !== SELLER_VERIFICATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể từ chối hồ sơ đang chờ duyệt.");
  }

  const lyDoTuChoi = String(reason || "").trim();
  if (!lyDoTuChoi) {
    throw createServiceError("Vui lòng nhập lý do từ chối.");
  }

  verification.status = SELLER_VERIFICATION_STATUS.REJECTED;
  verification.LyDoTuChoi = lyDoTuChoi;
  verification.rejectedAt = new Date();
  verification.approvedAt = null;
  verification.approvedBy = null;
  verification.UpdatedAt = new Date();
  await verification.save();

  return verification;
}

function toPublicVerification(verification) {
  if (!verification) {
    return null;
  }

  const category = resolveCategoryFields(verification);

  return {
    id: verification._id,
    userId: verification.userId,
    cccdFrontImage: verification.cccdFrontImage || "",
    cccdBackImage: verification.cccdBackImage || "",
    selfieImage: verification.selfieImage || "",
    address: verification.address || "",
    DiaChiHeThong: verification.DiaChiHeThong || "",
    latitude: verification.latitude,
    longitude: verification.longitude,
    shopUsername: verification.shopUsername || "",
    shopName: verification.shopName || "",
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    shopDescription: verification.shopDescription || "",
    status: verification.status,
    lyDoTuChoi: verification.LyDoTuChoi || "",
    submittedAt: verification.submittedAt,
    approvedAt: verification.approvedAt,
    rejectedAt: verification.rejectedAt,
    createdAt: verification.CreatedAt,
    updatedAt: verification.UpdatedAt,
  };
}

function toAdminVerification(verification) {
  const publicData = toPublicVerification(verification);
  if (!publicData) {
    return null;
  }

  const user = verification.userId;
  return {
    ...publicData,
    user: user && typeof user === "object"
      ? {
          id: user._id,
          fullName: user.FullName || "",
          email: user.Email || "",
          phone: user.Phone || "",
          userName: user.UserName || "",
        }
      : null,
  };
}

module.exports = {
  SELLER_VERIFICATION_STATUS,
  requestSellerPhoneCode,
  confirmSellerPhoneCode,
  getMySellerVerification,
  syncSellerRoleFromVerification,
  submitSellerVerification,
  normalizeSellerRegistrationPayload,
  listPendingSellerVerifications,
  approveSellerVerificationByAdmin,
  rejectSellerVerificationByAdmin,
  toPublicVerification,
  toAdminVerification,
};
