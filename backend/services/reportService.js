const Report = require("../models/Report");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const crypto = require("crypto");
const {
  REPORT_STATUS,
  REPORT_TYPE,
  REPORT_TYPE_LABELS,
  ACCOUNT_REPORT_TYPES,
  MAX_ACCOUNT_REPORT_IMAGES,
  USER_STATUS,
  SHOP_STATUS,
} = require("../constants");
const { normalizeEmbeddedImages, toPublicImageList } = require("../utils/embeddedImages");
const { notDeletedReviewFilter } = require("../utils/reviewVisibility");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { resolveShopDisplayName } = require("../utils/shopIdentity");
const {
  findLatestAccountLockAppeal,
  findLatestShopLockAppeal,
  ensureUserLockedAt,
  ensureShopLockedAt,
  isLegacyShopLockAppealReport,
} = require("./lockAppealService");
const { normalizeReportType } = require("../utils/reportType");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function pickShopDisplayName(shop, owner = null) {
  return resolveShopDisplayName(shop, owner);
}

async function findShopByObjectId(id) {
  if (!isStrictMongoObjectId(id)) {
    return null;
  }
  return ShopProfile.findById(id).lean();
}

async function resolveShopByStoreId(storeId) {
  const rawId = pickString(storeId);
  if (!rawId) {
    throw createServiceError("Thiếu mã gian hàng.", 400);
  }

  const shopByObjectId = await findShopByObjectId(rawId);
  if (shopByObjectId) {
    return shopByObjectId;
  }

  throw createServiceError("Không tìm thấy gian hàng để báo cáo.", 404);
}

async function resolveProductById(productId) {
  const rawId = pickString(productId);
  if (!isStrictMongoObjectId(rawId)) {
    throw createServiceError("Mã sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(rawId).lean();
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm để báo cáo.", 404);
  }

  return product;
}

function inferReportType(payload = {}) {
  const CONTENT_TYPES = [
    REPORT_TYPE.REVIEW,
    REPORT_TYPE.SHOP,
    REPORT_TYPE.PRODUCT,
    REPORT_TYPE.SYSTEM,
    REPORT_TYPE.OTHER,
  ];
  const explicitType = normalizeReportType(payload.reportType);
  if (explicitType != null && CONTENT_TYPES.includes(explicitType)) {
    return explicitType;
  }

  if (pickString(payload.reviewId || payload.review_id)) {
    return REPORT_TYPE.REVIEW;
  }

  if (pickString(payload.productId || payload.product_id)) {
    return REPORT_TYPE.PRODUCT;
  }

  if (pickString(payload.shopId || payload.shop_id || payload.storeId || payload.store_id)) {
    return REPORT_TYPE.SHOP;
  }

  return REPORT_TYPE.OTHER;
}

async function resolveReviewById(reviewId) {
  const rawId = pickString(reviewId);
  if (!isStrictMongoObjectId(rawId)) {
    throw createServiceError("Mã đánh giá không hợp lệ.", 400);
  }

  const Review = require("../models/Review");
  const review = await Review.findOne({
    _id: rawId,
    ...notDeletedReviewFilter(),
  }).lean();
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá để báo cáo.", 404);
  }

  return review;
}

