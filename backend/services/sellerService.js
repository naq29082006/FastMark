const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS, USER_ROLE } = require("../constants/sellerVerification");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");

const DEMO_PHONE_CODE = "123456";
const PHONE_VERIFY_TTL_MS = 5 * 60 * 1000;

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureUserHasPhone(user) {
  const phone = String(user.Phone || "").trim();
  if (!phone || phone.length !== 10) {
    throw createServiceError("Bạn cần thêm số điện thoại trước khi đăng ký người bán.");
  }
  return phone;
}

async function requestSellerPhoneCode(user) {
  const phone = ensureUserHasPhone(user);

  if (user.SellerPhoneVerified) {
    return {
      phone,
      alreadyVerified: true,
      expiresAt: null,
      expiresInSeconds: 0,
      devCode: null,
    };
  }

  user.SellerPhoneVerifyCode = DEMO_PHONE_CODE;
  user.SellerPhoneVerifyCodeExpiresAt = new Date(Date.now() + PHONE_VERIFY_TTL_MS);
  await user.save();

  return {
    phone,
    expiresAt: user.SellerPhoneVerifyCodeExpiresAt,
    expiresInSeconds: PHONE_VERIFY_TTL_MS / 1000,
    devCode: DEMO_PHONE_CODE,
  };
}

async function confirmSellerPhoneCode(user, code) {
  ensureUserHasPhone(user);

  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    throw createServiceError("Thiếu mã xác minh.");
  }

  if (!user.SellerPhoneVerifyCode || user.SellerPhoneVerifyCode !== normalizedCode) {
    throw createServiceError(
      user.SellerPhoneVerifyCode
        ? "Mã xác minh không đúng."
        : "Chưa có mã xác minh. Vui lòng gửi lại mã mới."
    );
  }

  if (
    !user.SellerPhoneVerifyCodeExpiresAt ||
    new Date() > user.SellerPhoneVerifyCodeExpiresAt
  ) {
    throw createServiceError("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
  }

  user.SellerPhoneVerifyCode = null;
  user.SellerPhoneVerifyCodeExpiresAt = null;
  user.SellerPhoneVerified = true;
  await user.save();

  const shop = await ShopProfile.findOne({ userId: user._id }).sort({ CreatedAt: -1 });
  if (shop) {
    shop.phone = user.Phone;
    shop.UpdatedAt = new Date();
    await shop.save();
  }

  return { verified: true, phone: user.Phone };
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
  return SellerVerification.findOne({ userId: user._id }).sort({ CreatedAt: -1 });
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

  const existingShop = await ShopProfile.findOne({ userId: user._id });
  if (!existingShop) {
    await ShopProfile.create({
      userId: user._id,
      address: verification.address,
      DiaChiHeThong: verification.DiaChiHeThong || "",
      latitude: verification.latitude,
      longitude: verification.longitude,
      phone: user.Phone,
    });
  } else {
    existingShop.address = verification.address;
    existingShop.DiaChiHeThong = verification.DiaChiHeThong || "";
    existingShop.latitude = verification.latitude;
    existingShop.longitude = verification.longitude;
    existingShop.phone = user.Phone;
    existingShop.UpdatedAt = new Date();
    await existingShop.save();
  }

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

  const address = String(payload.address || "").trim();
  const systemAddress = String(
    payload.systemAddress || payload.DiaChiHeThong || payload.DiachiHethong || ""
  ).trim();
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);

  if (!address) {
    throw createServiceError("Vui lòng nhập địa chỉ.");
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createServiceError("Vui lòng chọn vị trí trên bản đồ.");
  }

  const [cccdFrontImage, cccdBackImage, selfieImage] = await Promise.all([
    resolveVerificationImage({
      user,
      imageBase64: payload.cccdFrontImageBase64,
      mimeType: payload.cccdFrontMimeType,
      existingUrl: existing?.cccdFrontImage,
      folder: "seller-verification",
      label: "cccd-front",
    }),
    resolveVerificationImage({
      user,
      imageBase64: payload.cccdBackImageBase64,
      mimeType: payload.cccdBackMimeType,
      existingUrl: existing?.cccdBackImage,
      folder: "seller-verification",
      label: "cccd-back",
    }),
    resolveVerificationImage({
      user,
      imageBase64: payload.selfieImageBase64,
      mimeType: payload.selfieMimeType,
      existingUrl: existing?.selfieImage,
      folder: "seller-verification",
      label: "selfie",
    }),
  ]);

  const sharedFields = {
    cccdFrontImage,
    cccdBackImage,
    selfieImage,
    address,
    DiaChiHeThong: systemAddress,
    latitude,
    longitude,
    note: String(payload.note || "").trim(),
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
    Object.assign(existing, sharedFields);
    if (!existing.submittedAt) {
      existing.submittedAt = new Date();
    }
    await existing.save();
    return existing;
  }

  const verification = await SellerVerification.create({
    userId: user._id,
    ...sharedFields,
    submittedAt: new Date(),
  });

  return verification;
}

async function listPendingSellerVerifications() {
  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.PENDING,
  })
    .sort({ submittedAt: 1 })
    .populate("userId", "FullName Email Phone UserName");

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
    note: verification.note || "",
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
  DEMO_PHONE_CODE,
  SELLER_VERIFICATION_STATUS,
  requestSellerPhoneCode,
  confirmSellerPhoneCode,
  getMySellerVerification,
  syncSellerRoleFromVerification,
  submitSellerVerification,
  listPendingSellerVerifications,
  approveSellerVerificationByAdmin,
  rejectSellerVerificationByAdmin,
  toPublicVerification,
  toAdminVerification,
};
