const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const ProductVariant = require("../models/ProductVariant");
const { PRODUCT_STATUS, SHOP_STATUS, isSubscriptionActive } = require("../constants");
const {
  buildPaginationMeta,
  normalizeRandomSeed,
  parsePagination,
  seededOffset,
} = require("../utils/pagination");

const { resolveShopDisplayName } = require("../utils/shopIdentity");
const { resolveShopLatlong, hasShopLatlong } = require("../utils/shopCoordinates");
const { notRemovedProductMatch } = require("../utils/productRemoval");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasValidCoordinate(value) {
  return value != null && value !== "" && Number.isFinite(Number(value));
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  if (
    !hasValidCoordinate(lat1) ||
    !hasValidCoordinate(lng1) ||
    !hasValidCoordinate(lat2) ||
    !hasValidCoordinate(lng2)
  ) {
    return null;
  }
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** % giảm → giá sau giảm (làm tròn VND). */
function computePromotionPriceFromPercent(originalPrice, discountPercent) {
  const original = Number(originalPrice) || 0;
  const percent = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  if (original <= 0 || percent <= 0) {
    return null;
  }
  if (percent >= 100) {
    return 0;
  }
  return Math.max(0, Math.round(original * (1 - percent / 100)));
}

/** Legacy: giá KM → % giảm (làm tròn xuống). */
function computeDiscountPercent(originalPrice, promotionPrice) {
  const original = Number(originalPrice) || 0;
  const promo = Number(promotionPrice) || 0;
  if (original <= 0 || promo < 0 || promo >= original) {
    return 0;
  }
  return Math.floor(((original - promo) / original) * 100);
}

function isPromotionActiveNow(product, now = new Date()) {
  if (!product) {
    return false;
  }
  const flagged = Boolean(product.IsPromotion ?? product.isPromotion);
  if (!flagged) {
    return false;
  }
  const start = product.PromotionStartDate ?? product.promotionStartDate;
  const end = product.PromotionEndDate ?? product.promotionEndDate;
  if (start && new Date(start) > now) {
    return false;
  }
  if (end && new Date(end) < now) {
    return false;
  }
  return true;
}

function formatAdminPriceRange(min, max) {
  const formatOne = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
  const minPrice = Number(min) || 0;
  const maxPrice = Number(max) || 0;
  if (minPrice === maxPrice) {
    return formatOne(minPrice);
  }
  return `${formatOne(minPrice)} - ${formatOne(maxPrice)}`;
}

/** Giá gốc + giá KM cho admin (list/detail/lịch sử). */
function buildAdminProductPriceFields(product, now = new Date()) {
  const minPrice = Number(product.MinPrice ?? product.minPrice) || 0;
  const maxPrice = Number(product.MaxPrice ?? product.maxPrice) || 0;
  const active = isPromotionActiveNow(product, now);
  const discountPercent = active ? Number(product.DiscountPercent ?? product.discountPercent) || 0 : 0;
  const isPromotion = active && discountPercent > 0;
  const promotionMinPrice = isPromotion
    ? computePromotionPriceFromPercent(minPrice, discountPercent)
    : null;
  const promotionMaxPrice = isPromotion
    ? computePromotionPriceFromPercent(maxPrice, discountPercent)
    : null;

  return {
    minPrice,
    maxPrice,
    isPromotion,
    discountPercent: isPromotion ? discountPercent : 0,
    discountLabel: isPromotion ? `−${discountPercent}%` : "",
    promotionMinPrice: isPromotion ? promotionMinPrice : null,
    promotionMaxPrice: isPromotion ? promotionMaxPrice : null,
    priceLabel: formatAdminPriceRange(minPrice, maxPrice),
    promotionPriceLabel:
      isPromotion && promotionMinPrice != null
        ? formatAdminPriceRange(promotionMinPrice, promotionMaxPrice ?? promotionMinPrice)
        : "",
  };
}

/** Giá đơn vị sau KM (áp % giảm lên giá biến thể). */
function getPromotionalUnitPrice(product, variantPrice, now = new Date()) {
  const base = Number(variantPrice) || 0;
  if (!isPromotionActiveNow(product, now) || base <= 0) {
    return base;
  }
  const percent = Number(product.DiscountPercent) || 0;
  if (percent > 0) {
    return Math.max(0, Math.round(base * (1 - percent / 100)));
  }
  return base;
}

function clearPromotionFields(product) {
  product.IsPromotion = false;
  product.DiscountPercent = 0;
  product.PromotionStartDate = null;
  product.PromotionEndDate = null;
}

/**
 * Chuẩn hóa payload KM.
 * Ưu tiên discountPercent (%); vẫn nhận promotionPrice cũ để suy ra % (không lưu PromotionPrice).
 */
function normalizePromotionPayload(payload = {}, fallbackOriginal = 0) {
  const enabled = Boolean(
    payload.isPromotion ?? payload.IsPromotion ?? payload.promotionEnabled
  );

  if (!enabled) {
    return {
      isPromotion: false,
      originalPrice: Math.max(0, Number(fallbackOriginal) || 0),
      promotionPrice: null,
      discountPercent: 0,
      promotionStartDate: null,
      promotionEndDate: null,
    };
  }

  const originalPrice =
    pickNumber(payload.originalPrice ?? payload.OriginalPrice) ??
    Math.max(0, Number(fallbackOriginal) || 0);

  if (!originalPrice || originalPrice <= 0) {
    throw createServiceError("Giá gốc khuyến mãi không hợp lệ.");
  }

  let discountPercent = pickNumber(
    payload.discountPercent ?? payload.DiscountPercent ?? payload.percent
  );
  let promotionPrice = pickNumber(
    payload.promotionPrice ?? payload.PromotionPrice
  );

  // Nguồn chính: % giảm.
  if (discountPercent != null) {
    discountPercent = Math.round(discountPercent);
    if (discountPercent < 1 || discountPercent > 99) {
      throw createServiceError("Phần trăm giảm giá phải từ 1 đến 99.");
    }
    promotionPrice = computePromotionPriceFromPercent(originalPrice, discountPercent);
  } else if (promotionPrice != null) {
    // Legacy: nhập giá KM → suy ra %.
    if (promotionPrice < 0) {
      throw createServiceError("Giá khuyến mãi không hợp lệ.");
    }
    if (promotionPrice >= originalPrice) {
      throw createServiceError("Giá khuyến mãi phải nhỏ hơn giá gốc.");
    }
    discountPercent = computeDiscountPercent(originalPrice, promotionPrice);
    if (discountPercent < 1) {
      throw createServiceError("Mức giảm quá nhỏ (cần ít nhất 1%).");
    }
    promotionPrice = computePromotionPriceFromPercent(originalPrice, discountPercent);
  } else {
    throw createServiceError("Vui lòng nhập phần trăm giảm giá.");
  }

  const startRaw = payload.promotionStartDate ?? payload.PromotionStartDate;
  const endRaw = payload.promotionEndDate ?? payload.PromotionEndDate;
  const promotionStartDate = startRaw ? new Date(startRaw) : new Date();
  const promotionEndDate = endRaw ? new Date(endRaw) : null;

  if (Number.isNaN(promotionStartDate.getTime())) {
    throw createServiceError("Ngày bắt đầu khuyến mãi không hợp lệ.");
  }
  if (promotionEndDate && Number.isNaN(promotionEndDate.getTime())) {
    throw createServiceError("Ngày kết thúc khuyến mãi không hợp lệ.");
  }
  if (
    promotionEndDate &&
    promotionStartDate &&
    promotionEndDate.getTime() < promotionStartDate.getTime()
  ) {
    throw createServiceError("Ngày kết thúc phải sau ngày bắt đầu.");
  }

  return {
    isPromotion: true,
    originalPrice,
    promotionPrice,
    discountPercent,
    promotionStartDate,
    promotionEndDate,
  };
}

function applyPromotionToProduct(product, normalized) {
  product.IsPromotion = normalized.isPromotion;
  if (!normalized.isPromotion) {
    clearPromotionFields(product);
    return product;
  }
  product.DiscountPercent = normalized.discountPercent;
  product.PromotionStartDate = normalized.promotionStartDate;
  product.PromotionEndDate = normalized.promotionEndDate;
  return product;
}

function attachPromotionDto(dto, product, now = new Date()) {
  const active = isPromotionActiveNow(product, now);
  const originalMin =
    Number(dto.minPrice) || Number(product.MinPrice ?? product.minPrice) || Number(dto.maxPrice) || 0;
  const originalMax =
    Number(dto.maxPrice) || Number(product.MaxPrice ?? product.maxPrice) || originalMin;
  const discountPercent = active
    ? Number(product.DiscountPercent ?? product.discountPercent) || 0
    : 0;
  let promotionMinPrice = null;
  let promotionMaxPrice = null;
  if (active && discountPercent > 0) {
    promotionMinPrice = computePromotionPriceFromPercent(originalMin, discountPercent);
    promotionMaxPrice = computePromotionPriceFromPercent(originalMax, discountPercent);
  }

  return {
    ...dto,
    originalPrice: originalMin,
    originalMaxPrice: originalMax,
    isPromotion: active && discountPercent > 0,
    promotionPrice: active ? promotionMinPrice : null,
    promotionMinPrice: active ? promotionMinPrice : null,
    promotionMaxPrice: active ? promotionMaxPrice : null,
    discountPercent: active && discountPercent > 0 ? discountPercent : 0,
    promotionStartDate: product.PromotionStartDate ?? product.promotionStartDate ?? null,
    promotionEndDate: product.PromotionEndDate ?? product.promotionEndDate ?? null,
    displayPrice: active && promotionMinPrice != null ? promotionMinPrice : dto.minPrice,
    price: active && promotionMinPrice != null ? promotionMinPrice : dto.minPrice,
  };
}

async function enrichProductsWithPromotion(products) {
  const {
    toPublicProduct,
    loadProductImagesByProductIds,
  } = require("./productService");
  const now = new Date();
  const ids = products.map((p) => p._id || p.id).filter(Boolean);
  const [variants, imagesByProduct] = await Promise.all([
    ProductVariant.find({ ProductId: { $in: ids } }).sort({ CreatedAt: 1 }),
    loadProductImagesByProductIds(ids),
  ]);
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map[key]) map[key] = [];
    map[key].push(variant);
    return map;
  }, {});

  return products.map((product) => {
    const dto = toPublicProduct(
      product,
      variantsByProduct[String(product._id)] || [],
      null,
      imagesByProduct.get(String(product._id)) || []
    );
    return attachPromotionDto(dto, product, now);
  });
}

