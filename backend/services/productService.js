const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductCategory = require("../models/ProductCategory");
const { assertProductCategoryExists } = require("./productCategoryService");
const ShopProfile = require("../models/ShopProfile");
const { PRODUCT_STATUS, PRODUCT_REMOVED_BY } = require("../constants");
const { isSubscriptionActive, isRecordActive } = require("../constants");
const {
  isSellerRemovedProduct,
  notRemovedProductMatch,
} = require("../utils/productRemoval");
const {
  assertCanManageProducts,
} = require("./sellerPlanAccessService");
const { assertNoActiveReservationsForProduct } = require("./reservationService");
const { sanitizeUploadLabel } = require("../utils/sanitizeFileName");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const {
  normalizeEmbeddedImages,
  resolveImageUrls,
  toPublicImageList,
} = require("../utils/embeddedImages");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

/** Thứ tự hiển thị: pin 1 → pin 2 → không ghim. */
function sortProductsByPin(products = []) {
  return [...products].sort((left, right) => {
    const pinLeft = Number(left.pinProduct) || 0;
    const pinRight = Number(right.pinProduct) || 0;
    const orderLeft = pinLeft === 0 ? 99 : pinLeft;
    const orderRight = pinRight === 0 ? 99 : pinRight;
    if (orderLeft !== orderRight) {
      return orderLeft - orderRight;
    }
    return (
      new Date(right.createdAt || right.CreatedAt || 0).getTime() -
      new Date(left.createdAt || left.CreatedAt || 0).getTime()
    );
  });
}

function normalizePinProduct(value) {
  const pin = Number(value);
  if (!Number.isFinite(pin) || ![0, 1, 2].includes(pin)) {
    throw createServiceError("pinProduct chỉ nhận 0, 1 hoặc 2.");
  }
  return pin;
}

/** Legacy Product.Thumbnail (string | string[]) — fallback khi chưa có images. */
function normalizeLegacyThumbnailList(value) {
  if (Array.isArray(value)) {
    return value.map(pickString).filter(Boolean);
  }
  const single = pickString(value);
  return single ? [single] : [];
}

function toPublicProductImages(imageSource = []) {
  return toPublicImageList(resolveImageUrls(imageSource));
}

async function loadProductImages(productId) {
  const product = await Product.findById(productId).select("images").lean();
  return normalizeEmbeddedImages(product?.images || []);
}

async function loadProductImagesByProductIds(productIds = []) {
  if (!productIds.length) {
    return new Map();
  }

  const rows = await Product.find({ _id: { $in: productIds } })
    .select("images")
    .lean();

  return rows.reduce((map, row) => {
    map.set(String(row._id), normalizeEmbeddedImages(row.images || []));
    return map;
  }, new Map());
}

async function replaceProductImages(productId, imageUrls = []) {
  const urls = normalizeEmbeddedImages(imageUrls);
  await Product.updateOne({ _id: productId }, { $set: { images: urls, UpdatedAt: new Date() } });
  return urls;
}

function pickVariantImageInput(variant) {
  if (variant.image && typeof variant.image === "object") {
    return variant.image;
  }
  if (pickString(variant.imageUrl || variant.ImageUrl)) {
    return { imageUrl: pickString(variant.imageUrl || variant.ImageUrl) };
  }
  if (variant.imageBase64 || variant.ImageBase64) {
    return {
      imageUrl: pickString(variant.imageUrl || variant.ImageUrl),
      imageBase64: variant.imageBase64 || variant.ImageBase64,
      mimeType: variant.mimeType || variant.MimeType,
    };
  }
  if (Array.isArray(variant.images) && variant.images[0]) {
    return variant.images[0];
  }
  return null;
}

