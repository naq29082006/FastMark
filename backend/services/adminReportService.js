const mongoose = require("mongoose");
const Report = require("../models/Report");
const Review = require("../models/Review");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const {
  REPORT_STATUS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE,
  REPORT_TYPE_LABELS,
  CONTENT_REPORT_TYPES,
  PRODUCT_STATUS,
  SHOP_STATUS,
  SHOP_OPEN,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
  USER_ROLE,
} = require("../constants");
const { resolveMediaUrl } = require("../utils/resolveMediaUrl");
const { normalizeEmbeddedImages } = require("../utils/embeddedImages");
const { createNotification } = require("./notificationService");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");
const { notifyReviewerReviewModerated } = require("./adminReviewService");
const {
  isReviewSoftDeleted,
  isReviewHidden,
  markReviewAdminHidden,
  markReviewAdminDeleted,
  toAdminReviewRemovalFields,
} = require("../utils/reviewRemoval");
const { blockAccount, unblockAccount } = require("./adminAccountService");
const { setShopStatus } = require("./adminCatalogService");
const { isLegacyShopLockAppealReport } = require("./lockAppealService");
const {
  resolveShopDisplayName,
  resolveShopUsername,
} = require("../utils/shopIdentity");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendStatusLabelSearchConditions,
  appendUniqueOrConditions,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");
const {
  resolveReportTypeLabel,
  isReservationDisputeReportType,
  isContentTargetReportType,
  normalizeReportType,
} = require("../utils/reportType");

const SEED_DEMO_TAG = "seed-report-demo";
const LEGACY_REPORT_TYPES = [8, 9, 10, 11];
const ADMIN_REPORT_TYPES = [...CONTENT_REPORT_TYPES, ...LEGACY_REPORT_TYPES];

const MEMBER_REPORT_TYPES = [
  REPORT_TYPE.SHOP,
  REPORT_TYPE.ACCOUNT_LOCK_APPEAL,
  REPORT_TYPE.SHOP_LOCK_APPEAL,
];

function isAccountLockAppealReport(report) {
  return normalizeReportType(report?.reportType) === REPORT_TYPE.ACCOUNT_LOCK_APPEAL;
}

function isShopLockAppealReport(report) {
  if (normalizeReportType(report?.reportType) === REPORT_TYPE.SHOP_LOCK_APPEAL) {
    return true;
  }
  return isLegacyShopLockAppealReport(report);
}

function isReservationDisputeReport(report) {
  return isReservationDisputeReportType(report);
}

function resolveReportTypeLabelForReport(report) {
  return resolveReportTypeLabel(report?.reportType);
}

