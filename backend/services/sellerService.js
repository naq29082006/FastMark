const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS, USER_ROLE } = require("../constants");
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

function resolveBusinessImage(source) {
  if (!source) {
    return "";
  }
  return pickString(
    source.businessImage ??
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

  return {
    ...body,
    shopName: shopName ?? body.shopName,
    shopUsername: shopUsername ?? body.shopUsername,
    categoryId: normalizeCategoryId(categoryId ?? body.categoryId),
    systemAddress:
      systemAddress ?? body.systemAddress ?? body.addressHeThong ?? body.DiaChiHeThong ?? address ?? body.address,
    latlong: resolveVerificationLatlong(body),
  };
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
const PHONE_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
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
        "Bạn đã nhập sai 5 lần. Hệ thống đã gửi mã mới — vui lòng nhập mã mới. Có thể gửi lại sau 2 phút.",
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

  const [cccdFrontImage, cccdBackImage, selfieImage, businessImage] = await Promise.all([
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
    resolveVerificationImage({
      user,
      imageBase64:
        normalizedPayload.businessImageBase64 ?? normalizedPayload.businessDocImageBase64,
      mimeType: normalizedPayload.businessImageMimeType ?? normalizedPayload.businessDocMimeType,
      existingUrl:
        resolveBusinessImage(existing) ||
        normalizedPayload.businessImageUrl ||
        normalizedPayload.businessDocImageUrl ||
        null,
      folder: "seller-verification",
      label: "business-doc",
    }),
  ]);

  if (!businessImage) {
    throw createServiceError(
      "Vui lòng tải ảnh giấy phép kinh doanh hoặc giấy chứng nhận ATTP."
    );
  }

  const sharedFields = {
    cccdFrontImage,
    cccdBackImage,
    selfieImage,
    businessImage,
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
  [SELLER_VERIFICATION_STATUS.APPROVED]: "Đã duyệt",
  [SELLER_VERIFICATION_STATUS.REJECTED]: "Từ chối",
};

async function buildAdminVerificationFilter(query = {}) {
  const filter = {};
  const statusRaw = query.status;
  if (statusRaw !== undefined && statusRaw !== null && String(statusRaw).trim() !== "") {
    const status = Number(statusRaw);
    if (!Number.isNaN(status)) {
      filter.status = status;
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
        ...(userIds.length ? [{ userId: { $in: userIds } }] : [])
      );
    }

    const matchedVerificationStatuses = resolveStatusesFromLabelSearch(search, [
      { label: "Chờ duyệt", statuses: [SELLER_VERIFICATION_STATUS.PENDING] },
      { label: "Đã duyệt", statuses: [SELLER_VERIFICATION_STATUS.APPROVED] },
      { label: "Đã từ chối", statuses: [SELLER_VERIFICATION_STATUS.REJECTED] },
    ]);
    if (matchedVerificationStatuses.length) {
      orConditions.push({ status: { $in: matchedVerificationStatuses } });
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

async function listAdminSellerVerifications(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 20)
  );
  const filter = await buildAdminVerificationFilter(query);
  const sort = resolveAdminVerificationSort(query.sort);

  const [total, verifications, totalAll, pendingCount, approvedCount, rejectedCount] =
    await Promise.all([
      SellerVerification.countDocuments(filter),
      SellerVerification.find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate("userId", "FullName Email Phone UserName Avatar")
        .populate("categoryId", "name")
        .populate("approvedBy", "FullName UserName"),
      SellerVerification.countDocuments({}),
      SellerVerification.countDocuments({ status: SELLER_VERIFICATION_STATUS.PENDING }),
      SellerVerification.countDocuments({ status: SELLER_VERIFICATION_STATUS.APPROVED }),
      SellerVerification.countDocuments({ status: SELLER_VERIFICATION_STATUS.REJECTED }),
    ]);

  return {
    items: verifications,
    pagination: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    stats: {
      total: totalAll,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
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

  verification.status = SELLER_VERIFICATION_STATUS.REJECTED;
  verification.LyDoTuChoi = lyDoTuChoi;
  verification.approvedBy = null;
  verification.UpdatedAt = new Date();
  await verification.save();

  emitSellerVerificationUpdated(verification, "rejected");
  return verification;
}

function toPublicVerification(verification) {
  if (!verification) {
    return null;
  }

  const category = resolveCategoryFields(verification);
  const coords = resolveVerificationLatlong(verification);

  return {
    id: verification._id,
    userId: verification.userId,
    cccdFrontImage: verification.cccdFrontImage || "",
    cccdBackImage: verification.cccdBackImage || "",
    selfieImage: verification.selfieImage || "",
    businessImage: resolveBusinessImage(verification),
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
    statusLabel: ADMIN_VERIFICATION_STATUS_LABELS[verification.status] || "Không rõ",
    lyDoTuChoi: verification.LyDoTuChoi || "",
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

function toAdminVerification(verification) {
  const publicData = toPublicVerification(verification);
  if (!publicData) {
    return null;
  }

  const user = verification.userId;
  const approver = verification.approvedBy;
  return {
    ...publicData,
    user: user && typeof user === "object"
      ? {
          id: user._id,
          fullName: user.FullName || "",
          email: user.Email || "",
          phone: user.Phone || "",
          userName: user.UserName || "",
          avatar: user.Avatar || "",
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
  normalizeSellerRegistrationPayload,
  listPendingSellerVerifications,
  listAdminSellerVerifications,
  approveSellerVerificationByAdmin,
  rejectSellerVerificationByAdmin,
  toPublicVerification,
  toAdminVerification,
};
