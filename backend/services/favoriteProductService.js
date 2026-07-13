const FavoriteProduct = require("../models/FavoriteProduct");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { PRODUCT_STATUS } = require("../constants/productStatus");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function activeProductFilter(extra = {}) {
  return {
    ...extra,
    IsDeleted: { $ne: true },
    Status: PRODUCT_STATUS.ACTIVE,
  };
}

function pickShopLocation(shop) {
  const address =
    pickString(shop?.DiaChiHeThong) ||
    pickString(shop?.address) ||
    pickString(shop?.description) ||
    "";
  return address;
}

function toClientFavorite({ favorite, product, shop, seller }) {
  const variants = product?.variants || [];
  const prices = variants.map((variant) => Number(variant.price) || 0);
  const minPrice =
    prices.length > 0
      ? Math.min(...prices)
      : Number(product?.minPrice ?? product?.MinPrice) || 0;
  const maxPrice =
    prices.length > 0
      ? Math.max(...prices)
      : Number(product?.maxPrice ?? product?.MaxPrice) || minPrice;

  return {
    id: String(favorite._id),
    productId: String(product?._id || favorite.productId),
    storeId: String(product?.ShopId || shop?._id || ""),
    name: product?.ProductName || product?.productName || "Sản phẩm",
    price: minPrice,
    minPrice,
    maxPrice: maxPrice || minPrice,
    thumbnail: product?.Thumbnail || product?.thumbnail || "",
    location: pickShopLocation(shop),
    shopName: pickString(shop?.shopName) || pickString(seller?.UserName) || "Gian hàng",
    savedAt: favorite.CreatedAt,
  };
}

async function listFavoriteProductIds(user) {
  const rows = await FavoriteProduct.find({ userId: user._id })
    .select("productId")
    .lean();
  return rows.map((row) => String(row.productId));
}

async function listFavorites(user) {
  const rows = await FavoriteProduct.find({ userId: user._id })
    .sort({ CreatedAt: -1 })
    .limit(200)
    .lean();

  if (rows.length === 0) {
    return [];
  }

  const productIds = rows.map((row) => row.productId);
  const products = await Product.find(activeProductFilter({ _id: { $in: productIds } })).lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const shopIds = [...new Set(products.map((product) => String(product.ShopId)).filter(Boolean))];
  const shops = shopIds.length
    ? await ShopProfile.find({ _id: { $in: shopIds } }).lean()
    : [];
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));

  const sellerIds = [...new Set(shops.map((shop) => String(shop.userId)).filter(Boolean))];
  const sellers = sellerIds.length ? await User.find({ _id: { $in: sellerIds } }).lean() : [];
  const sellerById = new Map(sellers.map((seller) => [String(seller._id), seller]));

  return rows
    .map((favorite) => {
      const product = productById.get(String(favorite.productId));
      if (!product) {
        return null;
      }
      const shop = shopById.get(String(product.ShopId));
      const seller = shop ? sellerById.get(String(shop.userId)) : null;
      return toClientFavorite({ favorite, product, shop, seller });
    })
    .filter(Boolean);
}

async function addFavorite(user, productId) {
  const normalizedId = pickString(productId);
  if (!isStrictMongoObjectId(normalizedId)) {
    throw createServiceError("Mã sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findOne(activeProductFilter({ _id: normalizedId }));
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const now = new Date();
  const favorite = await FavoriteProduct.findOneAndUpdate(
    { userId: user._id, productId: product._id },
    { $set: { UpdatedAt: now }, $setOnInsert: { CreatedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const shop = await ShopProfile.findById(product.ShopId).lean();
  const seller = shop?.userId ? await User.findById(shop.userId).lean() : null;

  return toClientFavorite({ favorite, product, shop, seller });
}

async function removeFavorite(user, productId) {
  const normalizedId = pickString(productId);
  if (!isStrictMongoObjectId(normalizedId)) {
    throw createServiceError("Mã sản phẩm không hợp lệ.", 400);
  }

  const result = await FavoriteProduct.findOneAndDelete({
    userId: user._id,
    productId: normalizedId,
  });

  if (!result) {
    throw createServiceError("Sản phẩm chưa có trong danh sách yêu thích.", 404);
  }

  return { productId: normalizedId };
}

module.exports = {
  listFavorites,
  listFavoriteProductIds,
  addFavorite,
  removeFavorite,
};