async function resolveShopIdForShopLockAppeal(report) {
  if (report.shopId) {
    return report.shopId;
  }
  if (!report.userId) {
    return null;
  }
  const shop = await ShopProfile.findOne({ userId: report.userId }).select("_id").lean();
  return shop?._id || null;
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function loadReportTargetContext(reports) {
  const productIds = [
    ...new Set(reports.map((report) => report.productId).filter(Boolean).map(String)),
  ];
  const reviewIds = [
    ...new Set(reports.map((report) => pickString(report.reviewId)).filter(Boolean)),
  ];
  const directShopIds = [
    ...new Set(reports.map((report) => report.shopId).filter(Boolean).map(String)),
  ];

  const [products, reviews] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName ShopId").lean()
      : [],
    reviewIds.length
      ? Review.find({
          $or: [
            { legacyExternalId: { $in: reviewIds } },
            ...(reviewIds.filter(isStrictMongoObjectId).length
              ? [{ _id: { $in: reviewIds.filter(isStrictMongoObjectId) } }]
              : []),
          ],
        }).lean()
      : [],
  ]);

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const reviewByExternalId = new Map();
  reviews.forEach((review) => {
    if (review.legacyExternalId) {
      reviewByExternalId.set(String(review.legacyExternalId), review);
    }
    reviewByExternalId.set(String(review._id), review);
  });

  const shopIdSet = new Set(directShopIds);
  products.forEach((product) => {
    if (product.ShopId) {
      shopIdSet.add(String(product.ShopId));
    }
  });
  reviews.forEach((review) => {
    if (review.shopId) {
      shopIdSet.add(String(review.shopId));
    }
    if (review.storeId) {
      shopIdSet.add(String(review.storeId));
    }
  });

  const objectIds = [...shopIdSet].filter(isStrictMongoObjectId);
  const externalIds = [...shopIdSet].filter((id) => !isStrictMongoObjectId(id));

  const shopQuery = [];
  if (objectIds.length) {
    shopQuery.push({ _id: { $in: objectIds } });
  }
  if (externalIds.length) {
    shopQuery.push({ externalRestaurantId: { $in: externalIds } });
  }

  const linkedShops = shopQuery.length
    ? await ShopProfile.find({ $or: shopQuery })
        .select("shopName description externalRestaurantId userId")
        .lean()
    : [];

  const ownerIds = [
    ...new Set(linkedShops.map((shop) => (shop.userId ? String(shop.userId) : "")).filter(Boolean)),
  ];
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } }).select("FullName UserName Email Avatar").lean()
    : [];
  const ownerById = new Map(owners.map((owner) => [String(owner._id), owner]));

  const shopNameById = new Map();
  const shopNameByExternalId = new Map();
  const shopOwnerByShopId = new Map();

  linkedShops.forEach((shop) => {
    const owner = shop.userId ? ownerById.get(String(shop.userId)) : null;
    const displayName = pickShopDisplayName(shop, owner);
    if (displayName) {
      shopNameById.set(String(shop._id), displayName);
      if (shop.externalRestaurantId) {
        shopNameByExternalId.set(String(shop.externalRestaurantId), displayName);
      }
    }
    if (shop.userId) {
      shopOwnerByShopId.set(String(shop._id), String(shop.userId));
    }
  });

  return {
    productById,
    reviewByExternalId,
    shopNameById,
    shopNameByExternalId,
    shopOwnerByShopId,
    ownerById,
  };
}

function resolveTargetOwnerFromContext(report, context) {
  if (report.shopId) {
    const ownerId = context.shopOwnerByShopId.get(String(report.shopId));
    if (ownerId) {
      return context.ownerById.get(String(ownerId)) || null;
    }
  }

  if (report.productId) {
    const product = context.productById.get(String(report.productId));
    if (product?.ShopId) {
      const ownerId = context.shopOwnerByShopId.get(String(product.ShopId));
      if (ownerId) {
        return context.ownerById.get(String(ownerId)) || null;
      }
    }
  }

  if (report.reviewId) {
    const review = context.reviewByExternalId.get(pickString(report.reviewId));
    const shopId = review?.shopId || review?.storeId;
    if (shopId) {
      const ownerId = context.shopOwnerByShopId.get(String(shopId));
      if (ownerId) {
        return context.ownerById.get(String(ownerId)) || null;
      }
    }
  }

  return null;
}

function resolveShopNameFromStoreId(storeId, context) {
  const normalizedStoreId = pickString(storeId);
  if (!normalizedStoreId) {
    return "";
  }

  return (
    context.shopNameById.get(normalizedStoreId) ||
    context.shopNameByExternalId.get(normalizedStoreId) ||
    ""
  );
}

function resolveReportTargetNames(report, context) {
  let targetProductName = "";
  let targetShopName = "";

  if (report.shopId) {
    targetShopName = resolveShopNameFromStoreId(report.shopId, context);
  }

  if (report.productId) {
    const product = context.productById.get(String(report.productId));
    if (product) {
      targetProductName = pickString(product.ProductName);
      if (product.ShopId) {
        targetShopName = resolveShopNameFromStoreId(product.ShopId, context);
      }
    }
  }

  if (!targetShopName && report.reviewId) {
    const review = context.reviewByExternalId.get(pickString(report.reviewId));
    const shopId = review?.shopId || review?.storeId;
    if (shopId) {
      targetShopName = resolveShopNameFromStoreId(shopId, context);
    }
  }

  return {
    targetProductName,
    targetShopName,
    target_product_name: targetProductName,
    target_shop_name: targetShopName,
  };
}

