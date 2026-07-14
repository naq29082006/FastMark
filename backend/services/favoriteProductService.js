const FavoriteProduct = require("../models/FavoriteProduct");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
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

function toClientFavorite({ favorite, product, shop, seller, isUnavailable = false, variants = [] }) {
  const prices = variants.map((variant) => Number(variant.Price ?? variant.price) || 0);
  const minPrice =
    prices.length > 0
      ? Math.min(...prices)
      : Number(product?.minPrice ?? product?.MinPrice) || 0;
  const maxPrice =
    prices.length > 0
      ? Math.max(...prices)
      : Number(product?.maxPrice ?? product?.MaxPrice) || minPrice;

  const status =
    typeof product?.Status === "number"
      ? product.Status
      : PRODUCT_STATUS.ACTIVE;

  const remainingQuantity = variants.reduce(
    (sum, variant) => sum + Math.max(0, Number(variant.Quantity ?? variant.quantity) || 0),
    0
  );
  const isOutOfStock = variants.length > 0 && remainingQuantity <= 0;

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
    status,
    isUnavailable: Boolean(isUnavailable) || status === PRODUCT_STATUS.HIDDEN,
    isOutOfStock: Boolean(isUnavailable) ? false : isOutOfStock,
    remainingQuantity,
    variantCount: variants.length,
    variants: variants.map((variant) => ({
      id: String(variant._id || variant.id || ""),
      quantity: Math.max(0, Number(variant.Quantity ?? variant.quantity) || 0),
    })),
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
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const variants = await ProductVariant.find({ ProductId: { $in: productIds } }).lean();
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(variant);
    return map;
  }, new Map());

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
        return toClientFavorite({
          favorite,
          product: {
            _id: favorite.productId,
            ProductName: "Sản phẩm",
            Status: PRODUCT_STATUS.HIDDEN,
          },
          shop: null,
          seller: null,
          isUnavailable: true,
        });
      }
      const shop = shopById.get(String(product.ShopId));
      const seller = shop ? sellerById.get(String(shop.userId)) : null;
      const isUnavailable =
        Number(product.Status) === PRODUCT_STATUS.HIDDEN || Boolean(product.IsDeleted);
      return toClientFavorite({
        favorite,
        product,
        shop,
        seller,
        isUnavailable,
        variants: variantsByProduct.get(String(product._id)) || [],
      });
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

  const existing = await FavoriteProduct.findOne({
    userId: user._id,
    productId: product._id,
  });
  if (existing) {
    const shop = await ShopProfile.findById(product.ShopId).lean();
    const seller = shop?.userId ? await User.findById(shop.userId).lean() : null;
    return toClientFavorite({ favorite: existing, product, shop, seller });
  }

  const now = new Date();
  const favorite = await FavoriteProduct.create({
    userId: user._id,
    productId: product._id,
    CreatedAt: now,
    UpdatedAt: now,
  });

  await Product.findByIdAndUpdate(product._id, { $inc: { LikeCount: 1 } });
  product.LikeCount = Math.max(0, Number(product.LikeCount) || 0) + 1;

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

  await Product.updateOne(
    { _id: normalizedId, LikeCount: { $gt: 0 } },
    { $inc: { LikeCount: -1 } }
  );

  return { productId: normalizedId };
}

module.exports = {
  listFavorites,
  listFavoriteProductIds,
  addFavorite,
  removeFavorite,
};