async function expireDuePromotions({ limit = 300 } = {}) {
  const now = new Date();
  const due = await Product.find({
    IsPromotion: true,
    PromotionEndDate: { $ne: null, $lt: now },
  })
    .limit(limit)
    .select("_id");

  if (!due.length) {
    return { expired: 0 };
  }

  await Product.updateMany(
    { _id: { $in: due.map((row) => row._id) } },
    {
      $set: {
        IsPromotion: false,
        DiscountPercent: 0,
        UpdatedAt: now,
      },
    }
  );
  return { expired: due.length };
}

async function ensureProductPromotionFresh(product) {
  if (!product?.IsPromotion) {
    return product;
  }
  const now = new Date();
  if (product.PromotionEndDate && new Date(product.PromotionEndDate) < now) {
    clearPromotionFields(product);
    product.UpdatedAt = now;
    await product.save();
  }
  return product;
}

function activePromotionFilter(now = new Date()) {
  return {
    IsPromotion: true,
    Status: PRODUCT_STATUS.ACTIVE,
    ...notRemovedProductMatch(),
    $and: [
      {
        $or: [
          { PromotionStartDate: null },
          { PromotionStartDate: { $lte: now } },
        ],
      },
      {
        $or: [{ PromotionEndDate: null }, { PromotionEndDate: { $gte: now } }],
      },
    ],
  };
}

