const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS, USER_ROLE, SHOP_STATUS } = require("../constants");
const { assertCategoryExists } = require("./categoryService");
const { normalizeCategoryId } = require("../utils/categoryId");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendUniqueOrConditions,
  resolveStatusesFromLabelSearch,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { ensureDefaultUserAvatar } = require("./defaultUserAvatarService");
const {
  OTP_PURPOSE,
  getOtpSession,
  setOtpSession,
  clearOtpSession,
  bumpOtpFailCount,
} = require("./otpSessionStore");
const {
  pickString,
  assertShopNameValid,
  assertShopUsernameAvailable,
} = require("../utils/shopIdentity");
const {
  isPusherConfigured,
  sendPhoneVerificationCode,
} = require("./pusherService");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");
const {
  PENDING_REVIEW_MESSAGE,
  META_TYPE,
  parseVerificationMeta,
  buildAttpMeta,
  buildReReviewPendingMeta,
  buildSnapshotFromVerification,
  applySnapshotToVerification,
  isPendingReReviewVerification,
  isShopOwnerPendingReReview,
  assertShopOwnerCanSell,
  enrichPublicVerification,
} = require("../utils/sellerVerificationReReview");

function resolveBusinessImage(source) {
  if (!source) {
    return "";
  }
  return pickString(
    source.anhKD ??
      source.businessDocImage ??
      source.businessDoc?.imageUrl
  );
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
  const categoryId = pickPayloadValue(body, ["categoryId"]);
  const address = pickPayloadValue(body, ["address", "Address"]);
  const systemAddress = pickPayloadValue(body, [
    "systemAddress",
    "addressHeThong",
    "DiaChiHeThong",
    "DiachiHethong",
  ]);
  const fullName = pickPayloadValue(body, ["fullName", "cccdFullName", "hoTen", "HoTen"]);
  const cccdNumber = pickPayloadValue(body, ["cccdNumber", "cccd", "soCccd", "SoCccd"]);

  return {
    ...body,
    shopName: shopName ?? body.shopName,
    shopUsername: shopUsername ?? body.shopUsername,
    categoryId: normalizeCategoryId(categoryId ?? body.categoryId),
    fullName: fullName ?? body.fullName,
    cccdNumber: cccdNumber ?? body.cccdNumber,
    systemAddress:
      systemAddress ?? body.systemAddress ?? body.addressHeThong ?? body.DiaChiHeThong ?? address ?? body.address,
    latlong: resolveVerificationLatlong(body),
  };
}

function normalizeCccdDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseCccdIdentityFields(cccdNumber, fullName) {
  const digits = normalizeCccdDigits(cccdNumber);
  if (!digits || (digits.length !== 9 && digits.length !== 12)) {
    throw createServiceError("Số CCCD/CMND phải gồm 9 hoặc 12 chữ số.");
  }

  const name = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < 2) {
    throw createServiceError("Vui lòng nhập họ tên trên CCCD.");
  }
  if (name.length > 100) {
    throw createServiceError("Họ tên không được quá 100 ký tự.");
  }

  return { cccdNumber: digits, fullName: name };
}

function resolveVerificationLatlong(source = {}) {
  const nested = source?.latlong;
  if (nested && typeof nested === "object") {
    const lat = Number(nested.lat);
    const long = Number(nested.long ?? nested.lng);
    if (Number.isFinite(lat) && Number.isFinite(long)) {
      return { lat, long };
    }
  }

  const lat = Number(source.latitude ?? source.lat);
  const long = Number(source.longitude ?? source.lng ?? source.long);
  if (Number.isFinite(lat) && Number.isFinite(long)) {
    return { lat, long };
  }

  return { lat: null, long: null };
}

function resolveCategoryFields(verification) {
  const category = verification?.categoryId;
  if (category && typeof category === "object") {
    const categoryName = String(category.categoryName || category.name || "").trim();
    if (categoryName) {
      return {
        categoryId: normalizeCategoryId(category._id),
        categoryName,
      };
    }
  }

  return {
    categoryId: normalizeCategoryId(verification?.categoryId),
    categoryName: "",
  };
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const PHONE_VERIFY_TTL_MS = 5 * 60 * 1000;
const PHONE_RESEND_COOLDOWN_MS = 60 * 1000;
const PHONE_VERIFY_MAX_ATTEMPTS = 5;

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

function getPhoneResendWaitSeconds(session) {
  if (!session?.resendAt) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil((new Date(session.resendAt).getTime() + PHONE_RESEND_COOLDOWN_MS - Date.now()) / 1000)
  );
}

