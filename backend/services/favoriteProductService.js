const mongoose = require("mongoose");
const FavoriteProduct = require("../models/FavoriteProduct");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductCategory = require("../models/ProductCategory");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { createNotification } = require("./notificationService");

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

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function pickShopLocation(shop) {
  return (
    pickString(shop?.DiaChiHeThong) ||
    pickString(shop?.address) ||
    pickString(shop?.description) ||
    ""
  );
}

function toClientFavorite({
  favorite,
  product,
  shop,
  seller,
  category = null,
  isUnavailable = false,
  variants = [],
}) {
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
    typeof product?.Status === "number" ? product.Status : PRODUCT_STATUS.ACTIVE;

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
    categoryId: product?.CategoryId ? String(product.CategoryId) : "",
    categoryName:
      pickString(category?.name) ||
      pickString(category?.categoryName) ||
      pickString(category?.Name) ||
      "",
    rating: Number(shop?.averageRating) || 0,
    likeCount: Number(product?.LikeCount) || 0,
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

async function buildFavoriteMaps(rows) {
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

  const categoryIds = [
    ...new Set(products.map((product) => String(product.CategoryId)).filter(Boolean)),
  ];
  let categoryById = new Map();
  if (categoryIds.length) {
    try {
      const categories = await ProductCategory.find({ _id: { $in: categoryIds } }).lean();
      categoryById = new Map(categories.map((category) => [String(category._id), category]));
    } catch {
      categoryById = new Map();
    }
  }

  return { productById, variantsByProduct, shopById, sellerById, categoryById };
}

function mapFavoriteRows(rows, maps) {
  const { productById, variantsByProduct, shopById, sellerById, categoryById } = maps;

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
            LikeCount: 0,
          },
          shop: null,
          seller: null,
          isUnavailable: true,
        });
      }
      const shop = shopById.get(String(product.ShopId));
      const seller = shop ? sellerById.get(String(shop.userId)) : null;
      const category = categoryById.get(String(product.CategoryId));
      const isUnavailable =
        Number(product.Status) === PRODUCT_STATUS.HIDDEN || Boolean(product.IsDeleted);
      return toClientFavorite({
        favorite,
        product,
        shop,
        seller,
        category,
        isUnavailable,
        variants: variantsByProduct.get(String(product._id)) || [],
      });
    })
    .filter(Boolean);
}

async function listFavoriteProductIds(user) {
  const rows = await FavoriteProduct.find({ userId: user._id })
    .select("productId")
    .lean();
  return rows.map((row) => String(row.productId));
}

async function listFavorites(user, query = {}) {
  const hasPaging =
    query.page !== undefined ||
    query.limit !== undefined ||
    query.search ||
    query.q ||
    query.sort ||
    query.categoryId ||
    query.shopId ||
    query.minPrice ||
    query.maxPrice;

  const rows = await FavoriteProduct.find({ userId: user._id })
    .sort({ CreatedAt: -1 })
    .limit(hasPaging ? 500 : 200)
    .lean();

  if (rows.length === 0) {
    if (!hasPaging) {
      return [];
    }
    const { page, limit } = parsePagination(query);
    return {
      favorites: [],
      items: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    };
  }

  const maps = await buildFavoriteMaps(rows);
  let items = mapFavoriteRows(rows, maps);

  const search = pickString(query.search || query.q).toLowerCase();
  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.name} ${item.shopName} ${item.categoryName}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  const categoryId = pickString(query.categoryId);
  if (categoryId) {
    items = items.filter((item) => item.categoryId === categoryId);
  }

  const shopId = pickString(query.shopId || query.storeId);
  if (shopId) {
    items = items.filter((item) => item.storeId === shopId);
  }

  const minPrice = Number(query.minPrice);
  if (Number.isFinite(minPrice)) {
    items = items.filter((item) => Number(item.minPrice) >= minPrice);
  }

  const maxPrice = Number(query.maxPrice);
  if (Number.isFinite(maxPrice)) {
    items = items.filter((item) => Number(item.minPrice) <= maxPrice);
  }

  const sort = pickString(query.sort || "newest").toLowerCase();
  if (sort === "price_asc") {
    items.sort((a, b) => a.minPrice - b.minPrice);
  } else if (sort === "price_desc") {
    items.sort((a, b) => b.minPrice - a.minPrice);
  } else if (sort === "likes" || sort === "likes_desc") {
    items.sort((a, b) => b.likeCount - a.likeCount);
  } else if (sort === "rating" || sort === "rating_desc") {
    items.sort((a, b) => b.rating - a.rating);
  } else if (sort === "name") {
    items.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } else {
    items.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  }

  if (!hasPaging) {
    return items;
  }

  const { page, limit, skip } = parsePagination(query);
  const total = items.length;
  const paged = items.slice(skip, skip + limit);

  return {
    favorites: paged,
    items: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
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
    let category = null;
    if (product.CategoryId) {
      try {
        category = await ProductCategory.findById(product.CategoryId).lean();
      } catch {
        category = null;
      }
    }
    return toClientFavorite({ favorite: existing, product, shop, seller, category });
  }

  const session = await mongoose.startSession();
  let favorite = null;

  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const [created] = await FavoriteProduct.create(
        [
          {
            userId: user._id,
            productId: product._id,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        { session }
      );
      favorite = created;

      await Product.findByIdAndUpdate(
        product._id,
        { $inc: { LikeCount: 1 }, $set: { UpdatedAt: now } },
        { session }
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existingDup = await FavoriteProduct.findOne({
        userId: user._id,
        productId: product._id,
      });
      const shop = await ShopProfile.findById(product.ShopId).lean();
      const seller = shop?.userId ? await User.findById(shop.userId).lean() : null;
      return toClientFavorite({ favorite: existingDup, product, shop, seller });
    }
    throw error;
  } finally {
    session.endSession();
  }

  product.LikeCount = Math.max(0, Number(product.LikeCount) || 0) + 1;

  const shop = await ShopProfile.findById(product.ShopId).lean();
  const seller = shop?.userId ? await User.findById(shop.userId).lean() : null;
  let category = null;
  if (product.CategoryId) {
    try {
      category = await ProductCategory.findById(product.CategoryId).lean();
    } catch {
      category = null;
    }
  }

  if (seller?._id && String(seller._id) !== String(user._id)) {
    const buyerName = user.FullName || user.UserName || "Một người mua";
    const productName = product.ProductName || "sản phẩm";
    await createNotification(seller._id, {
      title: "Sản phẩm được yêu thích",
      content: `${buyerName} đã thích "${productName}".`,
    });
  }

  return toClientFavorite({ favorite, product, shop, seller, category });
}

async function removeFavorite(user, productId) {
  const normalizedId = pickString(productId);
  if (!isStrictMongoObjectId(normalizedId)) {
    throw createServiceError("Mã sản phẩm không hợp lệ.", 400);
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const result = await FavoriteProduct.findOneAndDelete(
        {
          userId: user._id,
          productId: normalizedId,
        },
        { session }
      );

      if (!result) {
        throw createServiceError("Sản phẩm chưa có trong danh sách yêu thích.", 404);
      }

      await Product.updateOne(
        { _id: normalizedId, LikeCount: { $gt: 0 } },
        { $inc: { LikeCount: -1 }, $set: { UpdatedAt: new Date() } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  return { productId: normalizedId };
}

module.exports = {
  listFavorites,
  listFavoriteProductIds,
  addFavorite,
  removeFavorite,
};