async function listActivePromotions({
  page = 1,
  limit = 20,
  latitude,
  longitude,
  seed = "",
} = {}) {
  await expireDuePromotions({ limit: 100 });
  const now = new Date();
  const { page: safePage, limit: safeLimit, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 20, maxLimit: 80 }
  );

  const filter = activePromotionFilter(now);
  const total = await Product.countDocuments(filter);
  const consumed = (safePage - 1) * safeLimit;
  const take = Math.min(safeLimit, Math.max(0, total - consumed));
  const stableSort = { DiscountPercent: -1, UpdatedAt: -1, _id: -1 };
  let rows = [];

  if (take > 0) {
    const randomStart = normalizeRandomSeed(seed)
      ? (seededOffset(seed, total, "home-promotions") + consumed) % total
      : skip;
    const firstTake = Math.min(take, total - randomStart);
    rows = await Product.find(filter)
      .sort(stableSort)
      .skip(randomStart)
      .limit(firstTake)
      .lean();

    const remaining = take - rows.length;
    if (remaining > 0) {
      const wrapped = await Product.find(filter)
        .sort(stableSort)
        .limit(remaining)
        .lean();
      rows = rows.concat(wrapped);
    }
  }

  const shopIds = rows.map((row) => row.ShopId).filter(Boolean);
  const shops = shopIds.length
    ? await ShopProfile.find({
        _id: { $in: shopIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      }).lean()
    : [];
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));

  const visible = rows.filter((row) => {
    const shop = shopById.get(String(row.ShopId));
    return shop && isSubscriptionActive(shop);
  });

  const User = require("../models/User");
  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } })
        .select("FullName UserName")
        .lean()
    : [];
  const ownerById = new Map(owners.map((owner) => [String(owner._id), owner]));

  const originLat = Number(latitude);
  const originLng = Number(longitude);
  const hasOrigin = Number.isFinite(originLat) && Number.isFinite(originLng);

  const dtos = await enrichProductsWithPromotion(visible);
  const mapped = dtos.map((dto, index) => {
    const sourceProduct = visible[index] || null;
    const shopId = String(
      sourceProduct?.ShopId || dto.shopId || dto.store_id || ""
    ).trim();
    const shop = shopId ? shopById.get(shopId) : null;
    const owner = shop ? ownerById.get(String(shop.userId)) : null;
    const storeName = resolveShopDisplayName(shop, owner);

    let distanceMeters = null;
    const shopCoords = resolveShopLatlong(shop);
    if (hasOrigin && shop && hasShopLatlong(shop)) {
      const meters = calculateDistanceMeters(
        originLat,
        originLng,
        shopCoords.lat,
        shopCoords.long
      );
      if (meters != null && Number.isFinite(meters)) {
        distanceMeters = Math.round(meters);
      }
    }

    return {
      ...dto,
      id: String(dto.id || sourceProduct?._id || ""),
      shopId,
      store_id: shopId,
      storeName,
      distanceMeters,
      shopLatitude: shopCoords.lat,
      shopLongitude: shopCoords.long,
    };
  });

  if (hasOrigin) {
    mapped.sort((left, right) => {
      const leftDistance = Number(left.distanceMeters);
      const rightDistance = Number(right.distanceMeters);
      const leftRank = Number.isFinite(leftDistance) ? leftDistance : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isFinite(rightDistance) ? rightDistance : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return (Number(right.discountPercent) || 0) - (Number(left.discountPercent) || 0);
    });
  }

  return {
    items: mapped,
    products: mapped,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function listShopPromotions(shopId, { limit = 80 } = {}) {
  await expireDuePromotions({ limit: 50 });
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop || Number(shop.status) === SHOP_STATUS.BLOCKED || !isSubscriptionActive(shop)) {
    return [];
  }

  const now = new Date();
  const rows = await Product.find({
    ShopId: shopId,
    ...activePromotionFilter(now),
  })
    .sort({ DiscountPercent: -1, UpdatedAt: -1 })
    .limit(Math.min(100, Number(limit) || 80))
    .lean();

  return enrichProductsWithPromotion(rows);
}