function issuePhoneOtpSession(userId, targetPhone, { applyResendCooldown = true } = {}) {
  const now = Date.now();
  const code = generatePhoneVerifyCode();
  const session = setOtpSession(OTP_PURPOSE.PHONE_VERIFY, userId, {
    target: targetPhone,
    code,
    expiresAt: new Date(now + PHONE_VERIFY_TTL_MS),
    resendAt: applyResendCooldown ? new Date(now) : null,
    failCount: 0,
  });
  return { code, session };
}

function toPhoneOtpResponse(phone, session) {
  const resendWait = getPhoneResendWaitSeconds(session);
  return {
    phone,
    expiresAt: session.expiresAt,
    expiresInSeconds: PHONE_VERIFY_TTL_MS / 1000,
    resendAvailableAt:
      resendWait > 0
        ? new Date(Date.now() + resendWait * 1000)
        : session.resendAt
          ? new Date(new Date(session.resendAt).getTime() + PHONE_RESEND_COOLDOWN_MS)
          : null,
    resendCooldownSeconds: resendWait || PHONE_RESEND_COOLDOWN_MS / 1000,
    remainingSeconds: resendWait || PHONE_RESEND_COOLDOWN_MS / 1000,
  };
}

async function deliverPhoneVerificationCode(phone, code) {
  if (!isPusherConfigured()) {
    throw createServiceError(
      "Hệ thống gửi mã xác minh chưa được cấu hình. Liên hệ quản trị viên.",
      503
    );
  }

  try {
    const sent = await sendPhoneVerificationCode(phone, code);
    if (!sent) {
      throw new Error("Pusher không phản hồi.");
    }
  } catch (error) {
    console.warn("[phone-otp] Pusher send failed:", error?.message || error);
    throw createServiceError(
      "Không gửi được mã xác minh. Vui lòng thử lại sau.",
      502
    );
  }
}

/** Gửi / gửi lại mã SĐT. Gửi lại: chặn 2 phút, hủy mã cũ, phát mã mới. */
async function requestSellerPhoneCode(user, phoneInput) {
  const targetPhone = await assertPhoneAvailable(phoneInput, user._id);
  const currentPhone = normalizePhone(user.Phone);

  if (User.isPhoneVerified(user) && currentPhone && currentPhone === targetPhone) {
    return {
      phone: targetPhone,
      alreadyVerified: true,
      expiresAt: null,
      expiresInSeconds: 0,
      resendAvailableAt: null,
      resendCooldownSeconds: 0,
    };
  }

  const existing = getOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);
  const resendWaitSeconds = getPhoneResendWaitSeconds(existing);
  if (resendWaitSeconds > 0) {
    const error = createServiceError(
      `Vui lòng đợi ${resendWaitSeconds} giây trước khi gửi lại mã.`,
      429
    );
    error.data = {
      resendAvailableAt: new Date(Date.now() + resendWaitSeconds * 1000),
      resendCooldownSeconds: resendWaitSeconds,
      remainingSeconds: resendWaitSeconds,
    };
    throw error;
  }

  // Hủy mã cũ (nếu có) → phát mã mới + khóa gửi lại 2 phút.
  const { code, session } = issuePhoneOtpSession(user._id, targetPhone, {
    applyResendCooldown: true,
  });
  await deliverPhoneVerificationCode(targetPhone, code);
  return toPhoneOtpResponse(targetPhone, session);
}

/**
 * Nhập đúng → lưu Phone (đã xác thực).
 * Sai < 5 lần → báo còn lại.
 * Sai đủ 5 lần → hệ thống tự gửi mã mới, bắt nhập mã mới.
 */
