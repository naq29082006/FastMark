const { PRODUCT_REMOVED_BY } = require("../constants");

function pickString(value) {
  return String(value || "").trim();
}

function normalizeProductIsDeleted(product) {
  const raw = product?.IsDeleted;
  if (raw === false) {
    return 1;
  }
  if (raw === true) {
    return 0;
  }
  if (raw === null || raw === undefined) {
    return 1;
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return 1;
  }
  return num === 0 ? 0 : 1;
}

function resolveProductRemovedBy(product) {
  const removedBy = pickString(product?.RemovedBy).toLowerCase();
  if (removedBy === PRODUCT_REMOVED_BY.ADMIN || removedBy === PRODUCT_REMOVED_BY.SELLER) {
    return removedBy;
  }

  if (normalizeProductIsDeleted(product) === 0) {
    return pickString(product?.LyDoGo || product?.AdminRemovalReason)
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
    lyDoGo: pickString(product?.LyDoGo),
    adminRemovedAt: isAdminRemovedProduct(product) ? removedAt : null,
  };
}

/** Mongo: sản phẩm đã bị gỡ — dùng filter document (countDocuments/find), tránh $expr lồng $cond. */
function removedProductMatch() {
  return {
    $or: [
      { RemovedBy: { $in: [PRODUCT_REMOVED_BY.ADMIN, PRODUCT_REMOVED_BY.SELLER] } },
      {
        $and: [{ IsDeleted: { $type: "number" } }, { IsDeleted: 0 }],
      },
      {
        $and: [{ IsDeleted: { $type: "bool" } }, { IsDeleted: true }],
      },
    ],
  };
}

/** Mongo: sản phẩm chưa bị gỡ. */
function notRemovedProductMatch() {
  return {
    $nor: [removedProductMatch()],
  };
}

function emptyProductRemovedByMatch() {
  return {
    $or: [{ RemovedBy: "" }, { RemovedBy: null }, { RemovedBy: { $exists: false } }],
  };
}

function adminRemovedProductFilter() {
  return {
    $and: [
      removedProductMatch(),
      {
        $or: [
          { RemovedBy: PRODUCT_REMOVED_BY.ADMIN },
          {
            $and: [
              emptyProductRemovedByMatch(),
              { LyDoGo: { $exists: true, $nin: ["", null] } },
            ],
          },
        ],
      },
    ],
  };
}

function sellerRemovedProductFilter() {
  return {
    $and: [
      removedProductMatch(),
      {
        $or: [
          { RemovedBy: PRODUCT_REMOVED_BY.SELLER },
          {
            $and: [
              emptyProductRemovedByMatch(),
              {
                $or: [{ LyDoGo: { $exists: false } }, { LyDoGo: "" }, { LyDoGo: null }],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Aggregation $project: 1 = đã gỡ, 0 = còn hiệu lực. */
function productRemovedFlagExpr() {
  return {
    $cond: [
      {
        $or: [
          {
            $in: [
              { $toLower: { $ifNull: ["$RemovedBy", ""] } },
              [PRODUCT_REMOVED_BY.ADMIN, PRODUCT_REMOVED_BY.SELLER],
            ],
          },
          {
            $and: [
              { $eq: [{ $type: "$IsDeleted" }, "number"] },
              { $eq: ["$IsDeleted", 0] },
            ],
          },
          {
            $and: [
              { $eq: [{ $type: "$IsDeleted" }, "bool"] },
              { $eq: ["$IsDeleted", true] },
            ],
          },
        ],
      },
      1,
      0,
    ],
  };
}

/** @deprecated Dùng removedProductMatch(). */
function removedProductConditions() {
  return removedProductMatch().$or;
}

module.exports = {
  normalizeProductIsDeleted,
  isRemovedProduct,
  isAdminRemovedProduct,
  isSellerRemovedProduct,
  resolveProductRemovedBy,
  resolveProductRemovedAt,
  toAdminProductRemovalFields,
  productRemovedFlagExpr,
  removedProductMatch,
  notRemovedProductMatch,
  adminRemovedProductFilter,
  sellerRemovedProductFilter,
  removedProductConditions,
};