function normalizeVariantsInput(rawVariants, { requireImage = true } = {}) {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    throw createServiceError("Cần ít nhất một biến thể sản phẩm.");
  }

  return rawVariants.map((variant, index) => {
    const variantName = pickString(variant.variantName || variant.VariantName || variant.name);
    const price = Number(variant.price ?? variant.Price);
    const quantity = Number(variant.quantity ?? variant.Quantity ?? 0);
    const image = pickVariantImageInput(variant);

    if (!variantName) {
      throw createServiceError(`Biến thể #${index + 1} thiếu tên.`);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw createServiceError(`Biến thể "${variantName}" có giá không hợp lệ.`);
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw createServiceError(`Biến thể "${variantName}" có số lượng không hợp lệ.`);
    }

    const hasImage =
      image &&
      (pickString(image.imageUrl || image.ImageUrl) ||
        image.imageBase64 ||
        image.ImageBase64);

    if (requireImage && !hasImage) {
      throw createServiceError(`Biến thể "${variantName}" cần một ảnh.`);
    }

    return {
      variantName,
      price,
      quantity,
      image,
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

async function resolveVariantImage({ user, image, variantName }) {
  if (!image) {
    return "";
  }
  return uploadVariantImage({
    user,
    imageInput: image,
    folder: "product-images",
    label: variantName || "variant",
  });
}

function computePriceRange(variants) {
  const prices = variants.map((variant) => variant.price);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

function toPublicVariant(variant) {
  const imageUrl =
    pickString(variant.ImageUrl) ||
    pickString(variant.Images?.[0]?.ImageUrl) ||
    "";

  return {
    id: variant._id,
    productId: variant.ProductId,
    variantName: variant.VariantName,
    price: variant.Price,
    quantity: Math.max(0, Number(variant.Quantity) || 0),
    soldCount: variant.SoldCount || 0,
    imageUrl,
    // Tương thích client cũ từng dùng mảng images.
    images: imageUrl ? [{ id: "", imageUrl, sortOrder: 0 }] : [],
    status: variant.Status,
    createdAt: variant.CreatedAt,
    updatedAt: variant.UpdatedAt,
  };
}

function publicProductFilter(extra = {}) {
  const parts = [];
  if (extra && Object.keys(extra).length) {
    parts.push(extra);
  }
  parts.push(
    notRemovedProductMatch(),
    {
      $or: [
        { Status: PRODUCT_STATUS.ACTIVE },
        { Status: true },
        { Status: { $exists: false } },
      ],
    }
  );
  return parts.length === 1 ? parts[0] : { $and: parts };
}

function activeProductFilter(extra = {}) {
  return publicProductFilter(extra);
}

function sellerManagedProductFilter(extra = {}) {
  return {
    ...extra,
    ...notRemovedProductMatch(),
    $or: [
      { Status: PRODUCT_STATUS.ACTIVE },
      { Status: PRODUCT_STATUS.HIDDEN },
      { Status: { $exists: false } },
    ],
  };
}

function toPublicProduct(product, variants = [], category = null, imageDocs = null) {
  const normalizedVariants = variants.map(toPublicVariant);
  const remainingQuantity = normalizedVariants.reduce(
    (sum, variant) => sum + Math.max(0, Number(variant.quantity) || 0),
    0
  );
  const isOutOfStock =
    normalizedVariants.length > 0 && remainingQuantity <= 0;

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
      : Number(product.IsDeleted) === 0 || product.IsDeleted === true
        ? PRODUCT_STATUS.HIDDEN
        : PRODUCT_STATUS.ACTIVE;

  const images = toPublicProductImages(product.images?.length ? product.images : imageDocs || []);
  let thumbnails = images.map((image) => image.imageUrl);
  if (thumbnails.length === 0) {
    thumbnails = normalizeLegacyThumbnailList(product.Thumbnail);
  }

  const {
    attachPromotionDto,
  } = require("./productPromotionService");

  if (
    product.IsPromotion &&
    product.PromotionEndDate &&
    new Date(product.PromotionEndDate) < new Date() &&
    typeof product.save === "function"
  ) {
    const { ensureProductPromotionFresh } = require("./productPromotionService");
    ensureProductPromotionFresh(product).catch(() => {});
  }

  const dto = {
    id: product._id,
    shopId: product.ShopId,
    categoryId: product.CategoryId,
    categoryName: category?.name || category?.categoryName || product.CategoryName || "",
    productName: product.ProductName,
    description: product.Description || "",
    donVi: product.DonVi || "",
    images,
    thumbnails,
    thumbnail: thumbnails[0] || "",
    viewCount: product.ViewCount || 0,
    likeCount: product.LikeCount || 0,
    soldCount: product.SoldCount || 0,
    isOutOfStock,
    remainingQuantity,
    variantCount: normalizedVariants.length,
    status,
    isUnavailable: status === PRODUCT_STATUS.HIDDEN,
    minPrice,
    maxPrice: maxPrice || minPrice,
    pinProduct: Math.max(0, Math.min(2, Number(product.pinProduct) || 0)),
    variants: normalizedVariants,
    createdAt: product.CreatedAt,
    updatedAt: product.UpdatedAt,
  };

  return attachPromotionDto(dto, product);
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
    ? sellerManagedProductFilter({ _id: productId, ShopId: shop._id })
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
    const imageUrl = await resolveVariantImage({
      user,
      image: variantInput.image,
      variantName: variantInput.variantName,
    });

    variantDocs.push({
      variantName: variantInput.variantName,
      price: variantInput.price,
      quantity: variantInput.quantity,
      imageUrl,
    });
  }

  return variantDocs;
}

async function syncShopProductStats(shop) {
  const products = await Product.find(activeProductFilter({ ShopId: shop._id }));
  shop.totalProducts = products.length;
  // Shop followersCount is maintained by Follow, not product likes.
  shop.UpdatedAt = new Date();
  await shop.save();
  return shop;
}

async function resolveThumbnails({ user, payload }) {
  const collected = [];

  const rawList =
    payload.thumbnails ||
    payload.Thumbnails ||
    payload.thumbnailImages ||
    payload.ThumbnailImages ||
    null;

  if (Array.isArray(rawList) && rawList.length > 0) {
    for (let index = 0; index < rawList.length; index += 1) {
      const item = rawList[index];
      if (typeof item === "string" && pickString(item)) {
        collected.push(pickString(item));
        continue;
      }
      if (item && typeof item === "object") {
        const url = await uploadVariantImage({
          user,
          imageInput: item,
          folder: "product-thumbnails",
          label: `thumbnail-${index + 1}`,
        });
        if (url) {
          collected.push(url);
        }
      }
    }
  }

  // Legacy: 1 ảnh đơn.
  if (collected.length === 0) {
    const thumbnailUrl = pickString(
      payload.thumbnail || payload.Thumbnail || payload.thumbnailUrl
    );
    if (thumbnailUrl) {
      collected.push(thumbnailUrl);
    }
  }

  if (collected.length === 0) {
    const thumbnailInput = payload.thumbnailImage || payload.ThumbnailImage;
    if (thumbnailInput) {
      const url = await uploadVariantImage({
        user,
        imageInput: thumbnailInput,
        folder: "product-thumbnails",
        label: "thumbnail",
      });
      if (url) {
        collected.push(url);
      }
    }
  }

  if (collected.length === 0) {
    const thumbnailBase64 = payload.thumbnailBase64 || payload.ThumbnailBase64;
    if (thumbnailBase64) {
      const url = await uploadVariantImage({
        user,
        imageInput: {
          imageBase64: thumbnailBase64,
          mimeType: payload.thumbnailMimeType || payload.ThumbnailMimeType || "image/jpeg",
        },
        folder: "product-thumbnails",
        label: "thumbnail",
      });
      if (url) {
        collected.push(url);
      }
    }
  }

  return collected;
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
  await assertCanManageProducts(shop);

  const { minPrice, maxPrice } = computePriceRange(variantsInput);
  const variantDocs = await buildVariantDocs(user, variantsInput);

  let thumbnails = await resolveThumbnails({ user, payload });
  if (thumbnails.length === 0) {
    const fallback = variantDocs[0]?.imageUrl || "";
    thumbnails = fallback ? [fallback] : [];
  }

  const status = PRODUCT_STATUS.ACTIVE;

  const {
    normalizePromotionPayload,
    applyPromotionToProduct,
  } = require("./productPromotionService");
  const promotion = normalizePromotionPayload(payload, minPrice);

  const product = await Product.create({
    ShopId: shop._id,
    CategoryId: category._id,
    ProductName: productName,
    Description: description,
    DonVi: donVi,
    MinPrice: minPrice,
    MaxPrice: maxPrice,
    Status: status,
    IsPromotion: promotion.isPromotion,
    DiscountPercent: promotion.discountPercent,
    PromotionStartDate: promotion.promotionStartDate,
    PromotionEndDate: promotion.promotionEndDate,
  });

  const imageDocs = await replaceProductImages(product._id, thumbnails);

  const savedVariants = await ProductVariant.insertMany(
    variantDocs.map((variant) => ({
      ProductId: product._id,
      VariantName: variant.variantName,
      Price: variant.price,
      Quantity: variant.quantity,
      ImageUrl: variant.imageUrl || "",
    }))
  );

  await syncShopProductStats(shop);

  const { emitAdminUpdated, emitUserResourceUpdated, emitPublicUpdated } = require("./realtimeService");
  emitAdminUpdated("product", {
    productId: String(product._id),
    shopId: String(shop._id),
    created: true,
  });
  emitUserResourceUpdated(user._id, "product", {
    productId: String(product._id),
    created: true,
  });
  emitPublicUpdated("product", { productId: String(product._id), shopId: String(shop._id) });

  return {
    product,
    variants: savedVariants,
    images: imageDocs,
    subscriptionActive: true,
    publiclyVisible: true,
    message: "",
  };
}

async function listMyProducts(user, { page, limit } = {}) {
  const shop = await getSellerShop(user);
  await syncShopProductStats(shop);

  const filter = sellerManagedProductFilter({ ShopId: shop._id });
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const total = await Product.countDocuments(filter);
  // _id là tiebreaker bắt buộc: nhiều sản phẩm có cùng CreatedAt nên nếu thiếu nó
  // các trang skip/limit sẽ trả về trùng bản ghi và "Xem thêm" không ra dữ liệu mới.
  const products = await Product.find(filter)
    .sort({ pinProduct: -1, CreatedAt: -1, _id: -1 })
    .skip(skip)
    .limit(safeLimit);

  const productIds = products.map((product) => product._id);
  const [variants, imagesByProduct] = await Promise.all([
    ProductVariant.find({ ProductId: { $in: productIds } }),
    loadProductImagesByProductIds(productIds),
  ]);
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(variant);
    return map;
  }, {});

  const items = sortProductsByPin(
    products.map((product) =>
      toPublicProduct(
        product,
        variantsByProduct[String(product._id)] || [],
        null,
        imagesByProduct.get(String(product._id)) || []
      )
    )
  );

  return {
    products: items,
    items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function getProductById(productId) {
  // Chỉ tăng ViewCount cho sản phẩm còn hiển thị công khai.
  const product = await Product.findOneAndUpdate(
    publicProductFilter({ _id: productId }),
    { $inc: { ViewCount: 1 } },
    { returnDocument: "after" }
  );
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const shop = await ShopProfile.findById(product.ShopId).lean();
  if (!shop || !isSubscriptionActive(shop) || !isRecordActive(shop.isActive)) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const variants = await ProductVariant.find({ ProductId: product._id }).sort({
    CreatedAt: 1,
  });

  const [category, imageDocs] = await Promise.all([
    product.CategoryId
      ? ProductCategory.findById(product.CategoryId).lean()
      : Promise.resolve(null),
    loadProductImages(product._id),
  ]);

  return toPublicProduct(product, variants, category, imageDocs);
}

async function getMyProductById(user, productId) {
  const { product, variants } = await getOwnedProduct(user, productId, { includeHidden: true });
  const imageDocs = await loadProductImages(product._id);
  return toPublicProduct(product, variants, null, imageDocs);
}

async function updateProduct(user, productId, payload) {
  const { product } = await getOwnedProduct(user, productId, { includeHidden: true });
  const shop = await getSellerShop(user);
  await assertCanManageProducts(shop);

  const productName = pickString(payload.productName || payload.ProductName || product.ProductName);
  const description = pickString(payload.description ?? payload.Description ?? product.Description);
  const donVi = pickString(payload.donVi ?? payload.DonVi ?? product.DonVi);
  const categoryId = payload.categoryId || payload.CategoryId || product.CategoryId;
  const variantsInput = normalizeVariantsInput(payload.variants, { requireImage: true });

  if (!productName) {
    throw createServiceError("Vui lòng nhập tên sản phẩm.");
  }

  const category = await assertProductCategoryExists(categoryId);

  const { minPrice, maxPrice } = computePriceRange(variantsInput);
  const variantDocs = await buildVariantDocs(user, variantsInput);

  let thumbnails = await resolveThumbnails({ user, payload });
  if (thumbnails.length === 0) {
    const existingImages = await loadProductImages(product._id);
    const existingUrls = toPublicProductImages(existingImages).map((image) => image.imageUrl);
    const fallback = variantDocs[0]?.imageUrl || "";
    thumbnails = existingUrls.length > 0 ? existingUrls : fallback ? [fallback] : [];
  }

  product.CategoryId = category._id;
  product.ProductName = productName;
  product.Description = description;
  product.DonVi = donVi;
  product.MinPrice = minPrice;
  product.MaxPrice = maxPrice;
  product.UpdatedAt = new Date();

  if (
    payload.isPromotion !== undefined ||
    payload.promotionPrice !== undefined ||
    payload.discountPercent !== undefined ||
    payload.originalPrice !== undefined ||
    payload.promotionStartDate !== undefined ||
    payload.promotionEndDate !== undefined
  ) {
    const {
      normalizePromotionPayload,
      applyPromotionToProduct,
    } = require("./productPromotionService");
    const promotion = normalizePromotionPayload(payload, minPrice);
    applyPromotionToProduct(product, promotion);
  }

  await product.save();

  const imageDocs = await replaceProductImages(product._id, thumbnails);

  await ProductVariant.deleteMany({ ProductId: product._id });
  const savedVariants = await ProductVariant.insertMany(
    variantDocs.map((variant) => ({
      ProductId: product._id,
      VariantName: variant.variantName,
      Price: variant.price,
      Quantity: variant.quantity,
      ImageUrl: variant.imageUrl || "",
    }))
  );

  return {
    product,
    variants: savedVariants,
    images: imageDocs,
  };
}

async function softDeleteProduct(user, productId) {
  const shop = await getSellerShop(user);
  const product = await Product.findOne({
    _id: productId,
    ShopId: shop._id,
    ...notRemovedProductMatch(),
  });
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  if (isSellerRemovedProduct(product)) {
    return { product };
  }

  await assertNoActiveReservationsForProduct(product._id);

  product.Status = PRODUCT_STATUS.HIDDEN;
  product.IsDeleted = 0;
  product.RemovedBy = PRODUCT_REMOVED_BY.SELLER;
  product.RemovedAt = new Date();
  product.pinProduct = 0;
  product.IsPromotion = false;
  product.DiscountPercent = 0;
  product.PromotionStartDate = null;
  product.PromotionEndDate = null;
  product.UpdatedAt = new Date();
  await product.save();

  await syncShopProductStats(shop);

  const { emitAdminUpdated, emitUserResourceUpdated, emitPublicUpdated } = require("./realtimeService");
  const removedPayload = {
    productId: String(product._id),
    shopId: String(product.ShopId || ""),
    removed: true,
    removedBy: "seller",
  };
  emitAdminUpdated("product", {
    ...removedPayload,
    userId: shop.userId ? String(shop.userId) : "",
  });
  emitUserResourceUpdated(shop.userId, "product", removedPayload);
  emitPublicUpdated("product", removedPayload);

  return { product };
}

/**
 * Ghim sản phẩm trên shop: 0 bỏ ghim, 1/2 vị trí ghim.
 * - Ghim vị trí 1 khi chưa có vị trí 2: đẩy SP đang ở 1 xuống 2.
 * - Ghim vị trí 1 khi đã đủ 2 slot: thay SP đang ở 1 (đá ra).
 * - Ghim vị trí 2: thay SP đang ở 2 (đá ra).
 */
async function setProductPin(user, productId, pinValue) {
  const shop = await getSellerShop(user);
  await assertCanManageProducts(shop);
  const pinProduct = normalizePinProduct(pinValue);

  const product = await Product.findOne(
    sellerManagedProductFilter({ _id: productId, ShopId: shop._id })
  );
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const now = new Date();
  const shopFilter = { ShopId: shop._id, _id: { $ne: product._id } };

  if (pinProduct === 0) {
    product.pinProduct = 0;
    product.UpdatedAt = now;
    await product.save();
  } else if (pinProduct === 2) {
    await Product.updateMany(
      { ...shopFilter, pinProduct: 2 },
      { $set: { pinProduct: 0, UpdatedAt: now } }
    );
    product.pinProduct = 2;
    product.UpdatedAt = now;
    await product.save();
  } else {
    const atPin1 = await Product.findOne({ ...shopFilter, pinProduct: 1 });
    const atPin2 = await Product.findOne({ ...shopFilter, pinProduct: 2 });

    // Giải phóng slot của SP hiện tại trước để tránh trùng unique index.
    if (Number(product.pinProduct) > 0) {
      product.pinProduct = 0;
      product.UpdatedAt = now;
      await product.save();
    }

    if (atPin1) {
      if (atPin2) {
        // Đủ 2 ghim → chèn đè vị trí 1, đá SP cũ ở 1 ra.
        atPin1.pinProduct = 0;
        atPin1.UpdatedAt = now;
        await atPin1.save();
      } else {
        // Chỉ có vị trí 1 → đẩy xuống 2.
        atPin1.pinProduct = 2;
        atPin1.UpdatedAt = now;
        await atPin1.save();
      }
    }

    product.pinProduct = 1;
    product.UpdatedAt = now;
    await product.save();
  }

  const imageDocs = await loadProductImages(product._id);
  const variants = await ProductVariant.find({ ProductId: product._id }).sort({ CreatedAt: 1 });
  return toPublicProduct(product, variants, null, imageDocs);
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
  setProductPin,
  listCategories,
  toPublicProduct,
  sortProductsByPin,
  loadProductImages,
  loadProductImagesByProductIds,
  toPublicProductImages,
  syncShopProductStats,
  publicProductFilter,
  activeProductFilter,
};
