const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductCategory = require("../models/ProductCategory");
const { assertProductCategoryExists } = require("./productCategoryService");
const ShopProfile = require("../models/ShopProfile");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { sanitizeUploadLabel } = require("../utils/sanitizeFileName");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizeVariantsInput(rawVariants, { requireImages = true } = {}) {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    throw createServiceError("Cần ít nhất một biến thể sản phẩm.");
  }

  return rawVariants.map((variant, index) => {
    const variantName = pickString(variant.variantName || variant.VariantName || variant.name);
    const price = Number(variant.price ?? variant.Price);
    const quantity = Number(variant.quantity ?? variant.Quantity ?? 0);
    const images = Array.isArray(variant.images) ? variant.images : [];

    if (!variantName) {
      throw createServiceError(`Biến thể #${index + 1} thiếu tên.`);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw createServiceError(`Biến thể "${variantName}" có giá không hợp lệ.`);
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw createServiceError(`Biến thể "${variantName}" có số lượng không hợp lệ.`);
    }

    const hasImages = images.some(
      (image) =>
        pickString(image.imageUrl || image.ImageUrl) ||
        image.imageBase64 ||
        image.ImageBase64
    );

    if (requireImages && !hasImages) {
      throw createServiceError(`Biến thể "${variantName}" cần ít nhất một ảnh.`);
    }

    return {
      variantName,
      price,
      quantity,
      images,
    };
  });
}

async function uploadVariantImage({ user, imageInput, folder, label }) {
  const imageUrl = pickString(imageInput.imageUrl || imageInput.ImageUrl);
  if (imageUrl) {
    return imageUrl;
  }

  const imageBase64 = imageInput.imageBase64 || imageInput.ImageBase64;
  if (!imageBase64) {
    throw createServiceError(`Thiếu ảnh cho ${label}.`);
  }

  const normalizedBase64 = String(imageBase64).replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    ""
  );
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw createServiceError(`Ảnh ${label} không hợp lệ.`);
  }

  const mimeType = imageInput.mimeType || imageInput.MimeType || "image/jpeg";
  const safeLabel = sanitizeUploadLabel(label);
  const extension = resolveFileExtension(mimeType);
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder,
    fileName: `${user.FirebaseUID}-${safeLabel}-${Date.now()}.${extension}`,
  });

  return uploadResult.publicUrl;
}

async function resolveVariantImages({ user, images, variantName }) {
  const uploads = [];

  for (let index = 0; index < images.length; index += 1) {
    const imageUrl = await uploadVariantImage({
      user,
      imageInput: images[index],
      folder: "product-images",
      label: `${variantName}-${index + 1}`,
    });

    uploads.push({
      ImageUrl: imageUrl,
      SortOrder: Number(images[index].sortOrder ?? images[index].SortOrder ?? index),
    });
  }

  uploads.sort((left, right) => left.SortOrder - right.SortOrder);
  return uploads;
}