/** Danh sách SP đang KM của shop seller đang đăng nhập. */
async function listMyShopPromotions(user, { limit = 100 } = {}) {
  const shop = await ShopProfile.findOne({ userId: user._id });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng.", 404);
  }
  return listShopPromotions(shop._id, { limit });
}

async function setProductPromotion(user, productId, payload = {}) {
  const ProductModel = Product;
  const shop = await ShopProfile.findOne({ userId: user._id });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng.", 404);
  }

  const product = await ProductModel.findOne({ _id: productId, ShopId: shop._id });
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const { assertCanManageProducts } = require("./sellerPlanAccessService");
  await assertCanManageProducts(shop);

  const fallbackOriginal = Number(product.MinPrice) || 0;
  const normalized = normalizePromotionPayload(payload, fallbackOriginal);
  applyPromotionToProduct(product, normalized);
  product.UpdatedAt = new Date();
  await product.save();

  const { toPublicProduct, loadProductImages } = require("./productService");
  const imageDocs = await loadProductImages(product._id);
  const variants = await ProductVariant.find({ ProductId: product._id }).sort({
    CreatedAt: 1,
  });
  const dto = toPublicProduct(product, variants, null, imageDocs);
  return attachPromotionDto(dto, product);
}

async function clearProductPromotion(user, productId) {
  return setProductPromotion(user, productId, { isPromotion: false });
}