async function resolveEvidenceImageUrl(imageInput) {
  if (!imageInput) {
    return "";
  }
  if (typeof imageInput === "string") {
    const raw = imageInput.trim();
    if (!raw) {
      return "";
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    if (/^(file|content|ph):\/\//i.test(raw)) {
      throw createServiceError(
        "Ảnh đính kèm chưa được mã hóa. Vui lòng chọn lại ảnh và gửi lại.",
        400
      );
    }
    if (raw.startsWith("data:image/")) {
      return uploadDataUri(raw);
    }
    // Raw base64 without data-uri prefix
    if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.replace(/\s/g, "").length > 100) {
      return uploadDataUri(`data:image/jpeg;base64,${raw.replace(/\s/g, "")}`);
    }
    return "";
  }

  if (typeof imageInput === "object") {
    const directUrl = pickString(
      imageInput.imageUrl || imageInput.ImageUrl || imageInput.url || imageInput.uri
    );
    if (/^https?:\/\//i.test(directUrl)) {
      return directUrl;
    }
    if (/^(file|content|ph):\/\//i.test(directUrl)) {
      throw createServiceError(
        "Ảnh đính kèm chưa được mã hóa. Vui lòng chọn lại ảnh và gửi lại.",
        400
      );
    }
    const base64 = imageInput.imageBase64 || imageInput.ImageBase64 || imageInput.base64;
    if (base64) {
      const dataUri = String(base64).startsWith("data:")
        ? base64
        : `data:${imageInput.mimeType || "image/jpeg"};base64,${String(base64).replace(/\s/g, "")}`;
      return uploadDataUri(dataUri);
    }
    if (directUrl.startsWith("data:image/")) {
      return uploadDataUri(directUrl);
    }
  }

  return "";
}

async function uploadDataUri(dataUri) {
  const match = String(dataUri || "").match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
  );
  if (!match) {
    throw createServiceError("Định dạng ảnh bằng chứng không hợp lệ.", 400);
  }
  const mimeType = match[1];
  const buffer = Buffer.from(String(match[2]).replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    throw createServiceError("Ảnh bằng chứng trống.", 400);
  }
  const extension = resolveFileExtension(mimeType, "jpg");
  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "report-images",
    fileName: `report-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`,
  });
  if (!uploaded?.publicUrl) {
    throw createServiceError("Không lưu được ảnh bằng chứng.", 502);
  }
  return uploaded.publicUrl;
}

async function normalizeImageUrls(images = []) {
  const list = Array.isArray(images) ? images : [];
  if (list.length > MAX_ACCOUNT_REPORT_IMAGES) {
    throw createServiceError(
      `Mỗi báo cáo tối đa ${MAX_ACCOUNT_REPORT_IMAGES} ảnh.`,
      400
    );
  }

  const urls = [];
  for (const item of list) {
    const url = await resolveEvidenceImageUrl(item);
    if (url) {
      urls.push(url);
    }
  }

  if (list.length > 0 && urls.length === 0) {
    throw createServiceError(
      "Không xử lý được ảnh bằng chứng. Vui lòng chọn lại ảnh và gửi lại.",
      400
    );
  }

  return urls;
}

function normalizeReportImages(imageUrls = []) {
  return toPublicImageList(normalizeEmbeddedImages(imageUrls));
}

