const Report = require("../models/Report");
const ReportImage = require("../models/ReportImage");
const Review = require("../models/Review");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { REPORT_STATUS, REPORT_STATUS_LABELS } = require("../constants/reportStatus");
const { REPORT_TYPE, REPORT_TYPE_LABELS } = require("../constants/reportType");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { SHOP_STATUS, SHOP_OPEN } = require("../constants/shopStatus");
const { resolveMediaUrl } = require("../utils/resolveMediaUrl");
const { createNotification } = require("./notificationService");
const { blockAccount } = require("./adminAccountService");
const { USER_ROLE } = require("../constants/sellerVerification");

const SEED_DEMO_TAG = "seed-report-demo";

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

function pickShopDisplayName(shop) {
  if (!shop) {
    return "";
  }
  return pickString(shop.shopName) || pickString(shop.description);
}

async function loadReportTargetContext(reports) {
  const productIds = [
    ...new Set(reports.map((report) => report.productId).filter(Boolean).map(String)),
  ];
  const reviewIds = [
    ...new Set(reports.map((report) => pickString(report.reviewId)).filter(Boolean)),
  ];
  const targetUserIds = [
    ...new Set(reports.map((report) => report.targetUserId).filter(Boolean).map(String)),
  ];
  const directShopIds = [
    ...new Set(reports.map((report) => report.shopId).filter(Boolean).map(String)),
  ];

  const [products, reviews, sellerShops] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName ShopId").lean()
      : [],
    reviewIds.length ? Review.find({ externalId: { $in: reviewIds } }).lean() : [],
    targetUserIds.length
      ? ShopProfile.find({ userId: { $in: targetUserIds } }).select("shopName description userId").lean()
      : [],
  ]);

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const reviewByExternalId = new Map(reviews.map((review) => [review.externalId, review]));

  const shopIdSet = new Set(directShopIds);
  products.forEach((product) => {
    if (product.ShopId) {
      shopIdSet.add(String(product.ShopId));
    }
  });
  reviews.forEach((review) => {
    if (review.store_id) {
      shopIdSet.add(String(review.store_id));
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
    ? await ShopProfile.find({ $or: shopQuery }).select("shopName description externalRestaurantId").lean()
    : [];

  const shopNameById = new Map();
  const shopNameByExternalId = new Map();
  const shopNameByUserId = new Map();

  [...linkedShops, ...sellerShops].forEach((shop) => {
    const displayName = pickShopDisplayName(shop);
    if (!displayName) {
      return;
    }
    shopNameById.set(String(shop._id), displayName);
    if (shop.externalRestaurantId) {
      shopNameByExternalId.set(String(shop.externalRestaurantId), displayName);
    }
    if (shop.userId) {
      shopNameByUserId.set(String(shop.userId), displayName);
    }
  });

  return {
    productById,
    reviewByExternalId,
    shopNameById,
    shopNameByExternalId,
    shopNameByUserId,
  };
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
    if (review?.store_id) {
      targetShopName = resolveShopNameFromStoreId(review.store_id, context);
    }
  }

  if (!targetShopName && report.targetUserId) {
    targetShopName = context.shopNameByUserId.get(String(report.targetUserId)) || "";
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

function toShopDetailSummary(shop) {
  if (!shop) {
    return null;
  }

  return {
    id: String(shop._id),
    name: pickShopDisplayName(shop),
    address: pickString(shop.address) || pickString(shop.DiaChiHeThong),
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
  if (report.reportType === REPORT_TYPE.PRODUCT) {
    const productName = product?.name || targetNames.targetProductName;
    if (productName) {
      return `Sản phẩm: ${productName}`;
    }
  }

  if ([REPORT_TYPE.SHOP, REPORT_TYPE.REVIEW].includes(report.reportType) || shop?.name) {
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
    id: review.externalId,
    storeId: review.store_id,
    userName: review.user_name || "Khách hàng",
    rating: review.rating,
    comment: review.comment || "",
    isHidden: Boolean(review.is_hidden),
    isDeleted: Boolean(review.is_deleted),
    createdAt: review.created_at || review.createdAt || null,
  };
}

function toReportListItem(report, reporter, targetUser, targetNames = {}) {
  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[report.reportType] || "Không rõ",
    title: report.title || "",
    content: report.content || "",
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

async function buildReportFilter({ search, reportType, status }) {
  const filter = {};
  const normalizedType = pickString(reportType);
  const normalizedStatus = pickString(status);
  const keyword = pickString(search);

  if (normalizedType !== "" && Object.values(REPORT_TYPE).includes(Number(normalizedType))) {
    filter.reportType = Number(normalizedType);
  }

  if (normalizedStatus !== "" && Object.values(REPORT_STATUS).includes(Number(normalizedStatus))) {
    filter.status = Number(normalizedStatus);
  }

  if (keyword) {
    const escaped = escapeRegex(keyword);
    const regex = new RegExp(escaped, "i");
    const matchedUsers = await User.find({
      $or: [
        { UserName: regex },
        { FullName: regex },
        { Email: regex },
        { Phone: regex },
      ],
    })
      .select("_id")
      .lean();

    const userIds = matchedUsers.map((user) => user._id);

    filter.$or = [
      { title: regex },
      { content: regex },
      ...(userIds.length ? [{ userId: { $in: userIds } }, { targetUserId: { $in: userIds } }] : []),
    ];
  }

  return filter;
}

function buildDatabaseQuery(filter, { includeDemo = false } = {}) {
  if (includeDemo) {
    return filter;
  }

  return {
    $and: [filter, { content: { $not: new RegExp(SEED_DEMO_TAG, "i") } }],
  };
}

async function listReports({
  search = "",
  reportType = "",
  status = "",
  page = 1,
  limit = 20,
  includeDemo = false,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;
  const filter = buildDatabaseQuery(await buildReportFilter({ search, reportType, status }), {
    includeDemo,
  });

  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    Report.countDocuments(filter),
  ]);

  const userIds = [
    ...new Set(
      reports
        .flatMap((report) => [report.userId, report.targetUserId])
        .filter(Boolean)
        .map(String)
    ),
  ];

  const [users, targetContext] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).lean() : [],
    loadReportTargetContext(reports),
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));

  return {
    items: reports.map((report) =>
      toReportListItem(
        report,
        userById.get(String(report.userId)),
        userById.get(String(report.targetUserId)),
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
      includeDemo: Boolean(includeDemo),
    },
  };
}

async function resolveReportTargetUser(report) {
  if (report.targetUserId) {
    return User.findById(report.targetUserId);
  }

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

  const [reporter, images, review, targetContext, shopDoc, productDoc, processedByUser] =
    await Promise.all([
      report.userId ? User.findById(report.userId).lean() : null,
      ReportImage.find({ reportId: report._id }).sort({ CreatedAt: 1 }).lean(),
      report.reviewId
        ? Review.findOne({ externalId: report.reviewId }).lean()
        : report.reportType === REPORT_TYPE.REVIEW && report.content
          ? Review.findOne({ comment: report.content }).sort({ created_at: -1 }).lean()
          : null,
      loadReportTargetContext([report]),
      report.shopId ? ShopProfile.findById(report.shopId).lean() : null,
      report.productId ? Product.findById(report.productId).lean() : null,
      report.processedBy ? User.findById(report.processedBy).lean() : null,
    ]);

  let resolvedShopDoc = shopDoc;
  if (!resolvedShopDoc && productDoc?.ShopId) {
    resolvedShopDoc = await ShopProfile.findById(productDoc.ShopId).lean();
  }

  const targetUserDoc = await resolveReportTargetUser(report);
  const targetNames = resolveReportTargetNames(report, targetContext);
  const shop = toShopDetailSummary(resolvedShopDoc);
  const product = toProductDetailSummary(
    productDoc,
    shop?.name || targetNames.targetShopName || ""
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
    reportTypeLabel: REPORT_TYPE_LABELS[report.reportType] || "Không rõ",
    title: report.title || "",
    content: report.content || "",
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
    evidenceImages: images.map((image) => ({
      id: String(image._id),
      url: resolveMediaUrl(image.imageUrl || ""),
      createdAt: image.CreatedAt || null,
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

async function dismissReport(adminUser, reportId) {
  const report = await assertPendingReport(reportId);
  const now = new Date();

  report.status = REPORT_STATUS.REJECTED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.UpdatedAt = now;
  await report.save();

  return getReportDetail(report._id);
}

async function applyReviewAction(report, action) {
  if (report.reportType !== REPORT_TYPE.REVIEW) {
    return null;
  }

  const reviewQuery = report.reviewId
    ? { externalId: report.reviewId }
    : report.content
      ? { comment: report.content }
      : null;

  if (!reviewQuery) {
    throw createServiceError("Không xác định được đánh giá cần xử lý.", 400);
  }

  const review = await Review.findOne(reviewQuery);
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá liên quan.", 404);
  }

  if (action === "hide") {
    review.is_hidden = true;
  } else if (action === "delete") {
    review.is_deleted = true;
  } else {
    throw createServiceError("Hành động xử lý không hợp lệ.", 400);
  }

  await review.save();
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

  if (report.targetUserId) {
    return ShopProfile.findOne({ userId: report.targetUserId });
  }

  return null;
}

async function notifyShopOwner(shop, title, content) {
  if (!shop.userId) {
    return;
  }
  await createNotification(shop.userId, { title, content });
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

function isUserLikeReportType(reportType) {
  return [REPORT_TYPE.USER, REPORT_TYPE.SHOP, REPORT_TYPE.PRODUCT].includes(reportType);
}

async function applyUserAction(report, action, adminUser) {
  if (!isUserLikeReportType(report.reportType)) {
    return null;
  }

  if (!report.targetUserId) {
    const targetUser = await resolveReportTargetUser(report);
    if (!targetUser) {
      throw createServiceError("Không xác định được người dùng bị báo cáo.", 400);
    }
    report.targetUserId = targetUser._id;
  }

  const targetUser = await User.findById(report.targetUserId);
  if (!targetUser) {
    throw createServiceError("Không tìm thấy người dùng bị báo cáo.", 404);
  }

  if (targetUser.Role === USER_ROLE.ADMIN) {
    throw createServiceError("Không thể xử lý vi phạm cho tài khoản quản trị.", 403);
  }

  if (action === "warn") {
    await createNotification(targetUser._id, {
      title: "Cảnh cáo vi phạm",
      content: `Tài khoản của bạn đã nhận cảnh cáo từ quản trị viên do báo cáo "${report.title || "Vi phạm"}". Vui lòng tuân thủ quy định của FastMark.`,
    });
    return { action: "warn" };
  }

  if (action === "block") {
    await blockAccount(adminUser, targetUser._id);
    return { action: "block" };
  }

  throw createServiceError("Hành động xử lý không hợp lệ.", 400);
}

async function approveReport(adminUser, reportId, { action } = {}) {
  const report = await assertPendingReport(reportId);
  const normalizedAction = pickString(action) || "hide";

  if (report.reportType === REPORT_TYPE.REVIEW) {
    if (!["hide", "delete"].includes(normalizedAction)) {
      throw createServiceError("Hành động xử lý đánh giá không hợp lệ.", 400);
    }
    await applyReviewAction(report, normalizedAction);
  } else if (report.reportType === REPORT_TYPE.SHOP) {
    if (!["warn_limit", "suspend_7_days", "permanent_close"].includes(normalizedAction)) {
      throw createServiceError("Hành động xử lý gian hàng không hợp lệ.", 400);
    }
    await applyShopAction(report, normalizedAction, adminUser);
  } else if (isUserLikeReportType(report.reportType)) {
    if (!["warn", "block"].includes(normalizedAction)) {
      throw createServiceError("Hành động xử lý người dùng không hợp lệ.", 400);
    }
    await applyUserAction(report, normalizedAction, adminUser);
  } else {
    throw createServiceError("Loại báo cáo không được hỗ trợ xử lý.", 400);
  }

  const now = new Date();
  report.status = REPORT_STATUS.PROCESSED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.UpdatedAt = now;
  await report.save();

  return getReportDetail(report._id);
}

function getApproveMessage(reportType, action) {
  if (reportType === REPORT_TYPE.SHOP) {
    if (action === "permanent_close") {
      return "Đã khóa vĩnh viễn gian hàng, ẩn sản phẩm và khóa tài khoản chủ shop.";
    }
    if (action === "suspend_7_days") {
      return "Đã tạm đình chỉ gian hàng 7 ngày và ẩn toàn bộ sản phẩm.";
    }
    return "Đã cảnh cáo và giới hạn hiển thị gian hàng.";
  }

  if (isUserLikeReportType(reportType)) {
    if (action === "block") {
      return "Đã khóa tài khoản người dùng và duyệt báo cáo.";
    }
    return "Đã cảnh cáo người dùng và duyệt báo cáo.";
  }

  if (action === "delete") {
    return "Đã duyệt vi phạm và xóa mềm đánh giá.";
  }

  return "Đã duyệt vi phạm và ẩn đánh giá.";
}

module.exports = {
  listReports,
  getReportDetail,
  dismissReport,
  approveReport,
  getApproveMessage,
};