function toReporterSummary(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    userName: user.UserName || "",
    fullName: user.FullName || "",
    email: user.Email || "",
    avatar: user.Avatar || "",
  };
}

function toShopDetailSummary(shop, owner = null) {
  if (!shop) {
    return null;
  }

  return {
    id: String(shop._id),
    name: pickShopDisplayName(shop, owner),
    description: pickString(shop.description),
    address: pickString(shop.addressHeThong) || pickString(shop.DiaChiHeThong) || pickString(shop.address),
    phone: pickString(shop.phone),
    userId: shop.userId ? String(shop.userId) : "",
  };
}

function toProductDetailSummary(product, shopName = "") {
  if (!product) {
    return null;
  }

  return {
    id: String(product._id),
    name: pickString(product.ProductName),
    description: pickString(product.Description),
    shopName,
  };
}

function buildTargetSubjectLabel({ report, targetNames, targetUser, shop, product }) {
  const type = normalizeReportType(report.reportType);
  if (type === REPORT_TYPE.PRODUCT) {
    const productName = product?.name || targetNames.targetProductName;
    if (productName) {
      return `Sản phẩm: ${productName}`;
    }
  }

  if ([REPORT_TYPE.SHOP, REPORT_TYPE.REVIEW].includes(type) || shop?.name) {
    const shopName = shop?.name || targetNames.targetShopName;
    if (shopName) {
      return `Gian hàng: ${shopName}`;
    }
  }

  if (targetUser) {
    const name = pickString(targetUser.FullName) || pickString(targetUser.UserName) || "Người dùng";
    const email = pickString(targetUser.Email);
    return email ? `${name} (${email})` : name;
  }

  return "";
}

function toReviewSummary(review) {
  if (!review) {
    return null;
  }

  return {
    id: String(review._id),
    legacyExternalId: review.legacyExternalId || "",
    storeId: review.storeId || "",
    userName: review.userName || "Khách hàng",
    rating: review.rating,
    comment: review.comment || "",
    imageUrl: review.imageUrl || "",
    ...toAdminReviewRemovalFields(review),
    createdAt: review.CreatedAt || null,
  };
}

async function findReviewForReport(report) {
  if (report.reviewId) {
    const reviewId = pickString(report.reviewId);
    const query = isStrictMongoObjectId(reviewId)
      ? { $or: [{ _id: reviewId }, { legacyExternalId: reviewId }] }
      : { legacyExternalId: reviewId };
    const byId = await Review.findOne(query).lean();
    if (byId) {
      return byId;
    }
  }

  if (normalizeReportType(report.reportType) === REPORT_TYPE.REVIEW && report.content) {
    return Review.findOne({ comment: report.content }).sort({ CreatedAt: -1 }).lean();
  }

  return null;
}

function toReportListItem(report, reporter, targetUser, targetNames = {}) {
  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: resolveReportTypeLabelForReport(report),
    title: report.title || "",
    content: report.content || "",
    description: report.content || report.description || "",
    reservationId: report.reservationId ? String(report.reservationId) : "",
    latitude: report.latitude == null ? null : Number(report.latitude),
    longitude: report.longitude == null ? null : Number(report.longitude),
    status: report.status,
    statusLabel: REPORT_STATUS_LABELS[report.status] || "Không rõ",
    reasonLabel: report.title || "Không rõ",
    reporter: toReporterSummary(reporter),
    targetUser: toReporterSummary(targetUser),
    targetProductName: targetNames.targetProductName || "",
    targetShopName: targetNames.targetShopName || "",
    target_product_name: targetNames.target_product_name || "",
    target_shop_name: targetNames.target_shop_name || "",
    createdAt: report.CreatedAt || null,
    processedAt: report.processedAt || null,
  };
}