function computePriceRange(variants) {
  const prices = variants.map((variant) => variant.price);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

function toPublicVariantImage(image) {
  return {
    id: image._id,
    imageUrl: image.ImageUrl,
    sortOrder: image.SortOrder,
  };
}

function toPublicVariant(variant) {
  return {
    id: variant._id,
    productId: variant.ProductId,
    variantName: variant.VariantName,
    price: variant.Price,
    quantity: variant.Quantity,
    soldCount: variant.SoldCount || 0,
    images: (variant.Images || []).map(toPublicVariantImage),
    status: variant.Status,
    createdAt: variant.CreatedAt,
    updatedAt: variant.UpdatedAt,
  };
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

function toPublicProduct(product, variants = [], category = null) {
  const normalizedVariants = variants.map(toPublicVariant);
  const isOutOfStock =
    normalizedVariants.length > 0 &&
    normalizedVariants.every((variant) => Number(variant.quantity) <= 0);

  let minPrice = Number(product.MinPrice) || 0;
  let maxPrice = Number(product.MaxPrice) || 0;

  if (normalizedVariants.length > 0) {
    const prices = normalizedVariants.map((variant) => Number(variant.price) || 0);
    minPrice = Math.min(...prices);
    maxPrice = Math.max(...prices);
  }

  const status =
    typeof product.Status === "number"
      ? product.Status
      : product.IsDeleted
        ? PRODUCT_STATUS.HIDDEN
        : PRODUCT_STATUS.ACTIVE;

  return {
    id: product._id,
    shopId: product.ShopId,
    categoryId: product.CategoryId,
    categoryName: category?.name || category?.categoryName || product.CategoryName || "",
    categoryIcon: String(category?.icon || "").trim(),
    productName: product.ProductName,
    description: product.Description || "",
    donVi: product.DonVi || "",
    thumbnail: product.Thumbnail || "",
    viewCount: product.ViewCount || 0,
    likeCount: product.LikeCount || 0,
    soldCount: product.SoldCount || 0,
    isOutOfStock,
    status,
    isUnavailable: status === PRODUCT_STATUS.HIDDEN,
    minPrice,
    maxPrice: maxPrice || minPrice,
    variants: normalizedVariants,
    createdAt: product.CreatedAt,
    updatedAt: product.UpdatedAt,
  };
}

async function getSellerShop(user) {
  if (user.Role !== 2) {
    throw createServiceError("Chỉ người bán đã được admin duyệt mới có thể đăng sản phẩm.", 403);
  }

  const shop = await ShopProfile.findOne({ userId: user._id });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng. Vui lòng chờ admin duyệt hồ sơ người bán.", 403);
  }
  return shop;
}

async function getOwnedProduct(user, productId, { includeHidden = false } = {}) {
  const shop = await getSellerShop(user);
  const filter = includeHidden
    ? { _id: productId, ShopId: shop._id }
    : activeProductFilter({ _id: productId, ShopId: shop._id });

  const product = await Product.findOne(filter);
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const variants = await ProductVariant.find({ ProductId: product._id }).sort({ CreatedAt: 1 });
  return { product, variants, shop };
}

async function buildVariantDocs(user, variantsInput) {
  const variantDocs = [];

  for (const variantInput of variantsInput) {
    const images = await resolveVariantImages({
      user,
      images: variantInput.images,
      variantName: variantInput.variantName,
    });

    variantDocs.push({
      variantName: variantInput.variantName,
      price: variantInput.price,
      quantity: variantInput.quantity,
      images,
    });
  }

  return variantDocs;
}

async function syncShopProductStats(shop) {
  const products = await Product.find(activeProductFilter({ ShopId: shop._id }));
  shop.totalProducts = products.length;
  // totalLikes = số lượt yêu thích gian hàng (FavoriteShop), không ghi đè bằng tổng LikeCount sản phẩm.
  shop.UpdatedAt = new Date();
  await shop.save();
  return shop;
}

async function resolveThumbnail({ user, payload }) {
  const thumbnailUrl = pickString(payload.thumbnail || payload.Thumbnail || payload.thumbnailUrl);
  if (thumbnailUrl) {
    return thumbnailUrl;
  }

  const thumbnailInput = payload.thumbnailImage || payload.ThumbnailImage;
  if (thumbnailInput) {
    return uploadVariantImage({
      user,
      imageInput: thumbnailInput,
      folder: "product-thumbnails",
      label: "thumbnail",
    });
  }

  const thumbnailBase64 = payload.thumbnailBase64 || payload.ThumbnailBase64;
  if (thumbnailBase64) {
    return uploadVariantImage({
      user,
      imageInput: {
        imageBase64: thumbnailBase64,
        mimeType: payload.thumbnailMimeType || payload.ThumbnailMimeType || "image/jpeg",
      },
      folder: "product-thumbnails",
      label: "thumbnail",
    });
  }

  return "";
}

async function createProduct(user, payload) {
  const productName = pickString(payload.productName || payload.ProductName);
  const description = pickString(payload.description || payload.Description);
  const donVi = pickString(payload.donVi || payload.DonVi);
  const categoryId = payload.categoryId || payload.CategoryId;
  const variantsInput = normalizeVariantsInput(payload.variants);

  if (!productName) {
    throw createServiceError("Vui lòng nhập tên sản phẩm.");
  }

  if (!categoryId) {
    throw createServiceError("Vui lòng chọn danh mục sản phẩm.");
  }

  const category = await assertProductCategoryExists(categoryId);

  const shop = await getSellerShop(user);
  const { minPrice, maxPrice } = computePriceRange(variantsInput);
  const variantDocs = await buildVariantDocs(user, variantsInput);

  let thumbnail = await resolveThumbnail({ user, payload });
  if (!thumbnail) {
    thumbnail = variantDocs[0]?.images?.[0]?.ImageUrl || "";
  }

  const product = await Product.create({
    ShopId: shop._id,
    CategoryId: category._id,
    ProductName: productName,
    Description: description,
    DonVi: donVi,
    MinPrice: minPrice,
    MaxPrice: maxPrice,
    Thumbnail: thumbnail,
    Status: PRODUCT_STATUS.ACTIVE,
  });

  const savedVariants = await ProductVariant.insertMany(
    variantDocs.map((variant) => ({
      ProductId: product._id,
      VariantName: variant.variantName,
      Price: variant.price,
      Quantity: variant.quantity,
      Images: variant.images,
    }))
  );

  await syncShopProductStats(shop);

  return {
    product,
    variants: savedVariants,
  };
}

async function listMyProducts(user) {
  const shop = await getSellerShop(user);
  await syncShopProductStats(shop);

  const products = await Product.find(activeProductFilter({ ShopId: shop._id })).sort({
    CreatedAt: -1,
  });

  const productIds = products.map((product) => product._id);
  const variants = await ProductVariant.find({ ProductId: { $in: productIds } });
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(variant);
    return map;
  }, {});

  return products.map((product) =>
    toPublicProduct(product, variantsByProduct[String(product._id)] || [])
  );
}