async function confirmSellerPhoneCode(user, code, phoneInput) {
  const phone = await assertPhoneAvailable(phoneInput, user._id);
  const normalizedCode = String(code || "").trim();

  if (!normalizedCode) {
    throw createServiceError("Thiếu mã xác minh.");
  }

  let session = getOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);
  if (!session?.code) {
    throw createServiceError("Chưa có mã xác minh. Vui lòng gửi mã trước.");
  }

  if (!session.expiresAt || new Date() > new Date(session.expiresAt)) {
    clearOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);
    throw createServiceError("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
  }

  if (session.target !== phone) {
    throw createServiceError("Số điện thoại không khớp phiên xác minh. Vui lòng gửi lại mã.");
  }

  if (session.code !== normalizedCode) {
    session = bumpOtpFailCount(OTP_PURPOSE.PHONE_VERIFY, user._id) || session;
    const failCount = Number(session.failCount) || 0;

    if (failCount >= PHONE_VERIFY_MAX_ATTEMPTS) {
      // Sai 5 lần → hủy mã cũ, gửi mã mới + khóa gửi lại 2 phút (như vừa gửi mã).
      const issued = issuePhoneOtpSession(user._id, phone, { applyResendCooldown: true });
      await deliverPhoneVerificationCode(phone, issued.code);
      const error = createServiceError(
        "Bạn đã nhập sai 5 lần. Hệ thống đã gửi mã mới — vui lòng nhập mã mới. Có thể gửi lại sau 60 giây.",
        400
      );
      error.data = {
        mustUseNewCode: true,
        ...toPhoneOtpResponse(phone, issued.session),
      };
      throw error;
    }

    throw createServiceError(
      `Mã xác minh không đúng. Còn ${PHONE_VERIFY_MAX_ATTEMPTS - failCount} lần thử.`
    );
  }

  // Đúng → chỉ lúc này mới lưu Phone (= đã xác thực).
  user.Phone = phone;
  await user.save();
  clearOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);

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
    .populate("categoryId", "name");
}

async function reloadVerificationById(verificationId) {
  if (!verificationId) {
    return null;
  }

  return SellerVerification.findById(verificationId).populate("categoryId", "name");
}

async function promoteUserToSeller(user, verification, approvedById = null) {
  verification.status = SELLER_VERIFICATION_STATUS.APPROVED;
  verification.approvedBy = approvedById;
  verification.LyDoTuChoi = "";
  verification.UpdatedAt = new Date();
  await verification.save();

  user.Role = USER_ROLE.SELLER;
  await user.save();

  const categoryId = verification.categoryId?._id || verification.categoryId || null;
  const coords = resolveVerificationLatlong(verification);

  const existingShop = await ShopProfile.findOne({ userId: user._id });
  let shop = existingShop;
  if (!existingShop) {
    shop = await ShopProfile.create({
      userId: user._id,
      shopName: verification.shopName || "",
      shopUsername: verification.shopUsername || "",
      categoryId,
      description: "",
      addressHeThong:
        verification.addressHeThong ||
        verification.DiaChiHeThong ||
        verification.address ||
        "",
      latlong: { lat: coords.lat, long: coords.long },
    });
  } else {
    if (categoryId) {
      existingShop.categoryId = categoryId;
    }
    if (verification.shopName) {
      existingShop.shopName = verification.shopName;
    }
    if (verification.shopUsername) {
      existingShop.shopUsername = verification.shopUsername;
    }
    existingShop.addressHeThong =
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "";
    existingShop.latlong = { lat: coords.lat, long: coords.long };
    existingShop.markModified("latlong");
    existingShop.UpdatedAt = new Date();
    await existingShop.save();
    shop = existingShop;
  }

  await ensureDefaultUserAvatar(user);

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
      await ensureDefaultUserAvatar(user);
    }
    return verification;
  }

  if (verification.status === SELLER_VERIFICATION_STATUS.PENDING) {
    const shop = await ShopProfile.findOne({ userId: user._id }).select("_id").lean();
    if (shop && isPendingReReviewVerification(verification, user)) {
      return verification;
    }
  }

  if (user.Role === USER_ROLE.SELLER) {
    user.Role = USER_ROLE.BUYER;
    await user.save();
  }

  return verification;
}

function emitSellerVerificationUpdated(verification, action = "updated") {
  if (!verification?._id) {
    return;
  }

  const payload = {
    verificationId: String(verification._id),
    userId: verification.userId ? String(verification.userId) : "",
    status: Number(verification.status),
    shopName: verification.shopName || "",
    action,
  };

  emitAdminUpdated("verification", payload);
  if (verification.userId) {
    emitUserResourceUpdated(verification.userId, "verification", payload);
  }
}