async function buildReportFilter({ search, reportType, status, scope, productId, from, to }) {
  const filter = {};
  const normalizedType = pickString(reportType);
  const normalizedStatus = pickString(status);
  const normalizedScope = pickString(scope);
  const keyword = pickString(search);
  const normalizedProductId = pickString(productId);

  const hasProductScope =
    normalizedProductId && mongoose.Types.ObjectId.isValid(normalizedProductId);

  if (hasProductScope) {
    filter.productId = new mongoose.Types.ObjectId(normalizedProductId);
  }

  // Tab Báo cáo chỉ quản lý báo cáo nội dung (review/user/shop/product).
  // Khiếu nại đơn giữ hàng → tab Tranh chấp.
  // Trang chi tiết sản phẩm truyền productId → hiển thị mọi báo cáo gắn sản phẩm (kể cả sự cố giữ hàng).
  if (!hasProductScope) {
    if (normalizedScope === "members") {
      if (normalizedType !== "" && MEMBER_REPORT_TYPES.includes(Number(normalizedType))) {
        filter.reportType = Number(normalizedType);
      } else {
        filter.reportType = { $in: MEMBER_REPORT_TYPES };
      }
    } else if (normalizedType !== "" && ADMIN_REPORT_TYPES.includes(Number(normalizedType))) {
      filter.reportType = Number(normalizedType);
    } else {
      filter.reportType = { $in: ADMIN_REPORT_TYPES };
    }
  } else if (normalizedType !== "" && Number.isFinite(Number(normalizedType))) {
    filter.reportType = Number(normalizedType);
  }

  if (normalizedStatus === "history" || normalizedStatus === "processed") {
    filter.status = { $in: [REPORT_STATUS.PROCESSED, REPORT_STATUS.REJECTED] };
  } else if (normalizedStatus === "0" || normalizedStatus === "pending") {
    filter.status = REPORT_STATUS.PENDING;
  } else if (
    normalizedStatus !== "" &&
    [REPORT_STATUS.PENDING, REPORT_STATUS.PROCESSED, REPORT_STATUS.REJECTED].includes(
      Number(normalizedStatus)
    )
  ) {
    filter.status = Number(normalizedStatus);
  }

  if (keyword) {
    const orConditions = [];
    const regex = buildSearchRegex(keyword);

    if (regex) {
      const matchedUsers = await findUsersBySearchRegex(User, regex);
      const userIds = matchedUsers.map((user) => user._id);
      const matchedShopIds = userIds.length
        ? await ShopProfile.find({ userId: { $in: userIds } }).distinct("_id")
        : [];

      orConditions.push(
        { title: regex },
        { content: regex },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ...(matchedShopIds.length ? [{ shopId: { $in: matchedShopIds } }] : [])
      );
    }

    appendStatusLabelSearchConditions(orConditions, keyword, REPORT_STATUS_LABELS);
    appendStatusLabelSearchConditions(orConditions, keyword, REPORT_TYPE_LABELS, [], "reportType");
    orConditions.push(...buildObjectIdSearchConditions(keyword));

    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  applyCreatedAtRange(filter, { from, to });

  return filter;
}

function buildDatabaseQuery(filter) {
  return {
    $and: [filter, { content: { $not: new RegExp(SEED_DEMO_TAG, "i") } }],
  };
}

async function listReports({
  search = "",
  reportType = "",
  status = "",
  scope = "",
  productId = "",
  from = "",
  to = "",
  page = 1,
  limit = 20,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;
  const filter = buildDatabaseQuery(
    await buildReportFilter({ search, reportType, status, scope, productId, from, to })
  );

  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    Report.countDocuments(filter),
  ]);

  const [targetContext, reporterUsers] = await Promise.all([
    loadReportTargetContext(reports),
    User.find({
      _id: {
        $in: [...new Set(reports.map((report) => report.userId).filter(Boolean).map(String))],
      },
    }).lean(),
  ]);
  const reporterById = new Map(reporterUsers.map((user) => [String(user._id), user]));

  return {
    items: reports.map((report) =>
      toReportListItem(
        report,
        reporterById.get(String(report.userId)),
        resolveTargetOwnerFromContext(report, targetContext),
        resolveReportTargetNames(report, targetContext)
      )
    ),
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    meta: {
      dataSource: "mongodb",
      collection: "reports",
    },
  };
}

