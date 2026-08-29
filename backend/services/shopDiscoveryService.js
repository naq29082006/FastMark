const mongoose = require("mongoose");
const ShopProfile = require("../models/ShopProfile");
const { getShopCategoryNameMap } = require("./shopCategoryService");
const User = require("../models/User");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const {
  loadProductImagesByProductIds,
  toPublicProductImages,
} = require("./productService");
const Review = require("../models/Review");
const { USER_ROLE } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const {
  isSubscriptionActive,
  activeSubscriptionFilter,
} = require("../constants");
const { publicReviewFilter } = require("../utils/reviewVisibility");
const {
  normalizeSearchText,
  normalizeSearchKeyword,
  matchesTokenSearch,
  matchesTokenSearchAny,
} = require("../utils/searchText");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const {
  buildPaginationMeta,
  parsePagination,
  sliceSeededPage,
} = require("../utils/pagination");
const { resolveShopLatlong, hasShopLatlong, shopHasCoordinatesFilter, buildBoundingBoxFilter } = require("../utils/shopCoordinates");
const { ensureSubscriptionFresh } = require("./sellerPlanAccessService");

const EARTH_RADIUS_METERS = 6371000;
const MAX_SEARCH_RADIUS_METERS = 30000;

function isUnlimitedRadius(radiusMeters) {
  const raw = String(radiusMeters ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return false;
  }
  if (raw === "all" || raw === "unlimited" || raw === "inf" || raw === "infinity") {
    return true;
  }
  const value = Number(radiusMeters);
  return value === 0 || value === -1;
}

function clampSearchRadius(radiusMeters, fallback = 2000) {
  return Math.min(Math.max(Number(radiusMeters) || fallback, 100), MAX_SEARCH_RADIUS_METERS);
}

/** Returns finite radius meters, or null when search should include all distances. */
function resolveSearchRadius(radiusMeters, fallback = 2000) {
  if (isUnlimitedRadius(radiusMeters)) {
    return null;
  }
  return clampSearchRadius(radiusMeters, fallback);
}

function computeIsOutOfStock(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return false;
  }

  return computeRemainingQuantity(variants) <= 0;
}

function computeRemainingQuantity(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return 0;
  }

  return variants.reduce(
    (sum, variant) => sum + Math.max(0, Number(variant.Quantity ?? variant.quantity ?? 0)),
    0
  );
}

function toListVariants(variants = []) {
  return variants.map((variant) => ({
    id: String(variant._id || variant.id || ""),
    quantity: Math.max(0, Number(variant.Quantity ?? variant.quantity ?? 0)),
  }));
}