async function submitSellerVerification(user, payload) {
  const normalizedPayload = normalizeSellerRegistrationPayload(payload);

  if (!User.isPhoneVerified(user)) {
    throw createServiceError("Bạn cần xác minh số điện thoại trước khi đăng ký người bán.");
  }

  if (user.Role === USER_ROLE.SELLER) {
    throw createServiceError("Tài khoản đã là người bán.");
  }

  const existing = await getMySellerVerification(user);

  if (existing?.status === SELLER_VERIFICATION_STATUS.APPROVED) {
    throw createServiceError("Tài khoản đã được duyệt người bán.");
  }

  const systemAddress = String(normalizedPayload.systemAddress || "").trim();
  const { lat, long } = normalizedPayload.latlong || resolveVerificationLatlong(normalizedPayload);

  if (!systemAddress) {
    throw createServiceError("Vui lòng nhập địa chỉ.");
  }

  if (!Number.isFinite(lat) || !Number.isFinite(long)) {
    throw createServiceError("Vui lòng chọn vị trí trên bản đồ.");
  }

  let shopName;
  let shopUsername;
  try {
    shopName = assertShopNameValid(normalizedPayload.shopName);
    shopUsername = await assertShopUsernameAvailable(normalizedPayload.shopUsername, user._id);
  } catch (identityError) {
    throw createServiceError(identityError.message, identityError.statusCode || 400);
  }

  const category = await assertCategoryExists(normalizedPayload.categoryId);

  const { cccdNumber, fullName } = parseCccdIdentityFields(
    normalizedPayload.cccdNumber,
    normalizedPayload.fullName
  );

  const [anhCccdTruoc, anhCccdSau, selfieImage, anhKD] = await Promise.all([
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.anhCccdTruocBase64,
      mimeType: normalizedPayload.cccdFrontMimeType,
      existingUrl:
        existing?.anhCccdTruoc || normalizedPayload.anhCccdTruocUrl || null,
      folder: "seller-verification",
      label: "cccd-front",
    }),
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.anhCccdSauBase64,
      mimeType: normalizedPayload.cccdBackMimeType,
      existingUrl: existing?.anhCccdSau || normalizedPayload.anhCccdSauUrl || null,
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
    resolveVerificationImage({
      user,
      imageBase64:
        normalizedPayload.anhKDBase64 ?? normalizedPayload.businessDocImageBase64,
      mimeType: normalizedPayload.anhKDMimeType ?? normalizedPayload.businessDocMimeType,
      existingUrl:
        resolveBusinessImage(existing) ||
        normalizedPayload.anhKDUrl ||
        normalizedPayload.businessDocImageUrl ||
        null,
      folder: "seller-verification",
      label: "business-doc",
    }),
  ]);

  if (!anhKD) {
    throw createServiceError(
      "Vui lòng tải ảnh giấy phép kinh doanh hoặc giấy chứng nhận ATTP."
    );
  }

  const sharedFields = {
    anhCccdTruoc,
    anhCccdSau,
    selfieImage,
    anhKD,
    fullName,
    cccdNumber,
    shopName,
    shopUsername,
    categoryId: category._id,
    addressHeThong: systemAddress,
    latlong: { lat, long },
    status: SELLER_VERIFICATION_STATUS.PENDING,
    LyDoTuChoi: "",
    approvedBy: null,
    UpdatedAt: new Date(),
  };

  if (
    existing &&
    (existing.status === SELLER_VERIFICATION_STATUS.PENDING ||
      existing.status === SELLER_VERIFICATION_STATUS.REJECTED)
  ) {
    existing.set(sharedFields);
    await existing.save();
    const saved = await reloadVerificationById(existing._id);
    emitSellerVerificationUpdated(saved, "submitted");
    return saved;
  }

  const verification = await SellerVerification.create({
    userId: user._id,
    ...sharedFields,
  });

  const saved = await reloadVerificationById(verification._id);
  emitSellerVerificationUpdated(saved, "submitted");
  return saved;
}