async function resolveReportTargetUser(report) {
  if (report.shopId) {
    const shop = await ShopProfile.findById(report.shopId).lean();
    if (shop?.userId) {
      return User.findById(shop.userId);
    }
  }

  if (report.productId) {
    const product = await Product.findById(report.productId).lean();
    if (product?.ShopId) {
      const shop = await ShopProfile.findById(product.ShopId).lean();
      if (shop?.userId) {
        return User.findById(shop.userId);
      }
    }
  }

  return null;
}

async function getReportDetail(reportId) {
  const report = await Report.findById(reportId).lean();
  if (!report) {
    throw createServiceError("Không tìm thấy báo cáo.", 404);
  }

  const [reporter, review, targetContext, shopDoc, productDoc, processedByUser] =
    await Promise.all([
      report.userId ? User.findById(report.userId).lean() : null,
      report.reviewId || normalizeReportType(report.reportType) === REPORT_TYPE.REVIEW
        ? findReviewForReport(report)
        : null,
      loadReportTargetContext([report]),
      report.shopId ? ShopProfile.findById(report.shopId).lean() : null,
      report.productId ? Product.findById(report.productId).lean() : null,
      report.processedBy ? User.findById(report.processedBy).lean() : null,
    ]);

  const images = normalizeEmbeddedImages(report.images || []);

  let resolvedShopDoc = shopDoc;
  if (!resolvedShopDoc && productDoc?.ShopId) {
    resolvedShopDoc = await ShopProfile.findById(productDoc.ShopId).lean();
  }

  const targetUserDoc = await resolveReportTargetUser(report);
  const targetNames = resolveReportTargetNames(report, targetContext);
  const shop = toShopDetailSummary(resolvedShopDoc, targetUserDoc);
  const product = toProductDetailSummary(
    productDoc,
    shop?.name ||
      targetNames.targetShopName ||
      pickShopDisplayName(resolvedShopDoc, targetUserDoc) ||
      ""
  );
  const targetSubjectLabel = buildTargetSubjectLabel({
    report,
    targetNames,
    targetUser: targetUserDoc,
    shop,
    product,
  });

  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: resolveReportTypeLabelForReport(report),
    title: report.title || "",
    content: report.content || "",
    description: report.content || report.description || "",
    reservationId: report.reservationId ? String(report.reservationId) : "",
    latitude: report.latitude == null ? null : Number(report.latitude),
    longitude: report.longitude == null ? null : Number(report.longitude),
    adminDecision: report.adminDecision || "",
    adminNote: report.adminNote || "",
    status: report.status,
    statusLabel: REPORT_STATUS_LABELS[report.status] || "Không rõ",
    reasonLabel: report.title || "Không rõ",
    reporter: toReporterSummary(reporter),
    targetUser: toReporterSummary(targetUserDoc),
    targetSubjectLabel,
    targetProductName: targetNames.targetProductName,
    targetShopName: targetNames.targetShopName,
    target_product_name: targetNames.target_product_name,
    target_shop_name: targetNames.target_shop_name,
    shop,
    product,
    review: toReviewSummary(review),
    evidenceImages: images.map((url, index) => ({
      id: String(index),
      url: resolveMediaUrl(url || ""),
      createdAt: null,
    })),
    processedBy: toReporterSummary(processedByUser),
    createdAt: report.CreatedAt || null,
    processedAt: report.processedAt || null,
    meta: {
      dataSource: "mongodb",
      collection: "reports",
    },
  };
}