/**
 * Giảm giá hàng loạt — cập nhật thẳng Product (không tạo collection mới).
 * Payload: { productIds[], discountPercent, promotionStartDate?, promotionEndDate? }
 */
async function bulkSetProductPromotions(user, payload = {}) {
  const shop = await ShopProfile.findOne({ userId: user._id });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng.", 404);
  }

  const { assertCanManageProducts } = require("./sellerPlanAccessService");
  await assertCanManageProducts(shop);

  const productIds = Array.isArray(payload.productIds)
    ? payload.productIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (!productIds.length) {
    throw createServiceError("Vui lòng chọn ít nhất một sản phẩm.");
  }
  if (productIds.length > 100) {
    throw createServiceError("Mỗi lần tối đa 100 sản phẩm.");
  }

  const discountPercent = Math.round(
    Number(payload.discountPercent ?? payload.DiscountPercent ?? payload.percent)
  );
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 99) {
    throw createServiceError("Phần trăm giảm giá phải từ 1 đến 99.");
  }

  const startRaw = payload.promotionStartDate ?? payload.PromotionStartDate ?? payload.startDate;
  const endRaw = payload.promotionEndDate ?? payload.PromotionEndDate ?? payload.endDate;
  const promotionStartDate = startRaw ? new Date(startRaw) : new Date();
  const promotionEndDate = endRaw ? new Date(endRaw) : null;

  if (Number.isNaN(promotionStartDate.getTime())) {
    throw createServiceError("Ngày bắt đầu không hợp lệ.");
  }
  if (promotionEndDate && Number.isNaN(promotionEndDate.getTime())) {
    throw createServiceError("Ngày kết thúc không hợp lệ.");
  }
  if (
    promotionEndDate &&
    promotionEndDate.getTime() < promotionStartDate.getTime()
  ) {
    throw createServiceError("Ngày kết thúc phải sau ngày bắt đầu.");
  }

  const products = await Product.find({
    _id: { $in: productIds },
    ShopId: shop._id,
  });

  if (!products.length) {
    throw createServiceError("Không tìm thấy sản phẩm thuộc gian hàng của bạn.", 404);
  }

  const now = new Date();
  const updated = [];

  for (const product of products) {
    const originalPrice = Number(product.MinPrice) || 0;
    if (originalPrice <= 0) {
      continue;
    }
    const normalized = normalizePromotionPayload(
      {
        isPromotion: true,
        originalPrice,
        discountPercent,
        promotionStartDate,
        promotionEndDate,
      },
      originalPrice
    );
    applyPromotionToProduct(product, normalized);
    product.UpdatedAt = now;
    await product.save();
    updated.push(String(product._id));
  }

  const refreshed = await Product.find({
    _id: { $in: updated },
    ShopId: shop._id,
  }).lean();

  return {
    updatedCount: updated.length,
    productIds: updated,
    products: await enrichProductsWithPromotion(refreshed),
  };
}

module.exports = {
  computeDiscountPercent,
  computePromotionPriceFromPercent,
  normalizePromotionPayload,
  applyPromotionToProduct,
  attachPromotionDto,
  isPromotionActiveNow,
  buildAdminProductPriceFields,
  getPromotionalUnitPrice,
  expireDuePromotions,
  ensureProductPromotionFresh,
  listActivePromotions,
  listShopPromotions,
  listMyShopPromotions,
  setProductPromotion,
  clearProductPromotion,
  bulkSetProductPromotions,
  activePromotionFilter,
};
