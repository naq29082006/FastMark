const mongoose = require("mongoose");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const ShopCategory = require("../models/ShopCategory");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductCategory = require("../models/ProductCategory");
const Reservation = require("../models/Reservation");
const Report = require("../models/Report");
const Review = require("../models/Review");
const { SHOP_STATUS, SHOP_OPEN } = require("../constants/shopStatus");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { RESERVATION_STATUS } = require("../constants/reservationStatus");

const SHOP_STATUS_LABELS = {
  [SHOP_STATUS.ACTIVE]: "Hoạt động",
  [SHOP_STATUS.BLOCKED]: "Đã khóa",
};

const SHOP_OPEN_LABELS = {
  [SHOP_OPEN.OPEN]: "Đang mở",
  [SHOP_OPEN.CLOSED]: "Đóng cửa",
};

const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: "Chờ xác nhận",
  [RESERVATION_STATUS.CONFIRMED]: "Đã xác nhận",
  [RESERVATION_STATUS.COMPLETED]: "Đã nhận hàng",
  [RESERVATION_STATUS.CANCELLED]: "Đã hủy",
};

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickString(value) {
  return String(value || "").trim();
}

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(value));
}

function parsePagination({ page, limit }, defaultLimit = 20) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || defaultLimit));
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
}

function formatPrice(value) {
  const number = Number(value) || 0;
  return `${number.toLocaleString("vi-VN")}đ`;
}