async function assertPendingReport(reportId) {
  const report = await Report.findById(reportId);
  if (!report) {
    throw createServiceError("Không tìm thấy báo cáo.", 404);
  }

  if (report.status !== REPORT_STATUS.PENDING) {
    throw createServiceError("Báo cáo này đã được xử lý.", 400);
  }

  return report;
}

async function notifyReporter(report, { title, content }) {
  if (!report?.userId) {
    return;
  }
  await createNotification(report.userId, {
    title: title || "Cập nhật tố cáo",
    content:
      content ||
      "Báo cáo của bạn đã được hệ thống cập nhật. Cảm ơn bạn đã đóng góp.",
    audience: NOTIFICATION_AUDIENCE.SYSTEM,
    index: NOTIFICATION_INDEX.SYSTEM,
  });
  emitUserResourceUpdated(report.userId, "report", {
    reportId: String(report._id),
    status: report.status,
  });
}

const DEFAULT_APPROVE_REPLY =
  "Cảm ơn bạn đã báo cáo. Chúng tôi đã tiếp nhận và sẽ xem xét lại nội dung này.";
const DEFAULT_DISMISS_REPLY =
  "Báo cáo của bạn đã bị bác bỏ. Cảm ơn bạn đã đóng góp ý kiến.";
const DEFAULT_LOCK_APPEAL_APPROVE_REPLY =
  "Khiếu nại đã được chấp nhận. Tài khoản của bạn đã được mở khóa.";
const DEFAULT_LOCK_APPEAL_DISMISS_REPLY =
  "Khiếu nại khóa tài khoản đã bị từ chối. Tài khoản vẫn bị khóa.";
const DEFAULT_SHOP_LOCK_APPEAL_APPROVE_REPLY =
  "Khiếu nại đã được chấp nhận. Gian hàng của bạn đã được mở khóa.";
const DEFAULT_SHOP_LOCK_APPEAL_DISMISS_REPLY =
  "Khiếu nại khóa gian hàng đã bị từ chối. Gian hàng vẫn bị khóa.";

async function dismissReport(adminUser, reportId, { replyMessage } = {}) {
  const report = await assertPendingReport(reportId);
  const now = new Date();
  const isAccountLockAppeal = isAccountLockAppealReport(report);
  const isShopLockAppeal = isShopLockAppealReport(report);
  const message =
    pickString(replyMessage) ||
    (isAccountLockAppeal
      ? DEFAULT_LOCK_APPEAL_DISMISS_REPLY
      : isShopLockAppeal
        ? DEFAULT_SHOP_LOCK_APPEAL_DISMISS_REPLY
        : DEFAULT_DISMISS_REPLY);

  report.status = REPORT_STATUS.REJECTED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.adminNote = message;
  report.adminDecision = isAccountLockAppeal
    ? "reject-lock-appeal"
    : isShopLockAppeal
      ? "reject-shop-lock-appeal"
      : "dismiss";
  report.UpdatedAt = now;
  await report.save();

  await notifyReporter(report, {
    title: isAccountLockAppeal
      ? "Khiếu nại khóa tài khoản bị từ chối"
      : isShopLockAppeal
        ? "Khiếu nại khóa gian hàng bị từ chối"
        : "Tố cáo đã bị bác bỏ",
    content: message,
  });

  emitAdminUpdated("report", {
    reportId: String(report._id),
    status: REPORT_STATUS.REJECTED,
  });

  return getReportDetail(report._id);
}