async function getProductById(productId) {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $inc: { ViewCount: 1 } },
    { new: true }
  );
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const variants = await ProductVariant.find({ ProductId: product._id }).sort({
    CreatedAt: 1,
  });

  const category = product.CategoryId
    ? await ProductCategory.findById(product.CategoryId).lean()
    : null;

  return toPublicProduct(product, variants, category);
}

async function getMyProductById(user, productId) {
  const { product, variants } = await getOwnedProduct(user, productId, { includeHidden: true });
  return toPublicProduct(product, variants);
}

async function updateProduct(user, productId, payload) {
  const { product, shop } = await getOwnedProduct(user, productId, { includeHidden: true });

  if (product.Status === PRODUCT_STATUS.HIDDEN) {
    throw createServiceError("Sản phẩm đã bị ẩn, không thể chỉnh sửa.");
  }

  const productName = pickString(payload.productName || payload.ProductName || product.ProductName);
  const description = pickString(payload.description ?? payload.Description ?? product.Description);
  const donVi = pickString(payload.donVi ?? payload.DonVi ?? product.DonVi);
  const categoryId = payload.categoryId || payload.CategoryId || product.CategoryId;
  const variantsInput = normalizeVariantsInput(payload.variants, { requireImages: true });

  if (!productName) {
    throw createServiceError("Vui lòng nhập tên sản phẩm.");
  }

  const category = await assertProductCategoryExists(categoryId);

  const { minPrice, maxPrice } = computePriceRange(variantsInput);
  const variantDocs = await buildVariantDocs(user, variantsInput);

  let thumbnail = await resolveThumbnail({ user, payload });
  if (!thumbnail) {
    thumbnail = product.Thumbnail || variantDocs[0]?.images?.[0]?.ImageUrl || "";
  }

  product.CategoryId = category._id;
  product.ProductName = productName;
  product.Description = description;
  product.DonVi = donVi;
  product.MinPrice = minPrice;
  product.MaxPrice = maxPrice;
  product.Thumbnail = thumbnail;
  product.UpdatedAt = new Date();
  await product.save();

  await ProductVariant.deleteMany({ ProductId: product._id });
  const savedVariants = await ProductVariant.insertMany(
    variantDocs.map((variant) => ({
      ProductId: product._id,
      VariantName: variant.variantName,
      Price: variant.price,
      Quantity: variant.quantity,
      Images: variant.images,
    }))
  );

  return {
    product,
    variants: savedVariants,
  };
}

async function softDeleteProduct(user, productId) {
  const { product, shop } = await getOwnedProduct(user, productId, { includeHidden: true });

  if (product.Status === PRODUCT_STATUS.HIDDEN) {
    return { product };
  }

  product.Status = PRODUCT_STATUS.HIDDEN;
  product.UpdatedAt = new Date();
  await product.save();

  await syncShopProductStats(shop);

  return { product };
}

async function listCategories() {
  const categories = await ProductCategory.find({
    $or: [{ IsDeleted: 1 }, { IsDeleted: { $exists: false } }],
  }).sort({ CreatedAt: 1, _id: 1 });
  return categories.map((category) => ({
    id: String(category._id),
    name: category.name || category.categoryName || "",
    categoryName: category.name || category.categoryName || "",
    description: category.description || "",
    icon: String(category.icon || "").trim(),
    isDeleted: Number(category.IsDeleted) === 0 ? 0 : 1,
  }));
}

module.exports = {
  createProduct,
  listMyProducts,
  getProductById,
  getMyProductById,
  updateProduct,
  softDeleteProduct,
  listCategories,
  toPublicProduct,
};
