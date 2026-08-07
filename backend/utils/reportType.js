const Product = require("../models/Product");
const Review = require("../models/Review");
const ShopProfile = require("../models/ShopProfile");
const {
  REPORT_TYPE,
  REPORT_TYPE_LABELS,
  DISPUTE_VIRTUAL_REPORT_TYPE,
  LEGACY_REPORT_TYPE_LABELS,
} = require("../constants");

/** Map mã reportType cũ (DB legacy) sang mã chuẩn 1–7. */
const LEGACY_REPORT_TYPE_MAP = {
  2: REPORT_TYPE.OTHER,
  3: REPORT_TYPE.SHOP,
  4: REPORT_TYPE.PRODUCT,
  8: REPORT_TYPE.SYSTEM,
  9: REPORT_TYPE.OTHER,
  10: REPORT_TYPE.ACCOUNT_LOCK_APPEAL,
  11: REPORT_TYPE.SHOP_LOCK_APPEAL,
};

function normalizeReportType(raw) {
  const type = Number(raw);
  if (!Number.isFinite(type)) {
    return null;
  }
  if (LEGACY_REPORT_TYPE_MAP[type] != null) {
    return LEGACY_REPORT_TYPE_MAP[type];
  }
  return type;
}

function resolveReportTypeLabel(raw) {
  const type = Number(raw);
  const normalized = normalizeReportType(type);
  if (normalized != null && REPORT_TYPE_LABELS[normalized]) {
    return REPORT_TYPE_LABELS[normalized];
  }
  if (REPORT_TYPE_LABELS[type]) {
    return REPORT_TYPE_LABELS[type];
  }
  return LEGACY_REPORT_TYPE_LABELS[type] || "Không rõ";
}

function isDisputeVirtualReportType(raw) {
  const type = Number(raw);
  return [
    DISPUTE_VIRTUAL_REPORT_TYPE.BUYER_NO_SHOW,
    DISPUTE_VIRTUAL_REPORT_TYPE.SELLER_NO_SHOW,
    DISPUTE_VIRTUAL_REPORT_TYPE.PRODUCT_ISSUE,
  ].includes(type);
}

function isReservationDisputeReportType(report) {
  const type = Number(report?.reportType);
  if (isDisputeVirtualReportType(type)) {
    return true;
  }
  return normalizeReportType(type) === REPORT_TYPE.OTHER && Boolean(report?.reservationId);
}

function isContentTargetReportType(raw) {
  const type = normalizeReportType(raw);
  return type === REPORT_TYPE.SHOP || type === REPORT_TYPE.PRODUCT;
}

async function buildReportsReceivedFilter(userId) {
  const shop = await ShopProfile.findOne({ userId }).select("_id").lean();
  if (!shop) {
    return { _id: null };
  }

  const [productIds, reviewIds] = await Promise.all([
    Product.find({ ShopId: shop._id }).distinct("_id"),
    Review.find({ shopId: shop._id }).distinct("_id"),
  ]);

  const orConditions = [{ shopId: shop._id }];
  if (productIds.length) {
    orConditions.push({ productId: { $in: productIds } });
  }
  if (reviewIds.length) {
    orConditions.push({ reviewId: { $in: reviewIds } });
  }

  return {
    userId: { $ne: userId },
    $or: orConditions,
  };
}

module.exports = {
  normalizeReportType,
  resolveReportTypeLabel,
  isDisputeVirtualReportType,
  isReservationDisputeReportType,
  isContentTargetReportType,
  buildReportsReceivedFilter,
};