async function applyReviewAction(report, action) {
  if (normalizeReportType(report.reportType) !== REPORT_TYPE.REVIEW) {
    return null;
  }

  const lean = await findReviewForReport(report);
  if (!lean) {
    throw createServiceError("Không tìm thấy đánh giá liên quan.", 404);
  }

  const review = await Review.findById(lean._id);
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá liên quan.", 404);
  }

  const wasHidden = isReviewHidden(review);
  const wasDeleted = isReviewSoftDeleted(review);
  const reason = pickString(report.adminNote || report.note || report.content) || "Vi phạm nội dung";

  if (action === "hide") {
    markReviewAdminHidden(review, reason);
  } else if (action === "delete") {
    markReviewAdminDeleted(review, reason);
  } else {
    throw createServiceError("Hành động xử lý không hợp lệ.", 400);
  }

  review.UpdatedAt = new Date();
  await review.save();
  if (action === "hide" && !wasHidden) {
    await notifyReviewerReviewModerated(review, "hidden", reason);
  } else if (action === "delete" && !wasDeleted) {
    await notifyReviewerReviewModerated(review, "deleted", reason);
  }
  return review;
}

async function resolveReportedShop(report) {
  if (report.shopId) {
    const shop = await ShopProfile.findById(report.shopId);
    if (shop) {
      return shop;
    }
  }

  if (report.productId) {
    const product = await Product.findById(report.productId).lean();
    if (product?.ShopId) {
      return ShopProfile.findById(product.ShopId);
    }
  }

  return null;
}

async function notifyShopOwner(shop, title, content) {
  if (!shop.userId) {
    return;
  }
  await createNotification(shop.userId, {
    title,
    content,
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.SYSTEM,
  });
}

async function hideShopProducts(shopId) {
  await Product.updateMany(
    { ShopId: shopId, Status: { $ne: PRODUCT_STATUS.HIDDEN } },
    { $set: { Status: PRODUCT_STATUS.HIDDEN, UpdatedAt: new Date() } }
  );
}

async function applyShopAction(report, action, adminUser) {
  const shop = await resolveReportedShop(report);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng bị báo cáo.", 404);
  }

  const now = new Date();

  if (action === "warn_limit") {
    const restrictedUntil = new Date(now);
    restrictedUntil.setDate(restrictedUntil.getDate() + 7);
    shop.visibilityRestrictedUntil = restrictedUntil;
    shop.UpdatedAt = now;
    await shop.save();
    await notifyShopOwner(
      shop,
      "Cảnh cáo vi phạm gian hàng",
      `Gian hàng của bạn đã bị cảnh cáo do báo cáo "${report.title || "Vi phạm"}" và bị giới hạn hiển thị trong 7 ngày.`
    );
    return { action, shopId: shop._id };
  }

  if (action === "suspend_7_days") {
    const suspendedUntil = new Date(now);
    suspendedUntil.setDate(suspendedUntil.getDate() + 7);
    shop.status = SHOP_STATUS.BLOCKED;
    shop.isOpen = SHOP_OPEN.CLOSED;
    shop.suspendedUntil = suspendedUntil;
    shop.lockedAt = now;
    shop.UpdatedAt = now;
    await shop.save();
    await hideShopProducts(shop._id);
    await notifyShopOwner(
      shop,
      "Tạm đình chỉ gian hàng",
      `Gian hàng của bạn bị tạm đình chỉ 7 ngày để điều tra báo cáo "${report.title || "Vi phạm"}".`
    );
    return { action, shopId: shop._id };
  }

  if (action === "permanent_close") {
    shop.status = SHOP_STATUS.BLOCKED;
    shop.isOpen = SHOP_OPEN.CLOSED;
    shop.permanentlyClosedAt = now;
    shop.suspendedUntil = null;
    shop.lockedAt = now;
    shop.UpdatedAt = now;
    await shop.save();
    await hideShopProducts(shop._id);

    if (shop.userId) {
      await blockAccount(adminUser, shop.userId);
    }
    return { action, shopId: shop._id };
  }

  throw createServiceError("Hành động xử lý gian hàng không hợp lệ.", 400);
}