/** Seller đã duyệt — cập nhật hồ sơ xác thực (ATTP) và chờ admin duyệt lại. */
async function submitSellerVerificationReReview(user, payload = {}) {
  if (user.Role !== USER_ROLE.SELLER) {
    throw createServiceError("Chỉ người bán đã duyệt mới được cập nhật hồ sơ xác thực.");
  }

  const shop = await ShopProfile.findOne({ userId: user._id });
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const existing = await getMySellerVerification(user);
  if (!existing) {
    throw createServiceError("Không tìm thấy hồ sơ xác thực.", 404);
  }

  if (existing.status === SELLER_VERIFICATION_STATUS.PENDING) {
    const meta = parseVerificationMeta(existing.LyDoTuChoi);
    if (meta.type === META_TYPE.RE_REVIEW_PENDING) {
      throw createServiceError("Hồ sơ xác thực đang chờ duyệt lại.");
    }
    throw createServiceError("Hồ sơ đăng ký đang chờ duyệt.");
  }

  if (existing.status !== SELLER_VERIFICATION_STATUS.APPROVED) {
    throw createServiceError("Chỉ cập nhật hồ sơ xác thực khi gian hàng đang hoạt động.");
  }

  const changeReason = String(payload.changeReason || payload.lyDoThayDoi || "").trim();
  if (changeReason.length < 5) {
    throw createServiceError("Vui lòng nhập lý do thay đổi (ít nhất 5 ký tự).");
  }

  const licenseNumber = String(payload.licenseNumber || payload.giayPhepAttp || "").trim();
  const issuedAt = String(payload.issuedAt || payload.ngayCap || "").trim();
  const expiresAt = String(payload.expiresAt || payload.ngayHetHan || "").trim();

  if (!licenseNumber) {
    throw createServiceError("Vui lòng nhập số giấy phép an toàn thực phẩm.");
  }
  if (!issuedAt || !expiresAt) {
    throw createServiceError("Vui lòng nhập ngày cấp và ngày hết hạn giấy phép.");
  }

  const previousSnapshot = buildSnapshotFromVerification(existing);
  const extraDocUrlsInput = Array.isArray(payload.extraDocUrls)
    ? payload.extraDocUrls
    : Array.isArray(payload.extraDocs)
      ? payload.extraDocs
      : [];

  const anhKD = await resolveVerificationImage({
    user,
    imageBase64: payload.anhKDBase64 ?? payload.businessDocImageBase64,
    mimeType: payload.anhKDMimeType ?? payload.businessDocMimeType,
    existingUrl:
      resolveBusinessImage(existing) ||
      payload.anhKDUrl ||
      payload.businessDocImageUrl ||
      null,
    folder: "seller-verification",
    label: "business-doc",
  });

  if (!anhKD) {
    throw createServiceError(
      "Vui lòng tải ảnh giấy phép kinh doanh hoặc giấy chứng nhận ATTP."
    );
  }

  const extraDocUrls = [];
  for (let index = 0; index < extraDocUrlsInput.length; index += 1) {
    const item = extraDocUrlsInput[index];
    if (typeof item === "string" && item.startsWith("http")) {
      extraDocUrls.push(item);
      continue;
    }
    const base64 = item?.base64 || item?.imageBase64;
    if (!base64) {
      continue;
    }
    const url = await resolveVerificationImage({
      user,
      imageBase64: base64,
      mimeType: item?.mimeType || "image/jpeg",
      existingUrl: item?.existingUrl || item?.url || null,
      folder: "seller-verification",
      label: `extra-doc-${index + 1}`,
    });
    if (url) {
      extraDocUrls.push(url);
    }
  }

  existing.anhKD = anhKD;
  existing.status = SELLER_VERIFICATION_STATUS.PENDING;
  existing.approvedBy = null;
  existing.LyDoTuChoi = JSON.stringify(
    buildReReviewPendingMeta({
      changeReason,
      licenseNumber,
      issuedAt,
      expiresAt,
      extraDocUrls,
      previousSnapshot,
    })
  );
  existing.UpdatedAt = new Date();
  await existing.save();

  const saved = await reloadVerificationById(existing._id);
  emitSellerVerificationUpdated(saved, "re_review_submitted");
  return saved;
}

async function listPendingSellerVerifications() {
  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.PENDING,
  })
    .sort({ CreatedAt: 1 })
    .populate("userId", "FullName Email Phone UserName Avatar")
    .populate("categoryId", "name")
    .populate("approvedBy", "FullName UserName");

  return verifications;
}