async function listShops(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search);
  const status = pickString(query.status);
  const isOpen = pickString(query.isOpen);
  const categoryId = toObjectId(query.categoryId);

  const filter = {};
  if (status !== "" && Number.isFinite(Number(status))) {
    filter.status = Number(status);
  }
  if (isOpen !== "" && Number.isFinite(Number(isOpen))) {
    filter.isOpen = Number(isOpen);
  }
  if (categoryId) {
    filter.categoryId = categoryId;
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { shopName: regex },
      { shopUsername: regex },
      { address: regex },
      { phone: regex },
      { description: regex },
    ];
  }

  const [total, shops] = await Promise.all([
    ShopProfile.countDocuments(filter),
    ShopProfile.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const categoryIds = shops.map((shop) => shop.categoryId).filter(Boolean);
  const [owners, categories] = await Promise.all([
    ownerIds.length
      ? User.find({ _id: { $in: ownerIds } }).select("FullName UserName Email Phone Avatar").lean()
      : [],
    categoryIds.length
      ? ShopCategory.find({ _id: { $in: categoryIds } }).select("name").lean()
      : [],
  ]);

  const ownerMap = new Map(owners.map((user) => [String(user._id), user]));
  const categoryMap = new Map(categories.map((item) => [String(item._id), item.name]));

  const items = shops.map((shop) => {
    const owner = ownerMap.get(String(shop.userId || ""));
    return {
      id: String(shop._id),
      shopName: shop.shopName || "",
      shopUsername: shop.shopUsername || "",
      avatar: shop.avatar || "",
      address: shop.address || shop.DiaChiHeThong || "",
      phone: shop.phone || "",
      categoryId: shop.categoryId ? String(shop.categoryId) : "",
      categoryName: categoryMap.get(String(shop.categoryId || "")) || "",
      status: shop.status,
      statusLabel: SHOP_STATUS_LABELS[shop.status] || "Không rõ",
      isOpen: shop.isOpen,
      isOpenLabel: SHOP_OPEN_LABELS[shop.isOpen] || "Không rõ",
      averageRating: Number(shop.averageRating) || 0,
      totalProducts: Number(shop.totalProducts) || 0,
      followersCount: Number(shop.followersCount) || 0,
      soldCount: Number(shop.soldCount) || 0,
      subscriptionPlan: shop.subscriptionPlan || null,
      subscriptionExpiresAt: shop.subscriptionExpiresAt || null,
      subscriptionActive: Boolean(
        shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) > new Date()
      ),
      suspendedUntil: shop.suspendedUntil || null,
      permanentlyClosedAt: shop.permanentlyClosedAt || null,
      createdAt: shop.CreatedAt || null,
      owner: owner
        ? {
            id: String(owner._id),
            fullName: owner.FullName || "",
            userName: owner.UserName || "",
            email: owner.Email || "",
            phone: owner.Phone || "",
            avatar: owner.Avatar || "",
          }
        : null,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getShopDetail(shopId) {
  const objectId = toObjectId(shopId);
  if (!objectId) {
    throw createServiceError("ID gian hàng không hợp lệ.", 400);
  }

  const shop = await ShopProfile.findById(objectId).lean();
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const [owner, category, products, reservations, reports, reviews] = await Promise.all([
    shop.userId
      ? User.findById(shop.userId).select("FullName UserName Email Phone Avatar Role Status").lean()
      : null,
    shop.categoryId ? ShopCategory.findById(shop.categoryId).select("name").lean() : null,
    Product.find({ ShopId: objectId }).sort({ CreatedAt: -1 }).limit(50).lean(),
    Reservation.find({ shopId: objectId }).sort({ CreatedAt: -1 }).limit(30).lean(),
    Report.find({ shopId: objectId }).sort({ CreatedAt: -1 }).limit(20).lean(),
    Review.find({ storeId: String(objectId), isDeleted: { $ne: true } })
      .sort({ CreatedAt: -1 })
      .limit(20)
      .lean(),
  ]);

  return {
    id: String(shop._id),
    shopName: shop.shopName || "",
    shopUsername: shop.shopUsername || "",
    avatar: shop.avatar || "",
    description: shop.description || "",
    address: shop.address || "",
    systemAddress: shop.DiaChiHeThong || "",
    phone: shop.phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    categoryId: shop.categoryId ? String(shop.categoryId) : "",
    categoryName: category?.name || "",
    status: shop.status,
    statusLabel: SHOP_STATUS_LABELS[shop.status] || "Không rõ",
    isOpen: shop.isOpen,
    isOpenLabel: SHOP_OPEN_LABELS[shop.isOpen] || "Không rõ",
    averageRating: Number(shop.averageRating) || 0,
    totalProducts: Number(shop.totalProducts) || 0,
    totalReviews: Number(shop.totalReviews) || 0,
    followersCount: Number(shop.followersCount) || 0,
    soldCount: Number(shop.soldCount) || 0,
    subscriptionPlan: shop.subscriptionPlan || null,
    subscriptionExpiresAt: shop.subscriptionExpiresAt || null,
    subscriptionActive: Boolean(
      shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) > new Date()
    ),
    visibilityRestrictedUntil: shop.visibilityRestrictedUntil || null,
    suspendedUntil: shop.suspendedUntil || null,
    permanentlyClosedAt: shop.permanentlyClosedAt || null,
    createdAt: shop.CreatedAt || null,
    owner: owner
      ? {
          id: String(owner._id),
          fullName: owner.FullName || "",
          userName: owner.UserName || "",
          email: owner.Email || "",
          phone: owner.Phone || "",
          avatar: owner.Avatar || "",
          role: owner.Role,
          status: owner.Status,
        }
      : null,
    products: products.map((product) => ({
      id: String(product._id),
      productName: product.ProductName || "",
      thumbnail: product.Thumbnail || "",
      minPrice: Number(product.MinPrice) || 0,
      maxPrice: Number(product.MaxPrice) || 0,
      status: product.Status,
      soldCount: Number(product.SoldCount) || 0,
      likeCount: Number(product.LikeCount) || 0,
    })),
    reservations: reservations.map((item) => ({
      id: String(item._id),
      status: item.status,
      statusLabel: RESERVATION_STATUS_LABELS[item.status] || "Không rõ",
      quantity: Number(item.quantity) || 0,
      pickupTime: item.pickupTime || null,
      createdAt: item.CreatedAt || null,
    })),
    reports: reports.map((item) => ({
      id: String(item._id),
      title: item.title || "",
      status: item.status,
      createdAt: item.CreatedAt || null,
    })),
    reviews: reviews.map((item) => ({
      id: String(item._id),
      userName: item.userName || "",
      rating: Number(item.rating) || 0,
      comment: item.comment || "",
      isHidden: Boolean(item.isHidden),
      createdAt: item.CreatedAt || null,
    })),
  };
}

async function setShopStatus(shopId, nextStatus) {
  const objectId = toObjectId(shopId);
  if (!objectId) {
    throw createServiceError("ID gian hàng không hợp lệ.", 400);
  }

  const shop = await ShopProfile.findById(objectId);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  shop.status = nextStatus;
  if (nextStatus === SHOP_STATUS.ACTIVE) {
    shop.suspendedUntil = null;
    shop.permanentlyClosedAt = null;
    shop.visibilityRestrictedUntil = null;
  } else {
    shop.permanentlyClosedAt = shop.permanentlyClosedAt || new Date();
  }
  shop.UpdatedAt = new Date();
  await shop.save();

  return getShopDetail(shopId);
}

async function deleteShop(shopId) {
  const objectId = toObjectId(shopId);
  if (!objectId) {
    throw createServiceError("ID gian hàng không hợp lệ.", 400);
  }

  const shop = await ShopProfile.findById(objectId);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  shop.status = SHOP_STATUS.BLOCKED;
  shop.permanentlyClosedAt = new Date();
  shop.isOpen = SHOP_OPEN.CLOSED;
  shop.UpdatedAt = new Date();
  await shop.save();

  await Product.updateMany(
    { ShopId: objectId },
    { $set: { Status: PRODUCT_STATUS.HIDDEN, UpdatedAt: new Date() } }
  );

  return { id: String(shop._id), deleted: true };
}

async function listProducts(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search);
  const status = pickString(query.status);
  const shopId = toObjectId(query.shopId);
  const categoryId = toObjectId(query.categoryId);

  const filter = {};
  if (status !== "" && Number.isFinite(Number(status))) {
    filter.Status = Number(status);
  }
  if (shopId) {
    filter.ShopId = shopId;
  }
  if (categoryId) {
    filter.CategoryId = categoryId;
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ ProductName: regex }, { Description: regex }, { DonVi: regex }];
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const shopIds = [...new Set(products.map((item) => String(item.ShopId || "")).filter(Boolean))];
  const categoryIds = [
    ...new Set(products.map((item) => String(item.CategoryId || "")).filter(Boolean)),
  ];

  const [shops, categories] = await Promise.all([
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } }).select("shopName shopUsername avatar").lean()
      : [],
    categoryIds.length
      ? ProductCategory.find({ _id: { $in: categoryIds } }).select("name categoryName").lean()
      : [],
  ]);

  const shopMap = new Map(shops.map((shop) => [String(shop._id), shop]));
  const categoryMap = new Map(
    categories.map((item) => [String(item._id), item.name || item.categoryName || ""])
  );

  const items = products.map((product) => {
    const shop = shopMap.get(String(product.ShopId || ""));
    return {
      id: String(product._id),
      productName: product.ProductName || "",
      thumbnail: product.Thumbnail || "",
      description: product.Description || "",
      donVi: product.DonVi || "",
      minPrice: Number(product.MinPrice) || 0,
      maxPrice: Number(product.MaxPrice) || 0,
      priceLabel:
        Number(product.MinPrice) === Number(product.MaxPrice)
          ? formatPrice(product.MinPrice)
          : `${formatPrice(product.MinPrice)} - ${formatPrice(product.MaxPrice)}`,
      status: product.Status,
      viewCount: Number(product.ViewCount) || 0,
      likeCount: Number(product.LikeCount) || 0,
      soldCount: Number(product.SoldCount) || 0,
      shopId: product.ShopId ? String(product.ShopId) : "",
      shopName: shop?.shopName || "",
      shopUsername: shop?.shopUsername || "",
      categoryId: product.CategoryId ? String(product.CategoryId) : "",
      categoryName: categoryMap.get(String(product.CategoryId || "")) || "",
      createdAt: product.CreatedAt || null,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getProductDetail(productId) {
  const objectId = toObjectId(productId);
  if (!objectId) {
    throw createServiceError("ID sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(objectId).lean();
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const [shop, category, variants] = await Promise.all([
    product.ShopId
      ? ShopProfile.findById(product.ShopId).select("shopName shopUsername avatar userId").lean()
      : null,
    product.CategoryId
      ? ProductCategory.findById(product.CategoryId).select("name categoryName").lean()
      : null,
    ProductVariant.find({ ProductId: objectId }).sort({ CreatedAt: 1 }).lean(),
  ]);

  return {
    id: String(product._id),
    productName: product.ProductName || "",
    thumbnail: product.Thumbnail || "",
    description: product.Description || "",
    donVi: product.DonVi || "",
    minPrice: Number(product.MinPrice) || 0,
    maxPrice: Number(product.MaxPrice) || 0,
    status: product.Status,
    viewCount: Number(product.ViewCount) || 0,
    likeCount: Number(product.LikeCount) || 0,
    soldCount: Number(product.SoldCount) || 0,
    shopId: product.ShopId ? String(product.ShopId) : "",
    shopName: shop?.shopName || "",
    categoryId: product.CategoryId ? String(product.CategoryId) : "",
    categoryName: category?.name || category?.categoryName || "",
    createdAt: product.CreatedAt || null,
    variants: variants.map((variant) => ({
      id: String(variant._id),
      variantName: variant.VariantName || "",
      price: Number(variant.Price) || 0,
      quantity: Number(variant.Quantity) || 0,
      soldCount: Number(variant.SoldCount) || 0,
      images: (variant.Images || []).map((image) => ({
        id: String(image._id || ""),
        imageUrl: image.ImageUrl || "",
      })),
    })),
  };
}

async function setProductStatus(productId, nextStatus) {
  const objectId = toObjectId(productId);
  if (!objectId) {
    throw createServiceError("ID sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(objectId);
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  product.Status = nextStatus;
  product.UpdatedAt = new Date();
  await product.save();
  return getProductDetail(productId);
}

async function deleteProduct(productId) {
  return setProductStatus(productId, PRODUCT_STATUS.HIDDEN);
}

async function listReservations(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search);
  const status = pickString(query.status);
  const shopId = toObjectId(query.shopId);

  const filter = {};
  if (status !== "" && Number.isFinite(Number(status))) {
    filter.status = Number(status);
  }
  if (shopId) {
    filter.shopId = shopId;
  }

  let reservationIdsBySearch = null;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const [users, shops, products] = await Promise.all([
      User.find({
        $or: [{ FullName: regex }, { UserName: regex }, { Email: regex }, { Phone: regex }],
      })
        .select("_id")
        .lean(),
      ShopProfile.find({ $or: [{ shopName: regex }, { shopUsername: regex }] })
        .select("_id")
        .lean(),
      Product.find({ ProductName: regex }).select("_id").lean(),
    ]);

    filter.$or = [
      { userId: { $in: users.map((item) => item._id) } },
      { shopId: { $in: shops.map((item) => item._id) } },
      { productId: { $in: products.map((item) => item._id) } },
      { note: regex },
      { cancelReason: regex },
    ];

    if (mongoose.Types.ObjectId.isValid(search)) {
      filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
    }
    reservationIdsBySearch = true;
  }

  const [total, reservations] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const userIds = [...new Set(reservations.map((item) => String(item.userId || "")).filter(Boolean))];
  const shopIds = [...new Set(reservations.map((item) => String(item.shopId || "")).filter(Boolean))];
  const productIds = [
    ...new Set(reservations.map((item) => String(item.productId || "")).filter(Boolean)),
  ];

  const [users, shops, products] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select("FullName UserName Email Phone Avatar").lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } }).select("shopName shopUsername").lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName Thumbnail").lean()
      : [],
  ]);

  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const shopMap = new Map(shops.map((item) => [String(item._id), item]));
  const productMap = new Map(products.map((item) => [String(item._id), item]));

  const items = reservations.map((item) => {
    const buyer = userMap.get(String(item.userId || ""));
    const shop = shopMap.get(String(item.shopId || ""));
    const product = productMap.get(String(item.productId || ""));
    return {
      id: String(item._id),
      code: String(item._id).slice(-8).toUpperCase(),
      status: item.status,
      statusLabel: RESERVATION_STATUS_LABELS[item.status] || "Không rõ",
      quantity: Number(item.quantity) || 0,
      reservedPrice: Number(item.reservedPrice) || 0,
      agreedPrice: Number(item.agreedPrice) || 0,
      pickupTime: item.pickupTime || null,
      note: item.note || "",
      cancelReason: item.cancelReason || "",
      createdAt: item.CreatedAt || null,
      buyer: buyer
        ? {
            id: String(buyer._id),
            fullName: buyer.FullName || "",
            userName: buyer.UserName || "",
            email: buyer.Email || "",
            phone: buyer.Phone || "",
          }
        : null,
      shop: shop
        ? {
            id: String(shop._id),
            shopName: shop.shopName || "",
            shopUsername: shop.shopUsername || "",
          }
        : null,
      product: product
        ? {
            id: String(product._id),
            productName: product.ProductName || "",
            thumbnail: product.Thumbnail || "",
          }
        : null,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    meta: { searched: Boolean(reservationIdsBySearch) },
  };
}

async function getReservationDetail(reservationId) {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId).lean();
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const [buyer, shop, product, variant] = await Promise.all([
    reservation.userId ? User.findById(reservation.userId).lean() : null,
    reservation.shopId ? ShopProfile.findById(reservation.shopId).lean() : null,
    reservation.productId ? Product.findById(reservation.productId).lean() : null,
    reservation.variantId ? ProductVariant.findById(reservation.variantId).lean() : null,
  ]);

  return {
    id: String(reservation._id),
    code: String(reservation._id).slice(-8).toUpperCase(),
    status: reservation.status,
    statusLabel: RESERVATION_STATUS_LABELS[reservation.status] || "Không rõ",
    quantity: Number(reservation.quantity) || 0,
    reservedPrice: Number(reservation.reservedPrice) || 0,
    agreedPrice: Number(reservation.agreedPrice) || 0,
    pickupTime: reservation.pickupTime || null,
    note: reservation.note || "",
    cancelReason: reservation.cancelReason || "",
    confirmedAt: reservation.confirmedAt || null,
    completedAt: reservation.completedAt || null,
    cancelledAt: reservation.cancelledAt || null,
    createdAt: reservation.CreatedAt || null,
    buyer: buyer
      ? {
          id: String(buyer._id),
          fullName: buyer.FullName || "",
          userName: buyer.UserName || "",
          email: buyer.Email || "",
          phone: buyer.Phone || "",
          avatar: buyer.Avatar || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName: shop.shopName || "",
          shopUsername: shop.shopUsername || "",
          address: shop.address || "",
          phone: shop.phone || "",
        }
      : null,
    product: product
      ? {
          id: String(product._id),
          productName: product.ProductName || "",
          thumbnail: product.Thumbnail || "",
        }
      : null,
    variant: variant
      ? {
          id: String(variant._id),
          variantName: variant.VariantName || "",
          price: Number(variant.Price) || 0,
        }
      : null,
  };
}

async function cancelReservation(reservationId, reason = "") {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (reservation.status === RESERVATION_STATUS.COMPLETED) {
    throw createServiceError("Không thể hủy đơn đã hoàn thành.", 400);
  }
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    return getReservationDetail(reservationId);
  }

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = new Date();
  reservation.cancelReason = pickString(reason) || "Admin hủy đơn.";
  reservation.UpdatedAt = new Date();

  if (reservation.depositPaidAt && Number(reservation.depositAmount) > 0 && reservation.userId) {
    const { creditWalletRefund } = require("./walletService");
    await creditWalletRefund(reservation.userId, reservation.depositAmount, {
      description: `Hoàn cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
    });
  }

  await reservation.save();

  return getReservationDetail(reservationId);
}

module.exports = {
  listShops,
  getShopDetail,
  setShopStatus,
  deleteShop,
  listProducts,
  getProductDetail,
  setProductStatus,
  deleteProduct,
  listReservations,
  getReservationDetail,
  cancelReservation,
  SHOP_STATUS,
  PRODUCT_STATUS,
};
