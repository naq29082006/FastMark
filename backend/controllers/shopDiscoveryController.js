const shopDiscoveryService = require("../services/shopDiscoveryService");
const { success } = require("../utils/apiResponse");

exports.listNearbyShops = async (req, res) => {
  const latitude = req.query.lat ?? req.query.latitude;
  const longitude = req.query.lng ?? req.query.longitude;
  const radiusMeters = req.query.radius ?? req.query.radiusMeters ?? 2000;
  const page = req.query.page ?? 1;
  const limit = req.query.limit ?? 20;

  const result = await shopDiscoveryService.listNearbyShops({
    latitude,
    longitude,
    radiusMeters,
    page,
    limit,
    seed: req.query.seed,
  });

  return success(res, {
    data: {
      shops: result.shops || result.items || [],
      items: result.items || result.shops || [],
      count: (result.shops || result.items || []).length,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    },
  });
};

exports.listNearbyShopsForMap = async (req, res) => {
  const latitude = req.query.lat ?? req.query.latitude;
  const longitude = req.query.lng ?? req.query.longitude;
  const radiusMeters = req.query.radius ?? req.query.radiusMeters ?? 2000;
  const shopCategoryId = req.query.shopCategoryId ?? req.query.shop_category_id ?? "";
  const limit = req.query.limit ?? 500;

  const result = await shopDiscoveryService.listNearbyShopsForMap({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
    limit,
  });

  return success(res, {
    data: {
      shops: result.shops || result.items || [],
      items: result.items || result.shops || [],
      count: result.count ?? (result.shops || result.items || []).length,
      total: result.total ?? (result.shops || result.items || []).length,
      truncated: Boolean(result.truncated),
    },
  });
};

exports.searchShops = async (req, res) => {
  const latitude = req.query.lat ?? req.query.latitude;
  const longitude = req.query.lng ?? req.query.longitude;
  const radiusMeters = req.query.radius ?? req.query.radiusMeters ?? 2000;
  const page = req.query.page ?? 1;
  const limit = req.query.limit ?? 20;
  const q = req.query.q ?? req.query.shop ?? req.query.shopName ?? "";
  const shopCategoryId = req.query.shopCategoryId ?? req.query.shop_category_id ?? "";
  const productCategoryId =
    req.query.productCategoryId ?? req.query.product_category_id ?? req.query.categoryId ?? "";
  const productQuery = req.query.product ?? req.query.productQuery ?? req.query.productName ?? "";
  const identityOnlyRaw =
    req.query.identityOnly ?? req.query.identity_only ?? req.query.matchShop ?? "";
  const identityOnly = ["1", "true", "yes", "shop"].includes(
    String(identityOnlyRaw || "").trim().toLowerCase()
  );

  const result = await shopDiscoveryService.searchShops({
    latitude,
    longitude,
    radiusMeters,
    page,
    limit,
    q,
    shopCategoryId,
    productCategoryId,
    productQuery,
    identityOnly,
  });

  return success(res, {
    data: {
      shops: result.shops || result.items || [],
      items: result.items || result.shops || [],
      count: (result.shops || result.items || []).length,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
      radius_meters: shopDiscoveryService.isUnlimitedRadius(radiusMeters)
        ? null
        : Math.min(
            Math.max(Number(radiusMeters) || 2000, 100),
            shopDiscoveryService.MAX_SEARCH_RADIUS_METERS
          ),
    },
  });
};

exports.listShopCategories = async (req, res) => {
  const shopCategoryService = require("../services/shopCategoryService");
  const categories = await shopCategoryService.listCategories();

  return success(res, {
    data: { categories },
  });
};

exports.getShop = async (req, res) => {
  const shop = await shopDiscoveryService.getPublicShopById(req.params.id, {
    latitude: req.query.lat ?? req.query.latitude,
    longitude: req.query.lng ?? req.query.longitude,
  });

  return success(res, {
    data: {
      shop,
    },
  });
};

exports.listShopProducts = async (req, res) => {
  const data = await shopDiscoveryService.listPublicProductsByShopId(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
  });

  return success(res, { data });
};

exports.listShopReviews = async (req, res) => {
  const data = await shopDiscoveryService.listPublicReviewsByShopId(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
    productId: req.query.productId,
  });

  return success(res, { data });
};
