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

exports.getShop = async (req, res) => {
  const shop = await shopDiscoveryService.getPublicShopById(req.params.id);

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