async function createReport(user, payload = {}) {
  const title = pickString(payload.title || payload.reason);
  const note = pickString(payload.content || payload.message || payload.note);
  const reportType = inferReportType(payload);
  const isAccountStyle = ACCOUNT_REPORT_TYPES.includes(reportType);

  if (!title && !note) {
    throw createServiceError("Vui lòng nhập nội dung hoặc chọn loại tố cáo.", 400);
  }

  if (isAccountStyle && !note) {
    throw createServiceError("Vui lòng nhập nội dung tố cáo.", 400);
  }

  const now = new Date();
  const typeLabel = REPORT_TYPE_LABELS[reportType] || "Tố cáo";
  const resolvedTitle = title || typeLabel;

  const reportData = {
    userId: user._id,
    reportType,
    title: resolvedTitle,
    status: REPORT_STATUS.PENDING,
    CreatedAt: now,
    UpdatedAt: now,
  };

  if (reportType === REPORT_TYPE.REVIEW) {
    const review = await resolveReviewById(payload.reviewId || payload.review_id);
    if (String(review.userId) === String(user._id)) {
      throw createServiceError("Bạn không thể báo cáo đánh giá của chính mình.", 400);
    }

    const reviewerName = pickString(payload.reviewerName || payload.userName) || "khách hàng";
    const snippet = pickString(review.comment).slice(0, 120);

    reportData.reviewId = review._id;
    reportData.shopId = review.shopId || null;
    reportData.productId = review.productId || null;
    reportData.content =
      note ||
      `Báo cáo đánh giá của ${reviewerName}${snippet ? `: "${snippet}"` : ""} — ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.PRODUCT) {
    const productId = pickString(payload.productId || payload.product_id);
    const product = await resolveProductById(productId);
    const productName = pickString(payload.productName || payload.product_name) || product.ProductName;
    let shop = null;

    if (product.ShopId) {
      shop = await findShopByObjectId(String(product.ShopId));
    }

    const shopOwner = shop?.userId
      ? await User.findById(shop.userId).select("FullName UserName").lean()
      : null;
    const shopDisplayName = pickShopDisplayName(shop, shopOwner);

    reportData.productId = product._id;
    reportData.shopId = shop?._id || product.ShopId || null;
    reportData.content =
      note ||
      `Báo cáo sản phẩm "${productName}"${shopDisplayName ? ` thuộc gian hàng "${shopDisplayName}"` : ""}: ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.SHOP) {
    const storeId = pickString(
      payload.shopId || payload.shop_id || payload.storeId || payload.store_id
    );
    const storeName = pickString(
      payload.shopName || payload.shop_name || payload.storeName || payload.store_name
    );

    if (!storeId) {
      throw createServiceError(
        "Thiếu gian hàng bị tố cáo. Hãy báo cáo từ trang gian hàng.",
        400
      );
    }

    const shop = await resolveShopByStoreId(storeId);
    const shopOwner = shop?.userId
      ? await User.findById(shop.userId).select("FullName UserName").lean()
      : null;
    const shopName = storeName || pickShopDisplayName(shop, shopOwner);
    reportData.shopId = shop._id;
    reportData.content = note || `Báo cáo gian hàng "${shopName}": ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.SYSTEM) {
    reportData.content = note || `Báo cáo lỗi hệ thống: ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.OTHER) {
    reportData.content = note || `Tố cáo khác: ${resolvedTitle}`;
  } else {
    reportData.content = note || resolvedTitle;
  }

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);
  const report = await Report.create({
    ...reportData,
    images: normalizeEmbeddedImages(imageUrls),
  });
  const images = normalizeReportImages(report.images);

  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[normalizeReportType(report.reportType)] || "Không rõ",
    title: report.title,
    content: report.content,
    status: report.status,
    images,
    createdAt: report.CreatedAt,
  };
}

async function loadAppealImages(reportId) {
  if (!reportId) {
    return [];
  }
  const report = await Report.findById(reportId).select("images").lean();
  return normalizeReportImages(report?.images || []);
}

async function findShopByUserId(userId) {
  return ShopProfile.findOne({ userId }).lean();
}

/**
 * Trạng thái khiếu nại khóa nick cho user hiện tại.
 * - canAppeal: còn nút gửi khiếu nại (chỉ 1 lần / lượt khóa; từ chối thì mất nút).
 * - phase: active | can_appeal | pending | rejected
 */
