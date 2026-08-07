const Product = require("../models/Product");
const ProductCategory = require("../models/ProductCategory");
const { DEFAULT_ESCROW_PROTECTION_DAYS } = require("../constants");
const {
  normalizeEscrowProtectionDays,
  escrowProtectionMs,
} = require("./escrowProtectionDays");

/** Gợi ý mặc định theo tên danh mục (seed / category chưa cấu hình). */
const CATEGORY_ESCROW_PRESETS = {
  "Thực phẩm": 1,
  "Đồ uống": 1,
  "Thời trang": 3,
  "Điện tử": 7,
  "Gia dụng": 5,
  "Mỹ phẩm": 3,
  Khác: 7,
};

function computeEscrowReleaseAt(fromDate = new Date(), days = DEFAULT_ESCROW_PROTECTION_DAYS) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const safeBase = Number.isFinite(base.getTime()) ? base : new Date();
  return new Date(safeBase.getTime() + escrowProtectionMs(days));
}

function resolveEscrowDaysFromCategory(category) {
  if (!category) {
    return DEFAULT_ESCROW_PROTECTION_DAYS;
  }
  if (category.disputeDays != null) {
    return normalizeEscrowProtectionDays(category.disputeDays);
  }
  if (category.escrowProtectionDays != null) {
    return normalizeEscrowProtectionDays(category.escrowProtectionDays);
  }
  const name = String(category.name || category.categoryName || "").trim();
  if (name && Object.prototype.hasOwnProperty.call(CATEGORY_ESCROW_PRESETS, name)) {
    return CATEGORY_ESCROW_PRESETS[name];
  }
  return DEFAULT_ESCROW_PROTECTION_DAYS;
}

async function resolveEscrowProtectionDaysForProduct(productId) {
  if (!productId) {
    return DEFAULT_ESCROW_PROTECTION_DAYS;
  }
  const product = await Product.findById(productId).select("CategoryId").lean();
  if (!product?.CategoryId) {
    return DEFAULT_ESCROW_PROTECTION_DAYS;
  }
  const category = await ProductCategory.findById(product.CategoryId)
    .select("name categoryName disputeDays escrowProtectionDays")
    .lean();
  return resolveEscrowDaysFromCategory(category);
}

function formatEscrowProtectionLabel(days) {
  const normalized = normalizeEscrowProtectionDays(days);
  return normalized === 1 ? "1 ngày" : `${normalized} ngày`;
}

module.exports = {
  CATEGORY_ESCROW_PRESETS,
  normalizeEscrowProtectionDays,
  escrowProtectionMs,
  computeEscrowReleaseAt,
  resolveEscrowDaysFromCategory,
  resolveEscrowProtectionDaysForProduct,
  formatEscrowProtectionLabel,
};
