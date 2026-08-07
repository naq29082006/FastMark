const { PRODUCT_REMOVED_BY } = require("../constants");

function pickString(value) {
  return String(value || "").trim();
}

function resolveProductRemovedBy(product) {
  const removedBy = pickString(product?.RemovedBy).toLowerCase();
  if (removedBy === PRODUCT_REMOVED_BY.ADMIN || removedBy === PRODUCT_REMOVED_BY.SELLER) {
    return removedBy;
  }

  if (product?.SellerRemovedAt) {
    return PRODUCT_REMOVED_BY.SELLER;
  }

  if (product?.IsDeleted === false || Number(product?.IsDeleted) === 1) {
    return "";
  }

  if (Number(product?.IsDeleted) === 0 || product?.IsDeleted === true) {
    return pickString(product?.AdminRemovalReason)
      ? PRODUCT_REMOVED_BY.ADMIN
      : PRODUCT_REMOVED_BY.SELLER;
  }

  return "";
}

function isRemovedProduct(product) {
  const removedBy = resolveProductRemovedBy(product);
  return removedBy === PRODUCT_REMOVED_BY.ADMIN || removedBy === PRODUCT_REMOVED_BY.SELLER;
}

function isAdminRemovedProduct(product) {
  return resolveProductRemovedBy(product) === PRODUCT_REMOVED_BY.ADMIN;
}

function isSellerRemovedProduct(product) {
  return resolveProductRemovedBy(product) === PRODUCT_REMOVED_BY.SELLER;
}

function resolveProductRemovedAt(product) {
  return product?.RemovedAt || product?.AdminRemovedAt || product?.SellerRemovedAt || null;
}

function toAdminProductRemovalFields(product) {
  const removedAt = resolveProductRemovedAt(product);
  const removedBy = resolveProductRemovedBy(product);
  return {
    isDeleted: isRemovedProduct(product),
    isAdminRemoved: isAdminRemovedProduct(product),
    isSellerRemoved: isSellerRemovedProduct(product),
    removedBy,
    removedAt,
    sellerRemovedAt: isSellerRemovedProduct(product) ? removedAt : null,
    adminRemovalReason: pickString(product?.AdminRemovalReason),
    adminRemovedAt: isAdminRemovedProduct(product) ? removedAt : null,
  };
}

/** Mongo: sản phẩm chưa bị gỡ (admin hoặc seller). */
function notRemovedProductMatch() {
  return {
    $and: [
      {
        $or: [
          { $expr: { $in: ["$IsDeleted", [1, false]] } },
          { IsDeleted: { $exists: false } },
        ],
      },
      {
        $or: [
          { RemovedBy: { $in: ["", null] } },
          { RemovedBy: { $exists: false } },
        ],
      },
      {
        $or: [
          { SellerRemovedAt: null },
          { SellerRemovedAt: { $exists: false } },
        ],
      },
    ],
  };
}

/** Mongo: sản phẩm đã bị gỡ. */
function removedProductConditions() {
  return [
    { IsDeleted: 0 },
    { $expr: { $eq: ["$IsDeleted", true] } },
    { RemovedBy: PRODUCT_REMOVED_BY.ADMIN },
    { RemovedBy: PRODUCT_REMOVED_BY.SELLER },
    { SellerRemovedAt: { $ne: null } },
  ];
}

module.exports = {
  isRemovedProduct,
  isAdminRemovedProduct,
  isSellerRemovedProduct,
  resolveProductRemovedBy,
  resolveProductRemovedAt,
  toAdminProductRemovalFields,
  notRemovedProductMatch,
  removedProductConditions,
};