async function getAccountLockAppealStatus(user) {
  const blocked = Number(user?.Status) === USER_STATUS.BLOCKED;
  if (!blocked) {
    return {
      accountLocked: false,
      phase: "active",
      canAppeal: false,
      appeal: null,
      message: "Tài khoản đang hoạt động.",
    };
  }

  const lockedAt = await ensureUserLockedAt(user);
  const latest = await findLatestAccountLockAppeal(user._id, lockedAt);
  if (!latest) {
    return {
      accountLocked: true,
      phase: "can_appeal",
      canAppeal: true,
      appeal: null,
      message: "Tài khoản đã bị khóa. Bạn có thể gửi khiếu nại một lần.",
    };
  }

  const images = await loadAppealImages(latest._id);
  const appeal = {
    id: String(latest._id),
    status: latest.status,
    statusLabel: latest.status === REPORT_STATUS.PENDING
      ? "Chờ admin xử lý"
      : latest.status === REPORT_STATUS.REJECTED
        ? "Đã từ chối"
        : latest.status === REPORT_STATUS.PROCESSED
          ? "Đã mở khóa"
          : "Không rõ",
    title: latest.title || "",
    content: latest.content || "",
    adminNote: latest.adminNote || "",
    images,
    createdAt: latest.CreatedAt,
    processedAt: latest.processedAt || null,
  };

  if (latest.status === REPORT_STATUS.PENDING) {
    return {
      accountLocked: true,
      phase: "pending",
      canAppeal: false,
      appeal,
      message: "Đã gửi khiếu nại. Đang chờ admin xử lý.",
    };
  }

  if (latest.status === REPORT_STATUS.REJECTED) {
    return {
      accountLocked: true,
      phase: "rejected",
      canAppeal: false,
      appeal,
      message: latest.adminNote || "Khiếu nại đã bị từ chối. Tài khoản vẫn bị khóa.",
    };
  }

  // PROCESSED nhưng user vẫn bị khóa lại sau đó → cho khiếu nại mới.
  return {
    accountLocked: true,
    phase: "can_appeal",
    canAppeal: true,
    appeal,
    message: "Tài khoản đã bị khóa lại. Bạn có thể gửi khiếu nại một lần.",
  };
}

async function createAccountLockAppeal(user, payload = {}) {
  if (Number(user?.Status) !== USER_STATUS.BLOCKED) {
    throw createServiceError("Chỉ tài khoản bị khóa mới được gửi khiếu nại này.", 400);
  }

  const status = await getAccountLockAppealStatus(user);
  if (!status.canAppeal) {
    if (status.phase === "pending") {
      throw createServiceError("Bạn đã gửi khiếu nại và đang chờ admin xử lý.", 409);
    }
    if (status.phase === "rejected") {
      throw createServiceError(
        "Khiếu nại đã bị từ chối. Bạn không thể gửi lại.",
        409
      );
    }
    throw createServiceError("Không thể gửi khiếu nại lúc này.", 400);
  }

  const note = pickString(payload.content || payload.message || payload.note);
  if (!note) {
    throw createServiceError("Vui lòng nhập nội dung khiếu nại.", 400);
  }

  const title =
    pickString(payload.title || payload.reason) ||
    REPORT_TYPE_LABELS[REPORT_TYPE.ACCOUNT_LOCK_APPEAL];
  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);
  const now = new Date();
  const lockedAt = await ensureUserLockedAt(user);

  const report = await Report.create({
    userId: user._id,
    reportType: REPORT_TYPE.ACCOUNT_LOCK_APPEAL,
    title,
    content: note,
    status: REPORT_STATUS.PENDING,
    lockSessionAt: lockedAt || now,
    images: normalizeEmbeddedImages(imageUrls),
    CreatedAt: now,
    UpdatedAt: now,
  });
  const images = normalizeReportImages(report.images);

  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[REPORT_TYPE.ACCOUNT_LOCK_APPEAL],
    title: report.title,
    content: report.content,
    status: report.status,
    statusLabel: "Chờ admin xử lý",
    images,
    createdAt: report.CreatedAt,
  };
}

/**
 * Trạng thái khiếu nại khóa gian hàng cho seller hiện tại.
 */
