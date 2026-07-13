const shopDiscoveryService = require("../services/shopDiscoveryService");
const { success } = require("../utils/apiResponse");

exports.listNearbyShops = async (req, res) => {
  const latitude = req.query.lat ?? req.query.latitude;
  const longitude = req.query.lng ?? req.query.longitude;
  const radiusMeters = req.query.radius ?? req.query.radiusMeters ?? 2000;
  const limit = req.query.limit ?? 50;

  const shops = await shopDiscoveryService.listNearbyShops({
    latitude,
    longitude,
    radiusMeters,
    limit,
  });

  return success(res, {
    data: {
      shops,
      count: shops.length,
    },
  });
};

exports.searchShops = async (req, res) => {
  const latitude = req.query.lat ?? req.query.latitude;
  const longitude = req.query.lng ?? req.query.longitude;
  const radiusMeters = req.query.radius ?? req.query.radiusMeters ?? 2000;
  const limit = req.query.limit ?? 50;
  const q = req.query.q ?? req.query.shop ?? req.query.shopName ?? "";
  const shopCategoryId = req.query.shopCategoryId ?? req.query.shop_category_id ?? "";
  const productCategoryId =
    req.query.productCategoryId ?? req.query.product_category_id ?? req.query.categoryId ?? "";
  const productQuery = req.query.product ?? req.query.productQuery ?? req.query.productName ?? "";

  const shops = await shopDiscoveryService.searchShops({
    latitude,
    longitude,
    radiusMeters,
    limit,
    q,
    shopCategoryId,
    productCategoryId,
    productQuery,
  });

  return success(res, {
    data: {
      shops,
      count: shops.length,
      radius_meters: Math.min(
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
  const products = await shopDiscoveryService.listPublicProductsByShopId(req.params.id);

  return success(res, {
    data: {
      products,
    },
  });
};

exports.listShopReviews = async (req, res) => {
  const reviews = await shopDiscoveryService.listPublicReviewsByShopId(req.params.id);

  return success(res, {
    data: {
      reviews,
    },
  });
};
