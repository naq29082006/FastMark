const Review = require("../models/Review");
const User = require("../models/User");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Reservation = require("../models/Reservation");
const { getShopForSeller } = require("./shopSettingsService");
const {
  toPublicReview,
  loadReviewImagesMap,
} = require("./buyerReviewService");
const { publicReviewFilter } = require("../utils/reviewVisibility");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { buildOrderCode } = require("../utils/pickupQr");
const { loadProductImagesByProductIds, toPublicProductImages } = require("./productService");

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

function computeOrderAmounts(reservation) {
  if (!reservation) {
    return {
      quantity: 0,
      unitPrice: 0,
      totalAmount: 0,
      depositAmount: 0,
      depositPercent: 0,
      cashDue: 0,
    };
  }
  const unitPrice = Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0;
  const quantity = Number(reservation.quantity) || 0;
  const totalAmount = unitPrice * quantity;
  const depositAmount = Number(reservation.depositAmount) || 0;
  const depositPercent = Math.max(0, Math.min(100, Number(reservation.depositPercent) || 0));
  const cashDue = Math.max(0, totalAmount - depositAmount);
  return { quantity, unitPrice, totalAmount, depositAmount, depositPercent, cashDue };
}

function resolveProductThumbnail(product, imagesByProductId) {
  const productId = product?._id ? String(product._id) : "";
  const imageDocs = productId ? imagesByProductId.get(productId) || [] : [];
  const thumbnails = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  const legacyThumbs = Array.isArray(product?.Thumbnail)
    ? product.Thumbnail.filter(Boolean)
    : product?.Thumbnail
      ? [product.Thumbnail]
      : [];
  const merged = thumbnails.length > 0 ? thumbnails : legacyThumbs;
  return merged[0] || "";
}

async function loadOrderContextMaps(reviews) {
  const reservationIds = [
    ...new Set(reviews.map((row) => row.reservationId).filter(Boolean).map(String)),
  ];
  const reservations = reservationIds.length
    ? await Reservation.find({ _id: { $in: reservationIds } }).lean()
    : [];
  const reservationById = new Map(reservations.map((row) => [String(row._id), row]));

  const variantIds = [
    ...new Set(reservations.map((row) => row.variantId).filter(Boolean).map(String)),
  ];
  const productIdsFromRes = [
    ...new Set(reservations.map((row) => row.productId).filter(Boolean).map(String)),
  ];
  const productIdsFromReviews = [
    ...new Set(reviews.map((row) => row.productId).filter(Boolean).map(String)),
  ];
  const productIds = [...new Set([...productIdsFromRes, ...productIdsFromReviews])];

  const [variants, products, imagesByProductIdRaw] = await Promise.all([
    variantIds.length
      ? ProductVariant.find({ _id: { $in: variantIds } })
          .select("VariantName Price ImageUrl Images")
          .lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName Thumbnail").lean()
      : [],
    productIds.length ? loadProductImagesByProductIds(productIds) : new Map(),
  ]);

  const variantById = new Map(variants.map((row) => [String(row._id), row]));
  const productById = new Map(products.map((row) => [String(row._id), row]));

  return { reservationById, variantById, productById, imagesByProductIdRaw };
}

function buildSellerReviewExtras(review, maps) {
  const { reservationById, variantById, productById, imagesByProductIdRaw } = maps;
  const reservation = review.reservationId
    ? reservationById.get(String(review.reservationId))
    : null;
  const product =
    (reservation?.productId ? productById.get(String(reservation.productId)) : null) ||
    (review.productId ? productById.get(String(review.productId)) : null);
  const variant = reservation?.variantId
    ? variantById.get(String(reservation.variantId))
    : null;
  const amounts = computeOrderAmounts(reservation);
  const productThumbnail = resolveProductThumbnail(product, imagesByProductIdRaw);
  const variantName = pickString(variant?.VariantName);
  const orderCode = reservation?._id
    ? buildOrderCode(reservation._id)
    : review.reservationId
      ? buildOrderCode(review.reservationId)
      : "";

  return {
    reservationId: review.reservationId ? String(review.reservationId) : "",
    orderCode,
    productName: pickString(product?.ProductName),
    productThumbnail,
    variantName,
    variant: variant
      ? {
          id: String(variant._id),
          variantName,
          price: Number(variant.Price) || 0,
        }
      : null,
    product: product
      ? {
          id: String(product._id),
          productName: pickString(product?.ProductName),
          thumbnail: productThumbnail,
        }
      : null,
    quantity: amounts.quantity,
    unitPrice: amounts.unitPrice,
    agreedPrice: amounts.unitPrice,
    totalAmount: amounts.totalAmount,
    depositAmount: amounts.depositAmount,
    depositPercent: amounts.depositPercent,
    cashDue: amounts.cashDue,
    remainingAmount: amounts.cashDue,
  };
}

async function enrichSellerReviews(reviews, shop) {
  if (!reviews.length) {
    return [];
  }

  const userIds = reviews.map((row) => row.userId).filter(Boolean);
  const productIds = reviews.map((row) => row.productId).filter(Boolean);
  const reviewIds = reviews.map((row) => row._id).filter(Boolean);

  const [users, products, imagesByReview, orderMaps] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select("FullName UserName Avatar Phone").lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
    loadReviewImagesMap(reviewIds),
    loadOrderContextMaps(reviews),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const items = await Promise.all(
    reviews.map(async (row) => {
      const base = await toPublicReview(row, {
        user: userById.get(String(row.userId)),
        product: productById.get(String(row.productId)),
        shop,
        images: imagesByReview.get(String(row._id)) || [],
      });
      const orderExtras = buildSellerReviewExtras(row, orderMaps);
      const buyerUser = userById.get(String(row.userId));
      return {
        ...base,
        ...orderExtras,
        productName: orderExtras.productName || base.productName,
        buyer: buyerUser
          ? {
              id: String(buyerUser._id),
              fullName: pickString(buyerUser.FullName) || pickString(buyerUser.UserName) || "Khách hàng",
              avatar: pickString(buyerUser.Avatar),
              phone: pickString(buyerUser.Phone),
            }
          : {
              id: base.userId || "",
              fullName: base.userName || "Khách hàng",
              avatar: base.avatar || "",
              phone: "",
            },
      };
    })
  );

  return items;
}

async function listSellerReviews(user, { page, limit } = {}) {
  const shop = await getShopForSeller(user);
  if (!shop?._id) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const filter = {
    shopId: shop._id,
    ...publicReviewFilter(),
  };
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ CreatedAt: -1, _id: -1 }).skip(skip).limit(safeLimit).lean(),
    Review.countDocuments(filter),
  ]);

  const items = await enrichSellerReviews(rows, shop);

  return {
    reviews: items,
    items,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function getSellerReviewDetail(user, reviewId) {
  const normalized = pickString(reviewId);
  if (!normalized || !isStrictMongoObjectId(normalized)) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const shop = await getShopForSeller(user);
  if (!shop?._id) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const review = await Review.findOne({
    _id: normalized,
    shopId: shop._id,
    ...publicReviewFilter(),
  }).lean();

  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const [item] = await enrichSellerReviews([review], shop);
  if (!item) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  return { review: item };
}

module.exports = {
  listSellerReviews,
  getSellerReviewDetail,
};