async function getShopLockAppealStatus(user) {
  const shop = await findShopByUserId(user._id);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng của bạn.", 404);
  }

  const shopLocked = Number(shop.status) === SHOP_STATUS.BLOCKED;
  if (!shopLocked) {
    return {
      shopLocked: false,
      shopId: String(shop._id),
      phase: "active",
      canAppeal: false,
      appeal: null,
      message: "Gian hàng đang hoạt động.",
    };
  }

  const lockedAt = await ensureShopLockedAt(shop);
  const latest = await findLatestShopLockAppeal(user._id, shop._id, lockedAt);
  if (!latest) {
    return {
      shopLocked: true,
      shopId: String(shop._id),
      phase: "can_appeal",
      canAppeal: true,
      appeal: null,
      message: "Gian hàng đã bị khóa. Bạn có thể gửi khiếu nại một lần.",
    };
  }

  const images = await loadAppealImages(latest._id);
  const appeal = {
    id: String(latest._id),
    status: latest.status,
    statusLabel: latest.status === REPORT_STATUS.PENDING
      ? "Chờ admin xử lý"
      : latest.status === REPORT_STATUS.REJECTED
        ? "Đã từ chối"
        : latest.status === REPORT_STATUS.PROCESSED
          ? "Đã mở khóa"
          : "Không rõ",
    title: latest.title || "",
    content: latest.content || "",
    adminNote: latest.adminNote || "",
    images,
    createdAt: latest.CreatedAt,
    processedAt: latest.processedAt || null,
  };

  if (latest.status === REPORT_STATUS.PENDING) {
    return {
      shopLocked: true,
      shopId: String(shop._id),
      phase: "pending",
      canAppeal: false,
      appeal,
      message: "Đã gửi khiếu nại. Đang chờ admin xử lý.",
    };
  }

  if (latest.status === REPORT_STATUS.REJECTED) {
    return {
      shopLocked: true,
      shopId: String(shop._id),
      phase: "rejected",
      canAppeal: false,
      appeal,
      message: latest.adminNote || "Khiếu nại đã bị từ chối. Gian hàng vẫn bị khóa.",
    };
  }

  return {
    shopLocked: true,
    shopId: String(shop._id),
    phase: "can_appeal",
    canAppeal: true,
    appeal,
    message: "Gian hàng đã bị khóa lại. Bạn có thể gửi khiếu nại một lần.",
  };
}

async function createShopLockAppeal(user, payload = {}) {
  const shop = await findShopByUserId(user._id);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng của bạn.", 404);
  }

  if (Number(shop.status) !== SHOP_STATUS.BLOCKED) {
    throw createServiceError("Chỉ gian hàng bị khóa mới được gửi khiếu nại này.", 400);
  }

  const status = await getShopLockAppealStatus(user);
  if (!status.canAppeal) {
    if (status.phase === "pending") {
      throw createServiceError("Bạn đã gửi khiếu nại và đang chờ admin xử lý.", 409);
    }
    if (status.phase === "rejected") {
      throw createServiceError(
        "Khiếu nại đã bị từ chối. Bạn không thể gửi lại.",
        409
      );
    }
    throw createServiceError("Không thể gửi khiếu nại lúc này.", 400);
  }

  const note = pickString(payload.content || payload.message || payload.note);
  if (!note) {
    throw createServiceError("Vui lòng nhập nội dung khiếu nại.", 400);
  }

  const title =
    pickString(payload.title || payload.reason) ||
    REPORT_TYPE_LABELS[REPORT_TYPE.SHOP_LOCK_APPEAL];
  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);
  const now = new Date();
  const lockedAt = await ensureShopLockedAt(shop);

  const report = await Report.create({
    userId: user._id,
    shopId: shop._id,
    reportType: REPORT_TYPE.SHOP_LOCK_APPEAL,
    title,
    content: note,
    status: REPORT_STATUS.PENDING,
    lockSessionAt: lockedAt || now,
    images: normalizeEmbeddedImages(imageUrls),
    CreatedAt: now,
    UpdatedAt: now,
  });
  const images = normalizeReportImages(report.images);

  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[REPORT_TYPE.SHOP_LOCK_APPEAL],
    title: report.title,
    content: report.content,
    status: report.status,
    statusLabel: "Chờ admin xử lý",
    images,
    createdAt: report.CreatedAt,
  };
}

module.exports = {
  createReport,
  getAccountLockAppealStatus,
  createAccountLockAppeal,
  getShopLockAppealStatus,
  createShopLockAppeal,
  isLegacyShopLockAppealReport,
  normalizeImageUrls,
  MAX_ACCOUNT_REPORT_IMAGES,
};