function resolveProductGallery(product, imageDocs = []) {
  const fromImages = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  if (fromImages.length > 0) {
    return fromImages;
  }
  if (Array.isArray(product.Thumbnail)) {
    return product.Thumbnail.filter(Boolean);
  }
  return product.Thumbnail ? [product.Thumbnail] : [];
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function activeProductFilter(extra = {}) {
  const { publicProductFilter } = require("./productService");
  return publicProductFilter(extra);
}

/** Đồng bộ isActive từ gói bán trước khi trả shop/sản phẩm công khai. */
async function resolvePublicShop(shopId) {
  const shopDoc = await ShopProfile.findById(shopId);
  if (!shopDoc) {
    return null;
  }
  await ensureSubscriptionFresh(shopDoc);
  if (!isSubscriptionActive(shopDoc)) {
    return null;
  }
  return shopDoc.toObject();
}

function textMatchesKeyword(haystackValue, keyword) {
  return matchesTokenSearch(haystackValue, keyword);
}

function shopMatchesKeyword(shop, seller, keyword) {
  if (!keyword) {
    return true;
  }

  return matchesTokenSearchAny(
    [
      shop.shopName,
      shop.shopUsername,
      shop.description,
      shop.addressHeThong,
      shop.address,
      seller?.FullName,
      seller?.UserName,
    ],
    keyword
  );
}

function shopMatchesNameOrUsername(shop, seller, keyword) {
  if (!keyword) {
    return true;
  }

  return matchesTokenSearchAny(
    [seller?.FullName, seller?.UserName, shop.shopName, shop.shopUsername],
    keyword
  );
}

async function findProductMatchesByShopId(keyword, categoryId = "") {
  const productKeyword = normalizeSearchText(keyword);
  const normalizedCategoryId = String(categoryId || "").trim();

  if (!productKeyword && !normalizedCategoryId) {
    return null;
  }

  const productFilter = activeProductFilter();
  if (normalizedCategoryId) {
    productFilter.CategoryId = normalizedCategoryId;
  }

  const matchingProducts = await Product.find(productFilter)
    .select("ShopId ProductName CategoryId")
    .lean();

  const productMatchesByShopId = new Map();
  for (const product of matchingProducts) {
    if (productKeyword && !textMatchesKeyword(product.ProductName, productKeyword)) {
      continue;
    }
    const shopId = String(product.ShopId);
    if (!productMatchesByShopId.has(shopId)) {
      productMatchesByShopId.set(shopId, []);
    }
    const bucket = productMatchesByShopId.get(shopId);
    if (bucket.length < 5) {
      bucket.push(product.ProductName || "");
    }
  }

  return productMatchesByShopId;
}

function mergeProductMatches(...maps) {
  const merged = new Map();

  maps.forEach((map) => {
    if (!map) {
      return;
    }

    map.forEach((products, shopId) => {
      if (!merged.has(shopId)) {
        merged.set(shopId, []);
      }
      const bucket = merged.get(shopId);
      products.forEach((name) => {
        if (name && bucket.length < 5 && !bucket.includes(name)) {
          bucket.push(name);
        }
      });
    });
  });

  return merged.size > 0 ? merged : null;
}

function pickShopText(shop, ...keys) {
  for (const key of keys) {
    const value = shop?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickString(value) {
  return String(value || "").trim();
}

function resolveShopCategory(categoryMap, categoryId) {
  const entry = categoryMap.get(String(categoryId));
  if (!entry) {
    return { name: "" };
  }
  if (typeof entry === "string") {
    return { name: entry };
  }
  return {
    name: entry.name || "",
  };
}

const MAP_SHOP_SELECT =
  "userId shopName shopUsername avatar latlong latitude longitude addressHeThong address description categoryId isOpen openTime closeTime tongSP soNguoiTheo diemTB tongDG soldCount status cocTien";

const NEARBY_SHOP_SELECT = MAP_SHOP_SELECT;

async function collectShopsNearLocation({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopCategoryId = "",
  select = NEARBY_SHOP_SELECT,
  shopFilterExtra = {},
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = resolveSearchRadius(radiusMeters, 2000);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const andFilters = [shopHasCoordinatesFilter(), shopFilterExtra];
  const normalizedCategoryId = String(shopCategoryId || "").trim();
  if (normalizedCategoryId) {
    andFilters.push({ categoryId: normalizedCategoryId });
  }
  if (radius != null) {
    andFilters.push(buildBoundingBoxFilter(lat, lng, radius));
  }

  const shops = await ShopProfile.find({
    $and: andFilters,
    status: { $ne: 0 },
    ...activeSubscriptionFilter(),
  })
    .select(select)
    .lean();

  const sellerIds = [
    ...new Set(
      shops
        .map((shop) => shop.userId)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];
  const sellers = sellerIds.length
    ? await User.find({
        _id: { $in: sellerIds.map((id) => new mongoose.Types.ObjectId(id)) },
        Role: USER_ROLE.SELLER,
      })
        .select("FullName UserName Role")
        .lean()
    : [];
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));

  const rows = [];
  for (const shop of shops) {
    if (!hasShopLatlong(shop)) {
      continue;
    }

    const seller = sellerMap.get(String(shop.userId));
    if (!seller) {
      continue;
    }

    const coords = resolveShopLatlong(shop);
    const distanceMeters = calculateDistanceMeters(lat, lng, coords.lat, coords.long);
    if (radius != null && distanceMeters > radius) {
      continue;
    }

    rows.push({ shop, seller, distanceMeters });
  }

  rows.sort((left, right) => {
    if (left.distanceMeters !== right.distanceMeters) {
      return left.distanceMeters - right.distanceMeters;
    }
    return String(left.shop._id).localeCompare(String(right.shop._id));
  });

  return { rows, lat, lng, radius };
}

function toPublicStore(
  shop,
  user,
  productCount,
  distanceMeters,
  categoryName = "",
  followCount = 0,
  totalLikes = 0
) {
  // Tên / @ lấy từ ShopProfile (fallback User cho shop cũ).
  const ownerName = pickString(user?.FullName) || pickString(user?.UserName) || "";
  const ownerUsername = pickString(user?.UserName) || "";
  const shopDisplayName = resolveShopDisplayName(shop, user);
  const shopUsername = resolveShopUsername(shop, user);
  const shopAvatar = resolveShopAvatar(shop, user);

  const systemAddress = pickShopText(
    shop,
    "addressHeThong",
    "DiaChiHeThong",
    "DiachiHethong",
    "systemAddress",
    "system_address"
  );
  const openTime = pickShopText(shop, "openTime", "open_time");
  const closeTime = pickShopText(shop, "closeTime", "close_time");
  const showHours = Boolean(openTime && closeTime);
  const coords = resolveShopLatlong(shop);
  const ownerFollowers = Number(followCount) || Number(shop.soNguoiTheo) || 0;
  const depositPercent = Math.max(
    0,
    Math.min(100, Number(shop.cocTien ?? shop.depositPercent) || 0)
  );

  return {
    id: String(shop._id),
    name: shopDisplayName,
    shop_name: shopDisplayName,
    shopName: shopDisplayName,
    shop_username: shopUsername,
    shopUsername,
    fullName: shopDisplayName,
    userName: shopUsername,
    categoryId: shop.categoryId ? String(shop.categoryId) : "",
    categoryName,
    type: "shop",
    latlong: coords,
    latitude: coords.lat,
    longitude: coords.long,
    address: systemAddress || pickShopText(shop, "address"),
    system_address: systemAddress,
    systemAddress,
    addressHeThong: systemAddress,
    phone: user?.Phone || "",
    zalo: user?.Phone || "",
    intro: pickShopText(shop, "description") || "",
    open_time: showHours ? openTime : "",
    openTime: showHours ? openTime : "",
    close_time: showHours ? closeTime : "",
    closeTime: showHours ? closeTime : "",
    is_open: Number(shop.isOpen) === 1,
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
    rating_avg: Number(shop.diemTB) || 0,
    review_count: Number(shop.tongDG) || 0,
    follow_count: ownerFollowers,
    product_count: Number(shop.tongSP) || Number(productCount) || 0,
    total_products: Number(shop.tongSP) || Number(productCount) || 0,
    sold_count: Number(shop.soldCount) || 0,
    total_likes: Number(totalLikes) || 0,
    owner_user_id: shop.userId ? String(shop.userId) : "",
    ownerUserId: shop.userId ? String(shop.userId) : "",
    image_url: shopAvatar,
    cover_image_url: shopAvatar,
    shopAvatar,
    avatar: shopAvatar,
    distance_meters: Math.round(distanceMeters),
    is_registered_shop: true,
    depositPercent,
    cocTien: depositPercent,
    subscriptionActive: true,
  };
}

async function listNearbyShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  page = 1,
  limit = 20,
  seed = "",
}) {
  const { page: safePage, limit: safeLimit } = parsePagination(
    { page, limit },
    { defaultLimit: 20, maxLimit: 100 }
  );

  const { rows } = await collectShopsNearLocation({
    latitude,
    longitude,
    radiusMeters,
  });

  const seededPage = sliceSeededPage(rows, {
    page: safePage,
    limit: safeLimit,
    seed,
    namespace: "home-nearby-shops",
  });
  const total = seededPage.total;
  const pageRows = seededPage.items;

  const pageShopIds = pageRows.map((row) => row.shop._id);
  const productCounts = pageShopIds.length
    ? await Product.aggregate([
        { $match: activeProductFilter({ ShopId: { $in: pageShopIds } }) },
        { $group: { _id: "$ShopId", count: { $sum: 1 } } },
      ])
    : [];
  const productCountMap = new Map(
    productCounts.map((row) => [String(row._id), Number(row.count) || 0])
  );
  const categoryNameMap = await getShopCategoryNameMap(
    pageRows.map(({ shop }) => shop.categoryId)
  );

  const items = pageRows.map(({ shop, seller, distanceMeters }) => {
    const category = resolveShopCategory(categoryNameMap, shop.categoryId);
    const productCount =
      productCountMap.get(String(shop._id)) ?? (Number(shop.tongSP) || 0);
    return toPublicStore(shop, seller, productCount, distanceMeters, category.name, 0, 0);
  });

  return {
    items,
    shops: items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function listNearbyShopsForMap({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopCategoryId = "",
  limit = 500,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 50), 2000);

  const { rows } = await collectShopsNearLocation({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
    select: MAP_SHOP_SELECT,
  });

  const total = rows.length;
  const pageRows = rows.slice(0, safeLimit);
  const categoryNameMap = await getShopCategoryNameMap(
    pageRows.map(({ shop }) => shop.categoryId)
  );

  const items = pageRows.map(({ shop, seller, distanceMeters }) => {
    const category = resolveShopCategory(categoryNameMap, shop.categoryId);
    const productCount = Number(shop.tongSP) || 0;
    return toPublicStore(shop, seller, productCount, distanceMeters, category.name, 0, 0);
  });

  return {
    items,
    shops: items,
    total,
    count: items.length,
    truncated: total > items.length,
  };
}

async function searchShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  page = 1,
  limit = 20,
  q = "",
  shopCategoryId = "",
  productCategoryId = "",
  productQuery = "",
  identityOnly = false,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = resolveSearchRadius(radiusMeters, 2000);
  const { page: safePage, limit: safeLimit, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 20, maxLimit: 200 }
  );
  const shopKeyword = normalizeSearchText(String(q || "").replace(/^@+/, ""));
  const productKeyword = identityOnly ? "" : normalizeSearchText(productQuery);
  const normalizedShopCategoryId = String(shopCategoryId || "").trim();
  const normalizedProductCategoryId = identityOnly
    ? ""
    : String(productCategoryId || "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ để tìm theo khoảng cách.");
    error.statusCode = 400;
    throw error;
  }

  const { rows: candidateRows } = await collectShopsNearLocation({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId: normalizedShopCategoryId,
  });

  let productMatchesByShopId = null;
  if (!identityOnly && (productKeyword || normalizedProductCategoryId)) {
    const [productMatchesFromProductQuery, productMatchesFromShopQuery] = await Promise.all([
      findProductMatchesByShopId(productKeyword, normalizedProductCategoryId),
      shopKeyword && !productKeyword
        ? findProductMatchesByShopId(shopKeyword, "")
        : Promise.resolve(null),
    ]);

    productMatchesByShopId = mergeProductMatches(
      productMatchesFromProductQuery,
      productMatchesFromShopQuery
    );
  }

  const results = [];

  for (const { shop, seller, distanceMeters } of candidateRows) {
    if (identityOnly) {
      if (shopKeyword && !shopMatchesNameOrUsername(shop, seller, shopKeyword)) {
        continue;
      }
      results.push({
        shop,
        seller,
        distanceMeters,
        matchedProducts: [],
      });
      continue;
    }

    const matchedProducts = productMatchesByShopId?.get(String(shop._id)) || [];
    const matchesShopName = shopMatchesKeyword(shop, seller, shopKeyword);
    const matchesProductName = matchedProducts.length > 0;

    if (shopKeyword) {
      if (productKeyword) {
        if (!matchesShopName) {
          continue;
        }
        if (!matchesProductName) {
          continue;
        }
      } else if (!matchesShopName && !matchesProductName) {
        continue;
      }
    } else if (productKeyword && !matchesProductName) {
      continue;
    } else if (normalizedProductCategoryId && !matchesProductName) {
      continue;
    }

    results.push({
      shop,
      seller,
      distanceMeters,
      matchedProducts,
    });
  }

  results.sort((left, right) => {
    if (left.distanceMeters !== right.distanceMeters) {
      return left.distanceMeters - right.distanceMeters;
    }
    return (left.shop.shopName || "").localeCompare(right.shop.shopName || "", "vi");
  });

  const total = results.length;
  const sliced = results.slice(skip, skip + safeLimit);
  const categoryNameMap = await getShopCategoryNameMap(
    sliced.map(({ shop }) => shop.categoryId)
  );
  const pageShopIds = sliced.map(({ shop }) => shop._id);
  const productCountRows = pageShopIds.length
    ? await Product.aggregate([
        { $match: activeProductFilter({ ShopId: { $in: pageShopIds } }) },
        { $group: { _id: "$ShopId", count: { $sum: 1 } } },
      ])
    : [];
  const productCountMap = new Map(
    productCountRows.map((row) => [String(row._id), Number(row.count) || 0])
  );

  const items = sliced.map(({ shop, seller, distanceMeters, matchedProducts }) => {
    const category = resolveShopCategory(categoryNameMap, shop.categoryId);
    const store = toPublicStore(
      shop,
      seller,
      productCountMap.get(String(shop._id)) || Number(shop.tongSP) || 0,
      distanceMeters,
      category.name,
      0,
      0
    );
    return {
      ...store,
      matched_products: matchedProducts,
      match_score: Math.round(distanceMeters),
    };
  });

  return {
    items,
    shops: items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function getPublicShopById(shopId, { latitude, longitude } = {}) {
  const shop = await resolvePublicShop(shopId);
  if (!shop) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const seller = await User.findOne({
    _id: shop.userId,
    Role: USER_ROLE.SELLER,
  }).lean();

  if (!seller) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const { SHOP_STATUS } = require("../constants");

  // Gian hàng bị khóa — vẫn trả metadata để client hiển thị màn khóa.
  const isShopLocked = Number(shop.status) === SHOP_STATUS.BLOCKED;

  const productCount = isShopLocked
    ? 0
    : await Product.countDocuments(activeProductFilter({ ShopId: shop._id }));
  const categoryNameMap = await getShopCategoryNameMap([shop.categoryId]);
  const followCount = Number(shop.soNguoiTheo) || 0;
  const likeAgg = isShopLocked
    ? []
    : await Product.aggregate([
        { $match: activeProductFilter({ ShopId: shop._id }) },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$LikeCount", 0] } } } },
      ]);
  const totalLikes = Number(likeAgg?.[0]?.total) || 0;

  let distanceMeters = 0;
  const lat = Number(latitude);
  const lng = Number(longitude);
  const shopCoords = resolveShopLatlong(shop);
  if (Number.isFinite(lat) && Number.isFinite(lng) && hasShopLatlong(shop)) {
    distanceMeters = calculateDistanceMeters(lat, lng, shopCoords.lat, shopCoords.long);
  }

  const category = resolveShopCategory(categoryNameMap, shop.categoryId);
  const store = toPublicStore(
    shop,
    seller,
    productCount,
    distanceMeters,
    category.name,
    followCount,
    totalLikes
  );
  if (isShopLocked) {
    store.status = SHOP_STATUS.BLOCKED;
    store.isShopLocked = true;
    store.isLocked = true;
    store.product_count = 0;
    store.total_products = 0;
  }
  return store;
}

async function listPublicProductsByShopId(shopId, { page, limit } = {}) {
  const shop = await resolvePublicShop(shopId);
  if (!shop) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const { SHOP_STATUS } = require("../constants");
  if (Number(shop.status) === SHOP_STATUS.BLOCKED) {
    const { page: safePage, limit: safeLimit } = parsePagination({ page, limit });
    return {
      products: [],
      items: [],
      ...buildPaginationMeta({ page: safePage, limit: safeLimit, total: 0 }),
    };
  }

  const filter = activeProductFilter({ ShopId: shop._id });
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort({ pinProduct: -1, CreatedAt: -1, _id: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();

  const { sortProductsByPin } = require("./productService");
  const ordered = sortProductsByPin(products);

  const productIds = ordered.map((product) => product._id);
  const [variants, imagesByProduct] = await Promise.all([
    ProductVariant.find({ ProductId: { $in: productIds } }).lean(),
    loadProductImagesByProductIds(productIds),
  ]);
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(variant);
    return map;
  }, new Map());

  const { attachPromotionDto } = require("./productPromotionService");

  const items = ordered.map((product) => {
    const productVariants = variantsByProduct.get(String(product._id)) || [];
    const thumbnails = resolveProductGallery(
      product,
      imagesByProduct.get(String(product._id)) || []
    );
    const variantPrices = productVariants.map((variant) => Number(variant.Price) || 0);
    const minPrice =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : Number(product.MinPrice) || 0;
    const maxPrice =
      variantPrices.length > 0
        ? Math.max(...variantPrices)
        : Number(product.MaxPrice) || minPrice;

    const dto = {
      id: String(product._id),
      store_id: String(shop._id),
      name: product.ProductName,
      price: minPrice,
      minPrice,
      maxPrice: maxPrice || minPrice,
      pinProduct: Math.max(0, Math.min(2, Number(product.pinProduct) || 0)),
      soldCount: Number(product.SoldCount) || 0,
      likeCount: Number(product.LikeCount) || 0,
      donVi: product.DonVi || "",
      description: product.Description || "",
      image_emoji: thumbnails[0] ? "🖼️" : "🛒",
      thumbnail: thumbnails[0] || "",
      thumbnails,
      variantCount: productVariants.length,
      isOutOfStock: computeIsOutOfStock(productVariants),
      remainingQuantity: computeRemainingQuantity(productVariants),
      variants: toListVariants(productVariants),
    };
    return attachPromotionDto(dto, product);
  });

  return {
    products: items,
    items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function discoverProducts({
  latitude,
  longitude,
  radiusMeters = 5000,
  categoryId = "",
  search = "",
  page = 1,
  limit = 20,
  seed = "",
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = resolveSearchRadius(radiusMeters, 5000);
  const { page: safePage, limit: safeLimit } = parsePagination(
    { page, limit },
    { defaultLimit: 20, maxLimit: 100 }
  );
  const keyword = normalizeSearchText(search);
  const normalizedCategoryId = String(categoryId || "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const empty = {
    items: [],
    products: [],
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total: 0 }),
  };

  const shops = await ShopProfile.find({
    ...shopHasCoordinatesFilter(),
    status: { $ne: 0 },
    ...activeSubscriptionFilter(),
  })
    .select(
      "userId shopName shopUsername latlong latitude longitude addressHeThong address status"
    )
    .lean();

  const sellerIds = shops
    .map((shop) => shop.userId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  const sellers = await User.find({
    _id: { $in: sellerIds },
    Role: USER_ROLE.SELLER,
  })
    .select("FullName UserName Role")
    .lean();
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));

  const shopDistanceMap = new Map();
  const eligibleShopIds = [];

  for (const shop of shops) {
    if (!hasShopLatlong(shop)) {
      continue;
    }

    const seller = sellerMap.get(String(shop.userId));
    if (!seller) {
      continue;
    }

    const coords = resolveShopLatlong(shop);
    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      coords.lat,
      coords.long
    );

    if (radius != null && distanceMeters > radius) {
      continue;
    }

    shopDistanceMap.set(String(shop._id), {
      shop,
      distanceMeters,
    });
    eligibleShopIds.push(shop._id);
  }

  if (eligibleShopIds.length === 0) {
    return empty;
  }

  const productFilter = activeProductFilter({ ShopId: { $in: eligibleShopIds } });
  if (normalizedCategoryId) {
    productFilter.CategoryId = normalizedCategoryId;
  }

  // Lấy danh sách nhẹ để sort/filter trước, chỉ enrich trang hiện tại.
  let products = await Product.find(productFilter)
    .select(
      "ShopId ProductName CategoryId MinPrice MaxPrice SoldCount LikeCount DonVi Description Thumbnail IsPromotion PtGiam NgayKmBD NgayKmKT Status IsDeleted RemovedBy RemovedAt CreatedAt"
    )
    .lean();

  if (keyword) {
    products = products.filter((product) => textMatchesKeyword(product.ProductName, keyword));
  }

  if (products.length === 0) {
    return empty;
  }

  // Cần tồn kho để loại hết hàng — chỉ lấy quantity theo product id.
  const productIds = products.map((product) => product._id);
  const stockRows = await ProductVariant.aggregate([
    { $match: { ProductId: { $in: productIds } } },
    {
      $group: {
        _id: "$ProductId",
        remainingQuantity: { $sum: { $ifNull: ["$Quantity", 0] } },
        variantCount: { $sum: 1 },
      },
    },
  ]);
  const stockMap = new Map(
    stockRows.map((row) => [
      String(row._id),
      {
        remainingQuantity: Math.max(0, Number(row.remainingQuantity) || 0),
        variantCount: Number(row.variantCount) || 0,
      },
    ])
  );

  const ranked = products
    .map((product) => {
      const stock = stockMap.get(String(product._id)) || {
        remainingQuantity: 0,
        variantCount: 0,
      };
      const isOutOfStock = stock.variantCount > 0 && stock.remainingQuantity <= 0;
      return {
        product,
        distanceMeters: shopDistanceMap.get(String(product.ShopId))?.distanceMeters ?? null,
        isOutOfStock,
      };
    })
    .filter((row) => !row.isOutOfStock)
    .sort((left, right) => {
      const leftDistance = Number(left.distanceMeters) || Number.MAX_SAFE_INTEGER;
      const rightDistance = Number(right.distanceMeters) || Number.MAX_SAFE_INTEGER;
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return String(right.product._id).localeCompare(String(left.product._id));
    });

  const seededPage = sliceSeededPage(ranked, {
    page: safePage,
    limit: safeLimit,
    seed,
    namespace: `home-discover-products:${normalizedCategoryId}:${radius ?? "all"}`,
  });
  const total = seededPage.total;
  const pageRows = seededPage.items;
  const pageProducts = pageRows.map((row) => row.product);
  const pageProductIds = pageProducts.map((product) => product._id);

  const [variants, imagesByProduct] = await Promise.all([
    pageProductIds.length
      ? ProductVariant.find({ ProductId: { $in: pageProductIds } }).lean()
      : Promise.resolve([]),
    pageProductIds.length
      ? loadProductImagesByProductIds(pageProductIds)
      : Promise.resolve(new Map()),
  ]);
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(variant);
    return map;
  }, new Map());

  const { getProductCategoryNameMap } = require("./productCategoryService");
  const { attachPromotionDto } = require("./productPromotionService");
  const categoryNameMap = await getProductCategoryNameMap(
    pageProducts.map((product) => product.CategoryId)
  );

  const items = pageProducts.map((product) => {
    const shopMeta = shopDistanceMap.get(String(product.ShopId));
    const shop = shopMeta?.shop;
    const seller = shop ? sellerMap.get(String(shop.userId)) : null;
    const storeName = resolveShopDisplayName(shop, seller);
    const productVariants = variantsByProduct.get(String(product._id)) || [];
    const thumbnails = resolveProductGallery(
      product,
      imagesByProduct.get(String(product._id)) || []
    );
    const variantPrices = productVariants.map((variant) => Number(variant.Price) || 0);
    const minPrice =
      variantPrices.length > 0 ? Math.min(...variantPrices) : Number(product.MinPrice) || 0;
    const maxPrice =
      variantPrices.length > 0 ? Math.max(...variantPrices) : Number(product.MaxPrice) || minPrice;

    return attachPromotionDto(
      {
        id: String(product._id),
        store_id: String(product.ShopId),
        name: product.ProductName,
        price: minPrice,
        minPrice,
        maxPrice: maxPrice || minPrice,
        soldCount: Number(product.SoldCount) || 0,
        likeCount: Number(product.LikeCount) || 0,
        donVi: product.DonVi || "",
        description: product.Description || "",
        image_emoji: thumbnails[0] ? "🖼️" : "🛒",
        thumbnail: thumbnails[0] || "",
        thumbnails,
        variantCount: productVariants.length,
        categoryId: String(product.CategoryId || ""),
        categoryName: categoryNameMap.get(String(product.CategoryId)) || "",
        storeName,
        location: shop?.addressHeThong || shop?.address || "",
        distanceMeters: shopMeta?.distanceMeters ?? null,
        isOutOfStock: computeIsOutOfStock(productVariants),
        remainingQuantity: computeRemainingQuantity(productVariants),
        variants: toListVariants(productVariants),
      },
      product
    );
  });

  return {
    items,
    products: items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function listPublicReviewsByShopId(shopId, { page, limit } = {}) {
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const {
    loadReviewImagesMap,
    toPublicReview,
  } = require("./buyerReviewService");

  const filter = {
    shopId,
    ...publicReviewFilter(),
  };
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ CreatedAt: -1, _id: -1 }).skip(skip).limit(safeLimit).lean(),
    Review.countDocuments(filter),
  ]);

  const imagesByReview = await loadReviewImagesMap(rows.map((row) => row._id));
  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const productIds = rows.map((row) => row.productId).filter(Boolean);
  const User = require("../models/User");
  const Product = require("../models/Product");
  const [users, products] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select("FullName UserName Avatar").lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const items = await Promise.all(
    rows.map((row) =>
      toPublicReview(row, {
        user: userById.get(String(row.userId)),
        product: productById.get(String(row.productId)),
        shop,
        images: imagesByReview.get(String(row._id)) || [],
      })
    )
  );

  return {
    reviews: items,
    items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

module.exports = {
  listNearbyShops,
  listNearbyShopsForMap,
  searchShops,
  getPublicShopById,
  MAX_SEARCH_RADIUS_METERS,
  isUnlimitedRadius,
  listPublicProductsByShopId,
  listPublicReviewsByShopId,
  discoverProducts,
};
