const mongoose = require("mongoose");
const ShopProfile = require("../models/ShopProfile");
const { getCategoryNameMap } = require("./categoryService");
const User = require("../models/User");
const UserFollow = require("../models/UserFollow");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Review = require("../models/Review");
const { USER_ROLE } = require("../constants/sellerVerification");
const { PRODUCT_STATUS } = require("../constants/productStatus");

const EARTH_RADIUS_METERS = 6371000;

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
  return {
    ...extra,
    $or: [
      { Status: PRODUCT_STATUS.ACTIVE },
      { Status: { $exists: false }, IsDeleted: { $ne: true } },
    ],
  };
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

function toPublicStore(
  shop,
  user,
  productCount,
  distanceMeters,
  categoryName = "",
  followCount = 0
) {
  const shopDisplayName =
    shop.shopName ||
    (shop.shopUsername ? `@${shop.shopUsername}` : "") ||
    user?.FullName ||
    user?.UserName ||
    "Gian hàng Fastmark";

  const systemAddress = pickShopText(
    shop,
    "DiaChiHeThong",
    "DiachiHethong",
    "systemAddress",
    "system_address"
  );
  const openTime = pickShopText(shop, "openTime", "open_time");
  const closeTime = pickShopText(shop, "closeTime", "close_time");
  const shopUsername = pickShopText(shop, "shopUsername", "shop_username");

  return {
    id: String(shop._id),
    name: shopDisplayName,
    shop_name: shop.shopName || shopDisplayName,
    shopName: shop.shopName || shopDisplayName,
    shop_username: shopUsername,
    shopUsername,
    categoryId: shop.categoryId ? String(shop.categoryId) : "",
    categoryName,
    type: "shop",
    latitude: shop.latitude,
    longitude: shop.longitude,
    address: pickShopText(shop, "address"),
    system_address: systemAddress,
    systemAddress,
    phone: pickShopText(shop, "phone") || user?.Phone || "",
    zalo: pickShopText(shop, "phone") || user?.Phone || "",
    intro: pickShopText(shop, "description") || "",
    open_time: openTime,
    openTime,
    close_time: closeTime,
    closeTime,
    is_open: Number(shop.isOpen) === 1,
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
    rating_avg: Number(shop.averageRating) || 0,
    review_count: Number(shop.totalReviews) || 0,
    follow_count: Number(followCount) || Number(user?.FollowersCount) || 0,
    product_count: Number(shop.totalProducts) || Number(productCount) || 0,
    total_products: Number(shop.totalProducts) || Number(productCount) || 0,
    sold_count: Number(shop.soldCount) || 0,
    total_likes: Number(shop.totalLikes) || 0,
    image_url: user?.Avatar || "",
    cover_image_url: user?.AnhBia || user?.Avatar || "",
    distance_meters: Math.round(distanceMeters),
    is_registered_shop: true,
  };
}

async function listNearbyShops({ latitude, longitude, radiusMeters = 2000, limit = 50 }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = Math.min(Math.max(Number(radiusMeters) || 2000, 100), 20000);
  const maxResults = Math.min(Math.max(Number(limit) || 50, 1), 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const shops = await ShopProfile.find({
    latitude: { $ne: null },
    longitude: { $ne: null },
    status: { $ne: 0 },
  }).lean();

  const sellerIds = shops
    .map((shop) => shop.userId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  const sellers = await User.find({
    _id: { $in: sellerIds },
    Role: USER_ROLE.SELLER,
  }).lean();
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));
  const categoryNameMap = await getCategoryNameMap(shops.map((shop) => shop.categoryId));

  const nearby = [];

  for (const shop of shops) {
    if (!Number.isFinite(Number(shop.latitude)) || !Number.isFinite(Number(shop.longitude))) {
      continue;
    }

    const seller = sellerMap.get(String(shop.userId));
    if (!seller) {
      continue;
    }

    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      Number(shop.latitude),
      Number(shop.longitude)
    );

    if (distanceMeters > radius) {
      continue;
    }

    const productCount = await Product.countDocuments(
      activeProductFilter({ ShopId: shop._id })
    );

    nearby.push({
      shop,
      seller,
      productCount,
      distanceMeters,
    });
  }

  nearby.sort((left, right) => left.distanceMeters - right.distanceMeters);

  return nearby.slice(0, maxResults).map(({ shop, seller, productCount, distanceMeters }) =>
    toPublicStore(
      shop,
      seller,
      productCount,
      distanceMeters,
      categoryNameMap.get(String(shop.categoryId)) || ""
    )
  );
}

async function getPublicShopById(shopId) {
  const shop = await ShopProfile.findById(shopId).lean();
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

  const productCount = await Product.countDocuments(activeProductFilter({ ShopId: shop._id }));
  const categoryNameMap = await getCategoryNameMap([shop.categoryId]);
  const followCount = await UserFollow.countDocuments({ followedUserId: seller._id });

  return toPublicStore(
    shop,
    seller,
    productCount,
    0,
    categoryNameMap.get(String(shop.categoryId)) || "",
    followCount
  );
}

async function listPublicProductsByShopId(shopId) {
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const products = await Product.find(activeProductFilter({ ShopId: shop._id }))
    .sort({ CreatedAt: -1 })
    .lean();

  const productIds = products.map((product) => product._id);
  const variants = await ProductVariant.find({ ProductId: { $in: productIds } }).lean();
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(variant);
    return map;
  }, new Map());

  return products.map((product) => {
    const productVariants = variantsByProduct.get(String(product._id)) || [];
    const variantPrices = productVariants.map((variant) => Number(variant.Price) || 0);
    const minPrice =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : Number(product.MinPrice) || 0;
    const maxPrice =
      variantPrices.length > 0
        ? Math.max(...variantPrices)
        : Number(product.MaxPrice) || minPrice;

    return {
      id: String(product._id),
      store_id: String(shop._id),
      name: product.ProductName,
      price: minPrice,
      minPrice,
      maxPrice: maxPrice || minPrice,
      soldCount: Number(product.SoldCount) || 0,
      donVi: product.DonVi || "",
      description: product.Description || "",
      image_emoji: product.Thumbnail ? "🖼️" : "🛒",
      thumbnail: product.Thumbnail || "",
      variantCount: productVariants.length,
    };
  });
}

async function listPublicReviewsByShopId(shopId) {
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const rows = await Review.find({ store_id: String(shopId) })
    .sort({ created_at: -1 })
    .lean();

  return rows.map((row) => ({
    id: row.externalId || String(row._id),
    store_id: row.store_id,
    user_name: row.user_name || "Khách hàng",
    rating: row.rating,
    comment: row.comment || "",
    created_at: row.created_at || row.createdAt,
  }));
}

module.exports = {
  listNearbyShops,
  getPublicShopById,
  listPublicProductsByShopId,
  listPublicReviewsByShopId,
};