const ADMIN_VERIFICATION_STATUS_LABELS = {
  [SELLER_VERIFICATION_STATUS.PENDING]: "Chờ duyệt",
  [SELLER_VERIFICATION_STATUS.APPROVED]: "Đang hoạt động",
  [SELLER_VERIFICATION_STATUS.REJECTED]: "Từ chối",
};

const SHOP_LOCKED_FILTER = "shop_locked";

async function findBlockedShopUserIds() {
  return ShopProfile.find({ status: SHOP_STATUS.BLOCKED }).distinct("userId");
}

async function loadShopsByUserIds(userIds = []) {
  const normalizedIds = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];
  if (!normalizedIds.length) {
    return new Map();
  }

  const shops = await ShopProfile.find({ userId: { $in: normalizedIds } })
    .select("_id userId status shopName")
    .lean();

  const byUserId = new Map();
  shops.forEach((shop) => {
    byUserId.set(String(shop.userId), shop);
  });
  return byUserId;
}

function resolveShopStatusLabel(shop) {
  if (!shop) {
    return "";
  }
  return Number(shop.status) === SHOP_STATUS.BLOCKED ? "Đã khóa" : "Đang hoạt động";
}

function resolveAdminDisplayStatusLabel(verification, shop) {
  if (
    verification.status === SELLER_VERIFICATION_STATUS.PENDING &&
    parseVerificationMeta(verification.LyDoTuChoi).type === META_TYPE.RE_REVIEW_PENDING
  ) {
    return "Chờ duyệt lại";
  }
  if (verification.status === SELLER_VERIFICATION_STATUS.APPROVED) {
    if (shop && Number(shop.status) === SHOP_STATUS.BLOCKED) {
      return "Đã khóa";
    }
    return "Đang hoạt động";
  }
  return ADMIN_VERIFICATION_STATUS_LABELS[verification.status] || "Không rõ";
}

async function buildAdminVerificationFilter(query = {}) {
  const filter = {};
  const statusRaw = String(query.status ?? "").trim();
  if (statusRaw === SHOP_LOCKED_FILTER) {
    const blockedUserIds = await findBlockedShopUserIds();
    filter.userId = { $in: blockedUserIds };
    filter.status = SELLER_VERIFICATION_STATUS.APPROVED;
  } else if (statusRaw !== "") {
    const status = Number(statusRaw);
    if (!Number.isNaN(status)) {
      filter.status = status;
      if (status === SELLER_VERIFICATION_STATUS.APPROVED) {
        const blockedUserIds = await findBlockedShopUserIds();
        if (blockedUserIds.length) {
          filter.userId = { $nin: blockedUserIds };
        }
      }
    }
  }

  const categoryId = String(query.categoryId || "").trim();
  if (categoryId) {
    filter.categoryId = categoryId;
  }

  const search = String(query.search || query.q || "").trim();
  if (search) {
    const orConditions = [];
    const regex = buildSearchRegex(search);

    if (regex) {
      const matchedUsers = await findUsersBySearchRegex(User, regex);
      const userIds = matchedUsers.map((row) => row._id);
      orConditions.push(
        { shopName: regex },
        { shopUsername: regex },
        { fullName: regex },
        { cccdNumber: regex },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : [])
      );
    }

    const matchedVerificationStatuses = resolveStatusesFromLabelSearch(search, [
      { label: "Chờ duyệt", statuses: [SELLER_VERIFICATION_STATUS.PENDING] },
      { label: "Đang hoạt động", statuses: [SELLER_VERIFICATION_STATUS.APPROVED] },
      { label: "Đã duyệt", statuses: [SELLER_VERIFICATION_STATUS.APPROVED] },
      { label: "Đã từ chối", statuses: [SELLER_VERIFICATION_STATUS.REJECTED] },
      { label: "Từ chối", statuses: [SELLER_VERIFICATION_STATUS.REJECTED] },
    ]);
    if (matchedVerificationStatuses.length) {
      orConditions.push({ status: { $in: matchedVerificationStatuses } });
    }

    const shopLockSearch = /khóa|khoa|locked/i.test(search);
    if (shopLockSearch) {
      const blockedUserIds = await findBlockedShopUserIds();
      if (blockedUserIds.length) {
        orConditions.push({ userId: { $in: blockedUserIds } });
      }
    }

    orConditions.push(...buildObjectIdSearchConditions(search));

    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  applyCreatedAtRange(filter, query);
  return filter;
}