async function applyUserAction(report, action, adminUser) {
  if (!isContentTargetReportType(report.reportType)) {
    return null;
  }

  const targetUser = await resolveReportTargetUser(report);
  if (!targetUser) {
    throw createServiceError("Không xác định được chủ sở hữu bị báo cáo.", 400);
  }

  if (targetUser.Role === USER_ROLE.ADMIN) {
    throw createServiceError("Không thể xử lý vi phạm cho tài khoản quản trị.", 403);
  }

  if (action === "warn") {
    await createNotification(targetUser._id, {
      title: "Cảnh cáo vi phạm",
      content: `Tài khoản của bạn đã nhận cảnh cáo từ quản trị viên do báo cáo "${report.title || "Vi phạm"}". Vui lòng tuân thủ quy định của FastMark.`,
      audience: NOTIFICATION_AUDIENCE.SYSTEM,
      index: NOTIFICATION_INDEX.SYSTEM,
    });
    return { action: "warn" };
  }

  if (action === "block") {
    await blockAccount(adminUser, targetUser._id);
    return { action: "block" };
  }

  throw createServiceError("Hành động xử lý không hợp lệ.", 400);
}

async function approveReport(adminUser, reportId, { action, replyMessage } = {}) {
  const report = await assertPendingReport(reportId);

  // Báo cáo tranh chấp giữ hàng → dùng approve-buyer / approve-seller / reject.
  if (isReservationDisputeReport(report)) {
    throw createServiceError(
      "Báo cáo giữ hàng: dùng /admin/reports/:id/approve-buyer | approve-seller | reject.",
      400
    );
  }

  const isAccountLockAppeal = isAccountLockAppealReport(report);
  const isShopLockAppeal = isShopLockAppealReport(report);
  const message =
    pickString(replyMessage) ||
    (isAccountLockAppeal
      ? DEFAULT_LOCK_APPEAL_APPROVE_REPLY
      : isShopLockAppeal
        ? DEFAULT_SHOP_LOCK_APPEAL_APPROVE_REPLY
        : DEFAULT_APPROVE_REPLY);
  const normalizedAction = isAccountLockAppeal
    ? "unlock-account"
    : isShopLockAppeal
      ? "unlock-shop"
      : "resolve";

  if (isAccountLockAppeal) {
    if (!report.userId) {
      throw createServiceError("Khiếu nại thiếu người gửi.", 400);
    }
    try {
      await unblockAccount(adminUser, report.userId);
    } catch (unlockError) {
      // Đã mở khóa rồi thì vẫn đánh dấu khiếu nại đã xử lý.
      if (!/đang hoạt động/i.test(String(unlockError.message || ""))) {
        throw unlockError;
      }
    }
  }

  if (isShopLockAppeal) {
    const shopId = await resolveShopIdForShopLockAppeal(report);
    if (!shopId) {
      throw createServiceError("Khiếu nại thiếu thông tin gian hàng.", 400);
    }
    try {
      await setShopStatus(shopId, SHOP_STATUS.ACTIVE);
    } catch (unlockError) {
      if (!/đang hoạt động/i.test(String(unlockError.message || ""))) {
        throw unlockError;
      }
    }
  }

  const now = new Date();
  report.status = REPORT_STATUS.PROCESSED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.adminNote = message;
  report.adminDecision = normalizedAction;
  report.UpdatedAt = now;
  await report.save();

  await notifyReporter(report, {
    title: isAccountLockAppeal
      ? "Tài khoản đã được mở khóa"
      : isShopLockAppeal
        ? "Gian hàng đã được mở khóa"
        : "Tố cáo đã được duyệt",
    content: message,
  });

  emitAdminUpdated("report", {
    reportId: String(report._id),
    status: REPORT_STATUS.PROCESSED,
    action: normalizedAction,
  });

  return getReportDetail(report._id);
}

function getDefaultContentAction(_reportType) {
  return "resolve";
}

function getApproveMessage(_reportType, _action) {
  return "Đã duyệt tố cáo và gửi thông báo cho người tố cáo.";
}

module.exports = {
  listReports,
  getReportDetail,
  dismissReport,
  approveReport,
  getApproveMessage,
  DEFAULT_APPROVE_REPLY,
  DEFAULT_DISMISS_REPLY,
};