function resolveAdminVerificationSort(sortKey) {
  if (sortKey === "oldest") {
    return { CreatedAt: 1 };
  }
  return { CreatedAt: -1 };
}

function buildAdminVerificationStats(statusRows = [], shopsLocked = 0) {
  const countsByStatus = new Map(
    statusRows.map((row) => [Number(row._id), Number(row.count) || 0])
  );

  const pending = countsByStatus.get(SELLER_VERIFICATION_STATUS.PENDING) || 0;
  const approved = countsByStatus.get(SELLER_VERIFICATION_STATUS.APPROVED) || 0;
  const rejected = countsByStatus.get(SELLER_VERIFICATION_STATUS.REJECTED) || 0;
  const locked = Number(shopsLocked) || 0;
  const total = statusRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const active = Math.max(0, approved - locked);

  return { total, pending, active, rejected, shopsLocked: locked, approved };
}

async function listAdminSellerVerifications(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 20)
  );
  const filter = await buildAdminVerificationFilter(query);
  const sort = resolveAdminVerificationSort(query.sort);

  const [total, verifications, statusRows, shopsLocked] = await Promise.all([
    SellerVerification.countDocuments(filter),
    SellerVerification.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "FullName Email Phone UserName Avatar")
      .populate("categoryId", "name")
      .populate("approvedBy", "FullName UserName"),
    SellerVerification.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ShopProfile.countDocuments({ status: SHOP_STATUS.BLOCKED }),
  ]);

  const shopByUserId = await loadShopsByUserIds(
    verifications.map((row) => row.userId?._id || row.userId)
  );

  return {
    items: verifications.map((verification) => ({
      verification,
      shop:
        shopByUserId.get(String(verification.userId?._id || verification.userId)) || null,
    })),
    pagination: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    stats: buildAdminVerificationStats(statusRows, shopsLocked),
  };
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

  const meta = parseVerificationMeta(verification.LyDoTuChoi);
  const isReReview = meta.type === META_TYPE.RE_REVIEW_PENDING;

  if (isReReview && sellerUser.Role === USER_ROLE.SELLER) {
    const pendingMeta = meta.reReviewPending || {};
    verification.status = SELLER_VERIFICATION_STATUS.APPROVED;
    verification.approvedBy = adminUser._id;
    verification.LyDoTuChoi = JSON.stringify(
      buildAttpMeta({
        licenseNumber: pendingMeta.licenseNumber,
        issuedAt: pendingMeta.issuedAt,
        expiresAt: pendingMeta.expiresAt,
        extraDocUrls: pendingMeta.extraDocUrls,
      })
    );
    verification.UpdatedAt = new Date();
    await verification.save();
    emitSellerVerificationUpdated(verification, "re_review_approved");
    return verification;
  }

  await promoteUserToSeller(sellerUser, verification, adminUser._id);
  emitSellerVerificationUpdated(verification, "approved");
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

  const meta = parseVerificationMeta(verification.LyDoTuChoi);
  const isReReview = meta.type === META_TYPE.RE_REVIEW_PENDING;

  if (isReReview) {
    const snapshot = meta.reReviewPending?.previousSnapshot;
    if (snapshot) {
      applySnapshotToVerification(verification, snapshot);
    }
    verification.status = SELLER_VERIFICATION_STATUS.APPROVED;
    verification.approvedBy = null;
    verification.LyDoTuChoi = JSON.stringify(
      buildAttpMeta({
        ...(snapshot || {}),
        lastReReviewRejection: {
          reason: lyDoTuChoi,
          rejectedAt: new Date().toISOString(),
        },
      })
    );
    verification.UpdatedAt = new Date();
    await verification.save();
    emitSellerVerificationUpdated(verification, "re_review_rejected");
    return verification;
  }

  verification.status = SELLER_VERIFICATION_STATUS.REJECTED;
  verification.LyDoTuChoi = lyDoTuChoi;
  verification.approvedBy = null;
  verification.UpdatedAt = new Date();
  await verification.save();

  emitSellerVerificationUpdated(verification, "rejected");
  return verification;
}

async function updateSellerVerificationByAdmin(adminUser, verificationId, payload = {}) {
  const verification = await SellerVerification.findById(verificationId);
  if (!verification) {
    throw createServiceError("Không tìm thấy hồ sơ đăng ký.", 404);
  }

  const { cccdNumber, fullName } = parseCccdIdentityFields(
    payload.cccdNumber ?? verification.cccdNumber,
    payload.fullName ?? verification.fullName
  );

  verification.fullName = fullName;
  verification.cccdNumber = cccdNumber;
  verification.UpdatedAt = new Date();
  await verification.save();

  const saved = await reloadVerificationById(verification._id);
  emitSellerVerificationUpdated(saved, "updated");
  return saved;
}

function toPublicVerification(verification, user = null) {
  if (!verification) {
    return null;
  }

  const category = resolveCategoryFields(verification);
  const coords = resolveVerificationLatlong(verification);
  const metaExtras = enrichPublicVerification(verification, user);

  return {
    id: verification._id,
    userId: verification.userId,
    anhCccdTruoc: verification.anhCccdTruoc || "",
    anhCccdSau: verification.anhCccdSau || "",
    selfieImage: verification.selfieImage || "",
    fullName: verification.fullName || "",
    cccdNumber: verification.cccdNumber || "",
    anhKD: resolveBusinessImage(verification),
    address:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    addressHeThong:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    DiaChiHeThong:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    latlong: coords,
    latitude: coords.lat,
    longitude: coords.long,
    // Tên/handle gian hàng lưu trên hồ sơ đăng ký.
    shopUsername: verification.shopUsername || "",
    shopName: verification.shopName || "",
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    status: verification.status,
    statusLabel:
      metaExtras.isPendingReReview
        ? "Đang chờ duyệt lại"
        : ADMIN_VERIFICATION_STATUS_LABELS[verification.status] || "Không rõ",
    lyDoTuChoi:
      metaExtras.rejectionReasonPlain ||
      (typeof verification.LyDoTuChoi === "string" &&
      !String(verification.LyDoTuChoi).trim().startsWith("{")
        ? verification.LyDoTuChoi
        : ""),
    ...metaExtras,
    submittedAt: verification.submittedAt || verification.CreatedAt,
    approvedAt:
      verification.status === SELLER_VERIFICATION_STATUS.APPROVED
        ? verification.UpdatedAt
        : null,
    rejectedAt:
      verification.status === SELLER_VERIFICATION_STATUS.REJECTED
        ? verification.UpdatedAt
        : null,
    createdAt: verification.CreatedAt,
    updatedAt: verification.UpdatedAt,
  };
}

function toAdminVerification(verification, shop = null, viewerUser = null) {
  const publicData = toPublicVerification(verification, viewerUser);
  if (!publicData) {
    return null;
  }

  const owner = verification.userId;
  const approver = verification.approvedBy;
  const shopStatus = shop != null ? Number(shop.status) : null;
  return {
    ...publicData,
    shopId: shop?._id ? String(shop._id) : publicData.shopId || "",
    shopStatus,
    shopStatusLabel: resolveShopStatusLabel(shop),
    statusLabel: resolveAdminDisplayStatusLabel(verification, shop),
    user: owner && typeof owner === "object"
      ? {
          id: owner._id,
          fullName: owner.FullName || "",
          email: owner.Email || "",
          phone: owner.Phone || "",
          userName: owner.UserName || "",
          avatar: owner.Avatar || "",
        }
      : null,
    approvedByAdmin:
      approver && typeof approver === "object"
        ? {
            id: approver._id,
            fullName: approver.FullName || "",
            userName: approver.UserName || "",
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
  submitSellerVerificationReReview,
  normalizeSellerRegistrationPayload,
  listPendingSellerVerifications,
  listAdminSellerVerifications,
  approveSellerVerificationByAdmin,
  rejectSellerVerificationByAdmin,
  updateSellerVerificationByAdmin,
  toPublicVerification,
  toAdminVerification,
  assertShopOwnerCanSell,
  isShopOwnerPendingReReview,
  PENDING_REVIEW_MESSAGE,
};
