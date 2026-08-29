const mongoose = require("mongoose");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const ShopCategory = require("../models/ShopCategory");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductCategory = require("../models/ProductCategory");
const Reservation = require("../models/Reservation");
const ReservationDispute = require("../models/ReservationDispute");
const Report = require("../models/Report");
const Review = require("../models/Review");
const FavoriteProduct = require("../models/FavoriteProduct");
const SellerSubscription = require("../models/SellerSubscription");
const SellerVerification = require("../models/SellerVerification");
const Wallet = require("../models/Wallet");
const { resolveShopLatlong } = require("../utils/shopCoordinates");
const { reservationHasEscrowDeposit } = require("../utils/reservationCompat");
const { SHOP_STATUS, SHOP_OPEN, USER_STATUS, USER_ROLE } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const {
  RESERVATION_STATUS,
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_VERIFICATION_STATUS,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
} = require("../constants");
const { createNotification } = require("./notificationService");
const { emitAdminUpdated, emitUserResourceUpdated, emitPublicUpdated } = require("./realtimeService");
const { cancelActiveReservationsForShopLock } = require("./reservationService");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendStatusLabelSearchConditions,
  appendUniqueOrConditions,
  buildStatusLabelEntries,
  resolveStatusesFromLabelSearch,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");
const {
  getPickupConfirmedAt,
  getReservationCreatedAt,
  getReservationCancelNote,
} = require("../utils/reservationCompat");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const {
  isRemovedProduct,
  isAdminRemovedProduct,
  isSellerRemovedProduct,
  notRemovedProductMatch,
  removedProductMatch,
  adminRemovedProductFilter,
  sellerRemovedProductFilter,
  removedProductConditions,
  toAdminProductRemovalFields,
} = require("../utils/productRemoval");
const {
  notDeletedReviewFilter,
  toAdminReviewRemovalFields,
} = require("../utils/reviewRemoval");
const { PRODUCT_REMOVED_BY, isRecordActive } = require("../constants");

const SHOP_STATUS_LABELS = {
  [SHOP_STATUS.ACTIVE]: "Hoạt động",
  [SHOP_STATUS.BLOCKED]: "Đã khóa",
};

const SHOP_OPEN_LABELS = {
  [SHOP_OPEN.OPEN]: "Đang mở",
  [SHOP_OPEN.CLOSED]: "Đóng cửa",
};

const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: "Chờ shop xác nhận",
  [RESERVATION_STATUS.REJECTED]: "Đã từ chối",
  [RESERVATION_STATUS.WAITING_PICKUP]: "Chờ nhận hàng",
  [RESERVATION_STATUS.COMPLETED]: "Hoàn thành",
  [RESERVATION_STATUS.DISPUTED]: "Tranh chấp",
  [RESERVATION_STATUS.AUTO_COMPLETED]: "Tự hoàn thành",
  [RESERVATION_STATUS.CANCELLED]: "Đã hoàn cọc",
};

const CANCELLED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.CANCELLED,
];

const DISPUTE_RESERVATION_STATUSES = [RESERVATION_STATUS.DISPUTED];

const ADMIN_RESERVATION_STATUS_SEARCH = [
  ...buildStatusLabelEntries(RESERVATION_STATUS_LABELS),
  { label: "Hoàn thành", statuses: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
  { label: "Đã hủy", statuses: CANCELLED_RESERVATION_STATUSES },
  { label: "Giữ hàng", statuses: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.WAITING_PICKUP] },
  { label: "Tranh chấp", statuses: [RESERVATION_STATUS.DISPUTED] },
  { label: "Chờ xác nhận", statuses: [RESERVATION_STATUS.PENDING] },
];

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

/** Đã xóa = admin gỡ vi phạm hoặc seller tự gỡ. */
function resolveAdminProductStatusLabel(product) {
  if (isAdminRemovedProduct(product)) {
    return "Đã gỡ";
  }
  if (isSellerRemovedProduct(product)) {
    return "Người bán đã gỡ";
  }
  return Number(product?.Status) === PRODUCT_STATUS.ACTIVE ? "Đang hiện" : "Đã ẩn";
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
    const orConditions = [];
    const regex = buildSearchRegex(search);
    if (regex) {
      orConditions.push(
        { shopName: regex },
        { shopUsername: regex },
        { address: regex },
        { phone: regex },
        { description: regex }
      );
    }
    appendStatusLabelSearchConditions(orConditions, search, SHOP_STATUS_LABELS);
    const matchedOpenStatuses = resolveStatusesFromLabelSearch(search, [
      ...buildStatusLabelEntries(SHOP_OPEN_LABELS),
      { label: "Mở cửa", statuses: [SHOP_OPEN.OPEN] },
      { label: "Đóng", statuses: [SHOP_OPEN.CLOSED] },
    ]);
    if (matchedOpenStatuses.length) {
      orConditions.push({ isOpen: { $in: matchedOpenStatuses } });
    }
    orConditions.push(...buildObjectIdSearchConditions(search));
    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  applyCreatedAtRange(filter, query);

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
    const shopName = resolveShopDisplayName(shop, owner);
    const shopUsername = resolveShopUsername(shop, owner);
    return {
      id: String(shop._id),
      shopName,
      shopUsername,
      avatar: resolveShopAvatar(shop, owner),
      address: shop.addressHeThong || shop.DiaChiHeThong || shop.address || "",
      phone: owner?.Phone || shop.phone || "",
      categoryId: shop.categoryId ? String(shop.categoryId) : "",
      categoryName: categoryMap.get(String(shop.categoryId || "")) || "",
      status: shop.status,
      statusLabel: SHOP_STATUS_LABELS[shop.status] || "Không rõ",
      isOpen: shop.isOpen,
      isOpenLabel: SHOP_OPEN_LABELS[shop.isOpen] || "Không rõ",
      diemTB: Number(shop.diemTB) || 0,
      tongSP: Number(shop.tongSP) || 0,
      soNguoiTheo: Number(shop.soNguoiTheo) || 0,
      soldCount: Number(shop.soldCount) || 0,
      subscriptionActive: isRecordActive(shop.isActive),
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

  const recentReportSince = new Date();
  recentReportSince.setDate(recentReportSince.getDate() - 30);

  const [
    owner,
    category,
    products,
    reservations,
    reports,
    reviews,
    violationCount,
    orderStats,
    activeSubscription,
    verification,
    productCount,
    productEngagement,
    totalOrders,
    cancelledOrdersCount,
    disputeOrdersCount,
    recentReportCount,
    ownerWallet,
  ] = await Promise.all([
    shop.userId
      ? User.findById(shop.userId)
          .select("FullName UserName Email Phone Avatar Role Status SoTheoDoi")
          .lean()
      : null,
    shop.categoryId ? ShopCategory.findById(shop.categoryId).select("name").lean() : null,
    Product.find({ ShopId: objectId }).sort({ CreatedAt: -1 }).limit(50).lean(),
    Reservation.find({ shopId: objectId }).sort({ createdAt: -1 }).limit(30).lean(),
    Report.find({ shopId: objectId }).sort({ CreatedAt: -1 }).limit(20).lean(),
    Review.find({ storeId: String(objectId), ...notDeletedReviewFilter() })
      .sort({ CreatedAt: -1 })
      .limit(20)
      .lean(),
    Report.countDocuments({ shopId: objectId }),
    Reservation.aggregate([
      {
        $match: {
          shopId: objectId,
          status: {
            $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
          },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$quantity", 1] },
                { $ifNull: ["$agreedPrice", { $ifNull: ["$reservedPrice", 0] }] },
              ],
            },
          },
        },
      },
    ]),
    SellerSubscription.findOne({
      shopId: objectId,
      status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
    })
      .sort({ endDate: -1 })
      .lean(),
    shop.userId
      ? SellerVerification.findOne({ userId: shop.userId })
          .sort({ CreatedAt: -1 })
          .lean()
      : null,
    Product.countDocuments({ ShopId: objectId, ...notRemovedProductMatch() }),
    Product.aggregate([
      { $match: { ShopId: objectId, ...notRemovedProductMatch() } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: { $ifNull: ["$ViewCount", 0] } },
          totalLikes: { $sum: { $ifNull: ["$LikeCount", 0] } },
        },
      },
    ]),
    Reservation.countDocuments({ shopId: objectId }),
    Reservation.countDocuments({
      shopId: objectId,
      status: { $in: CANCELLED_RESERVATION_STATUSES },
    }),
    Reservation.countDocuments({
      shopId: objectId,
      status: { $in: DISPUTE_RESERVATION_STATUSES },
    }),
    Report.countDocuments({ shopId: objectId, CreatedAt: { $gte: recentReportSince } }),
    shop.userId ? Wallet.findOne({ userId: shop.userId }).select("balance").lean() : null,
  ]);

  const { loadProductImagesByProductIds, toPublicProductImages } = require("./productService");
  const imagesByProduct = await loadProductImagesByProductIds(products.map((item) => item._id));

  const orderSummary = orderStats[0] || { count: 0, revenue: 0 };
  const isVerified =
    verification?.status === SELLER_VERIFICATION_STATUS.APPROVED ||
    owner?.Role === USER_ROLE.SELLER;

  return {
    id: String(shop._id),
    shopName: resolveShopDisplayName(shop, owner),
    shopUsername: resolveShopUsername(shop, owner),
    avatar: resolveShopAvatar(shop, owner),
    shopAvatar: resolveShopAvatar(shop, owner),
    description: shop.description || "",
    address: shop.addressHeThong || shop.address || "",
    addressHeThong: shop.addressHeThong || shop.DiaChiHeThong || shop.address || "",
    systemAddress: shop.addressHeThong || shop.DiaChiHeThong || shop.address || "",
    phone: owner?.Phone || shop.phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    ...(() => {
      const coords = resolveShopLatlong(shop);
      return {
        latlong: coords,
        latitude: coords.lat,
        longitude: coords.long,
      };
    })(),
    categoryId: shop.categoryId ? String(shop.categoryId) : "",
    categoryName: category?.name || "",
    status: shop.status,
    statusLabel: SHOP_STATUS_LABELS[shop.status] || "Không rõ",
    isOpen: shop.isOpen,
    isOpenLabel: SHOP_OPEN_LABELS[shop.isOpen] || "Không rõ",
    diemTB: Number(shop.diemTB) || 0,
    tongSP: Number(productCount) || 0,
    tongDG: Number(shop.tongDG) || 0,
    totalTymViews: Number(productEngagement?.[0]?.totalViews) || 0,
    totalTym: Number(productEngagement?.[0]?.totalLikes) || 0,
    totalOrders: Number(totalOrders) || 0,
    totalCompletedOrders: Number(orderSummary.count) || 0,
    totalCancelledOrders: Number(cancelledOrdersCount) || 0,
    totalDisputes: Number(disputeOrdersCount) || 0,
    soNguoiTheo: Number(shop.soNguoiTheo) || 0,
    followingCount: Number(owner?.SoTheoDoi) || 0,
    recentReportCount: Number(recentReportCount) || 0,
    soldCount: Number(shop.soldCount) || 0,
    completedOrders: Number(orderSummary.count) || 0,
    totalRevenue: Number(orderSummary.revenue) || 0,
    walletBalance: Number(ownerWallet?.balance) || 0,
    violationCount: Number(violationCount) || 0,
    subscriptionActive: isRecordActive(shop.isActive),
    subscriptionPlan: activeSubscription?.planName || "",
    subscriptionStartAt: activeSubscription?.startDate || null,
    subscriptionExpiresAt: activeSubscription?.endDate || null,
    isVerified,
    verification: verification
      ? {
          status: verification.status,
          statusLabel:
            verification.status === SELLER_VERIFICATION_STATUS.APPROVED
              ? "Đã xác minh"
              : verification.status === SELLER_VERIFICATION_STATUS.PENDING
                ? "Chờ duyệt"
                : verification.status === SELLER_VERIFICATION_STATUS.REJECTED
                  ? "Từ chối"
                  : "Không rõ",
          anhCccdTruoc: verification.anhCccdTruoc || "",
          anhCccdSau: verification.anhCccdSau || "",
          selfieImage: verification.selfieImage || "",
          anhKD:
            verification.anhKD ||
            verification.businessDocImage ||
            verification.businessDoc?.imageUrl ||
            "",
          updatedAt: verification.UpdatedAt || verification.CreatedAt || null,
        }
      : null,
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
    products: products.map((product) => {
      const thumbs = toPublicProductImages(imagesByProduct.get(String(product._id)) || []).map(
        (image) => image.imageUrl
      );
      const legacy = Array.isArray(product.Thumbnail)
        ? product.Thumbnail.filter(Boolean)
        : product.Thumbnail
          ? [String(product.Thumbnail)]
          : [];
      return {
        id: String(product._id),
        productName: product.ProductName || "",
        thumbnail: thumbs[0] || legacy[0] || "",
        minPrice: Number(product.MinPrice) || 0,
        maxPrice: Number(product.MaxPrice) || 0,
        status: product.Status,
        soldCount: Number(product.SoldCount) || 0,
        likeCount: Number(product.LikeCount) || 0,
      };
    }),
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
      ...toAdminReviewRemovalFields(item),
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

  if (shop.status === nextStatus) {
    throw createServiceError(
      nextStatus === SHOP_STATUS.BLOCKED
        ? "Gian hàng đã bị khóa."
        : "Gian hàng đang hoạt động."
    );
  }

  if (nextStatus === SHOP_STATUS.ACTIVE) {
    const owner = await User.findById(shop.userId).select("Status").lean();
    if (owner?.Status === USER_STATUS.BLOCKED) {
      throw createServiceError(
        "Không thể mở khóa gian hàng khi tài khoản chủ shop đang bị khóa.",
        403
      );
    }
  }

  const now = new Date();
  shop.status = nextStatus;
  if (nextStatus === SHOP_STATUS.ACTIVE) {
    shop.suspendedUntil = null;
    shop.permanentlyClosedAt = null;
    shop.visibilityRestrictedUntil = null;
    shop.lockedAt = null;
  } else {
    shop.permanentlyClosedAt = shop.permanentlyClosedAt || now;
    shop.isOpen = SHOP_OPEN.CLOSED;
    shop.lockedAt = now;
  }
  shop.UpdatedAt = now;
  await shop.save();

  if (nextStatus === SHOP_STATUS.ACTIVE) {
    const { closePendingShopLockAppeals } = require("./lockAppealService");
    try {
      await closePendingShopLockAppeals(objectId, null);
    } catch (error) {
      console.error(
        "setShopStatus: close shop lock appeals on unblock failed:",
        String(objectId),
        error.message
      );
    }

    await Product.updateMany(
      { ShopId: objectId, Status: PRODUCT_STATUS.HIDDEN },
      { $set: { Status: PRODUCT_STATUS.ACTIVE, UpdatedAt: now } }
    );
  } else if (nextStatus === SHOP_STATUS.BLOCKED) {
    await Product.updateMany(
      { ShopId: objectId, Status: PRODUCT_STATUS.ACTIVE },
      { $set: { Status: PRODUCT_STATUS.HIDDEN, UpdatedAt: now } }
    );
    try {
      await cancelActiveReservationsForShopLock(objectId);
    } catch (error) {
      console.error(
        "setShopStatus: cancel reservations on shop lock failed:",
        String(objectId),
        error.message
      );
    }
  }

  emitUserResourceUpdated(shop.userId, "shop", {
    shopId: String(shop._id),
    shopStatus: nextStatus,
    locked: nextStatus === SHOP_STATUS.BLOCKED,
  });
  emitAdminUpdated("shop", {
    shopId: String(shop._id),
    userId: shop.userId ? String(shop.userId) : "",
    status: nextStatus,
    locked: nextStatus === SHOP_STATUS.BLOCKED,
  });

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
  shop.lockedAt = new Date();
  shop.UpdatedAt = new Date();
  await shop.save();

  await Product.updateMany(
    { ShopId: objectId },
    { $set: { Status: PRODUCT_STATUS.HIDDEN, UpdatedAt: new Date() } }
  );

  emitUserResourceUpdated(shop.userId, "shop", {
    shopId: String(shop._id),
    shopStatus: SHOP_STATUS.BLOCKED,
    locked: true,
  });
  emitAdminUpdated("shop", {
    shopId: String(shop._id),
    userId: shop.userId ? String(shop.userId) : "",
    status: SHOP_STATUS.BLOCKED,
    locked: true,
  });

  return { id: String(shop._id), deleted: true };
}

/** Nhóm trạng thái sản phẩm cho admin: active | hidden | removed. */
function resolveProductStatusGroup(status) {
  const raw = pickString(status).toLowerCase();
  if (raw === "removed" || raw === "deleted") {
    return "removed";
  }
  if (raw === "1" || raw === "active") {
    return "active";
  }
  if (raw === "0" || raw === "hidden") {
    return "hidden";
  }
  return "";
}

function withProductStatusGroup(baseFilter, group, removedBy = "") {
  let statusFilter;
  if (group === "removed") {
    const normalizedRemovedBy = pickString(removedBy).toLowerCase();
    if (normalizedRemovedBy === PRODUCT_REMOVED_BY.ADMIN) {
      statusFilter = adminRemovedProductFilter();
    } else if (normalizedRemovedBy === PRODUCT_REMOVED_BY.SELLER) {
      statusFilter = sellerRemovedProductFilter();
    } else {
      statusFilter = removedProductMatch();
    }
  } else if (group === "active") {
    statusFilter = { $and: [notRemovedProductMatch(), { Status: PRODUCT_STATUS.ACTIVE }] };
  } else if (group === "hidden") {
    statusFilter = { $and: [notRemovedProductMatch(), { Status: PRODUCT_STATUS.HIDDEN }] };
  }

  if (!statusFilter) {
    return { ...baseFilter };
  }
  if (!Object.keys(baseFilter).length) {
    return statusFilter;
  }
  return { $and: [baseFilter, statusFilter] };
}

async function listProducts(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search).replace(/^@+/, "");
  const statusGroup = resolveProductStatusGroup(query.status);
  const removedBy = pickString(query.removedBy);
  const shopId = toObjectId(query.shopId);
  const categoryId = toObjectId(query.categoryId);

  const filter = {};
  if (shopId) {
    filter.ShopId = shopId;
  }
  if (categoryId) {
    filter.CategoryId = categoryId;
  }
  if (search) {
    const orConditions = [];
    const regex = buildSearchRegex(search);
    if (regex) {
      const matchedUsers = await findUsersBySearchRegex(User, regex, ["FullName", "UserName"]);
      const matchedShopIds = matchedUsers.length
        ? (
            await ShopProfile.find({
              userId: { $in: matchedUsers.map((user) => user._id) },
            })
              .select("_id")
              .lean()
          ).map((shop) => shop._id)
        : [];

      orConditions.push(
        { ProductName: regex },
        { Description: regex },
        { DonVi: regex },
        ...(matchedShopIds.length ? [{ ShopId: { $in: matchedShopIds } }] : [])
      );

      const matchedShops = await ShopProfile.find({
        $or: [{ shopName: regex }, { shopUsername: regex }],
      })
        .select("_id")
        .lean();
      if (matchedShops.length) {
        orConditions.push({ ShopId: { $in: matchedShops.map((shop) => shop._id) } });
      }
    }

    const matchedProductStatuses = resolveStatusesFromLabelSearch(search, [
      { label: "Đang bán", statuses: [PRODUCT_STATUS.ACTIVE] },
      { label: "Ẩn", statuses: [PRODUCT_STATUS.HIDDEN] },
    ]);
    if (matchedProductStatuses.length) {
      orConditions.push({ Status: { $in: matchedProductStatuses } });
    }

    orConditions.push(...buildObjectIdSearchConditions(search));
    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  applyCreatedAtRange(filter, query);

  const listFilter = withProductStatusGroup(filter, statusGroup, removedBy);

  const summaryAgg = await Product.aggregate([
    { $match: filter },
    {
      $facet: {
        total: [{ $count: "count" }],
        visible: [
          {
            $match: {
              $and: [notRemovedProductMatch(), { Status: PRODUCT_STATUS.ACTIVE }],
            },
          },
          { $count: "count" },
        ],
        hidden: [
          {
            $match: {
              $and: [notRemovedProductMatch(), { Status: PRODUCT_STATUS.HIDDEN }],
            },
          },
          { $count: "count" },
        ],
        removed: [{ $match: removedProductMatch() }, { $count: "count" }],
      },
    },
  ]);

  const summaryBucket = summaryAgg[0] || {};
  const summaryTotal = Number(summaryBucket.total?.[0]?.count) || 0;
  const summaryVisible = Number(summaryBucket.visible?.[0]?.count) || 0;
  const summaryHidden = Number(summaryBucket.hidden?.[0]?.count) || 0;
  const summaryRemoved = Number(summaryBucket.removed?.[0]?.count) || 0;

  const [total, products] = await Promise.all([
    Product.countDocuments(listFilter),
    Product.find(listFilter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const shopIds = [...new Set(products.map((item) => String(item.ShopId || "")).filter(Boolean))];
  const categoryIds = [
    ...new Set(products.map((item) => String(item.CategoryId || "")).filter(Boolean)),
  ];

  const [shops, categories] = await Promise.all([
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } })
          .select("userId shopName shopUsername avatar")
          .lean()
      : [],
    categoryIds.length
      ? ProductCategory.find({ _id: { $in: categoryIds } }).select("name").lean()
      : [],
  ]);

  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } }).select("FullName UserName").lean()
    : [];
  const ownerMap = new Map(owners.map((user) => [String(user._id), user]));
  const shopMap = new Map(
    shops.map((shop) => {
      const owner = ownerMap.get(String(shop.userId || ""));
      return [
        String(shop._id),
        {
          id: String(shop._id),
          shopName: resolveShopDisplayName(shop, owner),
          shopUsername: resolveShopUsername(shop, owner),
          shopAvatar: resolveShopAvatar(shop, owner),
          ownerId: shop.userId ? String(shop.userId) : "",
        },
      ];
    })
  );
  const categoryMap = new Map(
    categories.map((item) => [String(item._id), item.name || ""])
  );

  const { loadProductImagesByProductIds, toPublicProductImages } = require("./productService");
  const imagesByProduct = await loadProductImagesByProductIds(products.map((item) => item._id));
  const productIds = products.map((item) => item._id);
  const stockRows = productIds.length
    ? await ProductVariant.aggregate([
        { $match: { ProductId: { $in: productIds } } },
        {
          $group: {
            _id: "$ProductId",
            totalStock: { $sum: { $ifNull: ["$Quantity", 0] } },
          },
        },
      ])
    : [];
  const stockMap = new Map(
    stockRows.map((row) => [String(row._id), Math.max(0, Number(row.totalStock) || 0)])
  );

  const items = products.map((product) => {
    const shop = shopMap.get(String(product.ShopId || ""));
    const thumbs = toPublicProductImages(imagesByProduct.get(String(product._id)) || []).map(
      (image) => image.imageUrl
    );
    const legacy = Array.isArray(product.Thumbnail)
      ? product.Thumbnail.filter(Boolean)
      : product.Thumbnail
        ? [String(product.Thumbnail)]
        : [];
    const thumbnail = thumbs[0] || legacy[0] || "";
    const { buildAdminProductPriceFields } = require("./productPromotionService");
    return {
      id: String(product._id),
      productName: product.ProductName || "",
      thumbnail,
      description: product.Description || "",
      donVi: product.DonVi || "",
      ...buildAdminProductPriceFields(product),
      status: product.Status,
      ...toAdminProductRemovalFields(product),
      statusLabel: resolveAdminProductStatusLabel(product),
      viewCount: Number(product.ViewCount) || 0,
      likeCount: Number(product.LikeCount) || 0,
      soldCount: Number(product.SoldCount) || 0,
      shopId: product.ShopId ? String(product.ShopId) : "",
      shopName: shop?.shopName || "",
      shopUsername: shop?.shopUsername || "",
      shopAvatar: shop?.shopAvatar || "",
      categoryId: product.CategoryId ? String(product.CategoryId) : "",
      categoryName: categoryMap.get(String(product.CategoryId || "")) || "",
      stock: stockMap.get(String(product._id)) ?? 0,
      totalStock: stockMap.get(String(product._id)) ?? 0,
      createdAt: product.CreatedAt || null,
    };
  });

  return {
    items,
    summary: {
      total: summaryTotal,
      visible: summaryVisible,
      hidden: summaryHidden,
      removed: summaryRemoved,
    },
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

  const [shop, category, variants, imageDocs, favoriteCount, reviewAgg, reportCount] =
    await Promise.all([
      product.ShopId
        ? ShopProfile.findById(product.ShopId)
            .select("userId shopName shopUsername avatar")
            .lean()
        : null,
      product.CategoryId
        ? ProductCategory.findById(product.CategoryId).select("name").lean()
        : null,
      ProductVariant.find({ ProductId: objectId }).sort({ CreatedAt: 1 }).lean(),
      require("./productService").loadProductImages(objectId),
      FavoriteProduct.countDocuments({ productId: objectId }),
      Review.aggregate([
        {
          $match: {
            $and: [{ productId: objectId }, notDeletedReviewFilter()],
          },
        },
        {
          $group: {
            _id: null,
            reviewCount: { $sum: 1 },
            diemTB: { $avg: "$rating" },
          },
        },
      ]),
      Report.countDocuments({ productId: objectId }),
    ]);

  const reservationMatch = {
    $or: [
      { productId: objectId },
      ...(variants.length ? [{ variantId: { $in: variants.map((variant) => variant._id) } }] : []),
    ],
  };
  const reservationAgg = await Reservation.aggregate([
    { $match: reservationMatch },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const owner = shop?.userId
    ? await User.findById(shop.userId).select("FullName UserName Avatar").lean()
    : null;
  const shopName = resolveShopDisplayName(shop, owner);
  const shopUsername = resolveShopUsername(shop, owner);
  const shopAvatar = resolveShopAvatar(shop, owner);

  const reservationsByStatus = {};
  let reservationCount = 0;
  reservationAgg.forEach((row) => {
    reservationsByStatus[row._id] = row.count;
    reservationCount += row.count;
  });
  const completedReservations =
    (reservationsByStatus[RESERVATION_STATUS.COMPLETED] || 0) +
    (reservationsByStatus[RESERVATION_STATUS.AUTO_COMPLETED] || 0);
  const pendingReservations =
    (reservationsByStatus[RESERVATION_STATUS.PENDING] || 0) +
    (reservationsByStatus[RESERVATION_STATUS.WAITING_PICKUP] || 0);
  const reviewSummary = reviewAgg[0] || {};
  const reviewCount = Number(reviewSummary.reviewCount) || 0;
  const diemTB = reviewSummary.diemTB
    ? Math.round(Number(reviewSummary.diemTB) * 10) / 10
    : 0;
  const viewCount = Number(product.ViewCount) || 0;
  const likeCount = Number(product.LikeCount) || 0;
  const likeRate = viewCount > 0 ? Number(((likeCount / viewCount) * 100).toFixed(1)) : 0;
  const favoriteRate =
    viewCount > 0 ? Number(((favoriteCount / viewCount) * 100).toFixed(1)) : 0;

  const { toPublicProductImages } = require("./productService");
  const thumbnails = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  const legacyThumbs = Array.isArray(product.Thumbnail)
    ? product.Thumbnail.filter(Boolean)
    : product.Thumbnail
      ? [product.Thumbnail]
      : [];
  const gallery = thumbnails.length > 0 ? thumbnails : legacyThumbs;
  const { buildAdminProductPriceFields } = require("./productPromotionService");
  const mappedVariants = variants.map((variant) => {
    const imageUrl =
      variant.ImageUrl ||
      (Array.isArray(variant.Images) ? variant.Images[0]?.ImageUrl : "") ||
      "";
    const quantity = Number(variant.Quantity) || 0;
    return {
      id: String(variant._id),
      variantName: variant.VariantName || "",
      price: Number(variant.Price) || 0,
      quantity,
      stock: quantity,
      soldCount: Number(variant.SoldCount) || 0,
      imageUrl,
      images: imageUrl ? [{ id: "", imageUrl }] : [],
    };
  });
  const totalStock = mappedVariants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);

  return {
    id: String(product._id),
    productName: product.ProductName || "",
    thumbnail: gallery[0] || "",
    thumbnails: gallery,
    images: toPublicProductImages(imageDocs),
    description: product.Description || "",
    donVi: product.DonVi || "",
    ...buildAdminProductPriceFields(product),
    status: product.Status,
    ...toAdminProductRemovalFields(product),
    statusLabel: resolveAdminProductStatusLabel(product),
    viewCount,
    likeCount: likeCount,
    likeRate,
    favoriteRate,
    soldCount: Number(product.SoldCount) || 0,
    favoriteCount,
    reservationCount,
    completedReservations,
    pendingReservations,
    reviewCount,
    diemTB,
    reportCount: Number(reportCount) || 0,
    reservationsByStatus,
    // % lượt xem chuyển thành đơn giữ hàng.
    conversionRate: viewCount > 0 ? Number(((reservationCount / viewCount) * 100).toFixed(2)) : 0,
    productCode: String(product._id).slice(-8).toUpperCase(),
    verificationCode: String(product._id).slice(-12).toUpperCase(),
    promotionStartDate: product.NgayKmBD || null,
    promotionEndDate: product.NgayKmKT || null,
    pinProduct: Number(product.pinProduct) || 0,
    shopId: product.ShopId ? String(product.ShopId) : "",
    shopName,
    shopUsername,
    shopAvatar,
    avatar: shopAvatar,
    categoryId: product.CategoryId ? String(product.CategoryId) : "",
    categoryName: category?.name || "",
    createdAt: product.CreatedAt || null,
    updatedAt: product.UpdatedAt || null,
    stock: totalStock,
    totalStock,
    variants: mappedVariants,
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
  const detail = await getProductDetail(productId);
  emitAdminUpdated("product", {
    productId: String(product._id),
    shopId: String(product.ShopId || ""),
    status: Number(nextStatus),
  });
  if (product.ShopId) {
    const shop = await ShopProfile.findById(product.ShopId).select("userId").lean();
    if (shop?.userId) {
      emitUserResourceUpdated(shop.userId, "product", {
        productId: String(product._id),
        status: Number(nextStatus),
      });
    }
  }
  emitPublicUpdated("product", { productId: String(product._id), status: Number(nextStatus) });
  return detail;
}

async function deleteProduct(productId, reason = "") {
  return removeProductForViolation(productId, reason);
}

async function removeProductForViolation(productId, reason = "") {
  const lyDoVP = pickString(reason);
  if (!lyDoVP) {
    throw createServiceError("Vui lòng nhập lý do vi phạm.", 400);
  }

  const objectId = toObjectId(productId);
  if (!objectId) {
    throw createServiceError("ID sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(objectId);
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }
  if (isAdminRemovedProduct(product)) {
    throw createServiceError("Sản phẩm đã được gỡ trước đó.", 400);
  }
  if (isSellerRemovedProduct(product)) {
    throw createServiceError("Người bán đã gỡ sản phẩm này, không cần gỡ thêm.", 400);
  }

  const now = new Date();
  product.Status = PRODUCT_STATUS.HIDDEN;
  product.IsDeleted = 0;
  product.RemovedBy = PRODUCT_REMOVED_BY.ADMIN;
  product.LyDoGo = lyDoVP;
  product.RemovedAt = now;
  product.pinProduct = 0;
  product.IsPromotion = false;
  product.PtGiam = 0;
  product.NgayKmBD = null;
  product.NgayKmKT = null;
  product.UpdatedAt = now;
  await product.save();

  const shop = product.ShopId ? await ShopProfile.findById(product.ShopId) : null;
  if (shop) {
    const { syncShopProductStats } = require("./productService");
    await syncShopProductStats(shop);

    if (shop.userId) {
      const productName = String(product.ProductName || "Sản phẩm").trim();
      await createNotification(shop.userId, {
        title: "Sản phẩm bị gỡ",
        content: `Sản phẩm "${productName}" đã bị gỡ khỏi hệ thống vì vi phạm: ${lyDoVP}.`,
        audience: NOTIFICATION_AUDIENCE.SELLER,
        index: NOTIFICATION_INDEX.SYSTEM,
      });
    }
  }

  const detail = await getProductDetail(productId);
  emitAdminUpdated("product", {
    productId: String(product._id),
    shopId: String(product.ShopId || ""),
    removed: true,
  });
  if (shop?.userId) {
    emitUserResourceUpdated(shop.userId, "product", {
      productId: String(product._id),
      removed: true,
    });
  }
  emitPublicUpdated("product", { productId: String(product._id), removed: true });
  return detail;
}

async function listReservations(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search);
  const status = pickString(query.status);
  const shopId = toObjectId(query.shopId);
  const productId = toObjectId(query.productId);

  const filter = {};
  if (status !== "" && Number.isFinite(Number(status))) {
    filter.status = Number(status);
  }
  if (shopId) {
    filter.shopId = shopId;
  }
  if (productId) {
    const variantIds = await ProductVariant.find({ ProductId: productId }).distinct("_id");
    const conditions = [{ productId }];
    if (variantIds.length) {
      conditions.push({ variantId: { $in: variantIds } });
    }
    filter.$and = [{ $or: conditions }];
  }

  if (search) {
    const orConditions = [];
    const regex = buildSearchRegex(search);

    if (regex) {
      const [matchedUsers, matchedShops, matchedProducts] = await Promise.all([
        findUsersBySearchRegex(User, regex),
        ShopProfile.find({ $or: [{ shopName: regex }, { shopUsername: regex }] })
          .select("_id")
          .lean(),
        Product.find({ ProductName: regex }).select("_id").lean(),
      ]);

      orConditions.push(
        { userId: { $in: matchedUsers.map((item) => item._id) } },
        { shopId: { $in: matchedShops.map((item) => item._id) } },
        { productId: { $in: matchedProducts.map((item) => item._id) } },
        { note: regex },
        { cancelNote: regex },
        { cancelNote: regex },
      );

      const matchedDisputes = await ReservationDispute.find({
        $or: [{ buyerContent: regex }, { sellerContent: regex }],
      })
        .select("reservationId")
        .lean();
      if (matchedDisputes.length) {
        orConditions.push({
          _id: { $in: matchedDisputes.map((row) => row.reservationId).filter(Boolean) },
        });
      }
    }

    orConditions.push(...buildObjectIdSearchConditions(search));
    const matchedStatuses = resolveStatusesFromLabelSearch(search, ADMIN_RESERVATION_STATUS_SEARCH);
    if (matchedStatuses.length) {
      orConditions.push({ status: { $in: matchedStatuses } });
    }

    if (!productId && mongoose.Types.ObjectId.isValid(search)) {
      orConditions.push({ productId: new mongoose.Types.ObjectId(search) });
    }

    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  const [total, reservations] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter).sort({ createdAt: -1, updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
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
      cancelNote: getReservationCancelNote(item),
      createdAt: item.CreatedAt || null,
      productId: item.productId ? String(item.productId) : "",
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
    cancelNote: getReservationCancelNote(reservation),
    confirmedAt: reservation.confirmedAt || null,
    tgNhanHang: getPickupConfirmedAt(reservation),
    completedAt: getPickupConfirmedAt(reservation),
    cancelledAt: reservation.cancelledAt || null,
    createdAt: getReservationCreatedAt(reservation),
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
          address: shop.addressHeThong || shop.address || "",
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

  if (
    reservation.status === RESERVATION_STATUS.COMPLETED ||
    reservation.status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    throw createServiceError("Không thể hủy đơn đã hoàn thành.", 400);
  }
  if (
    reservation.status === RESERVATION_STATUS.CANCELLED ||
    reservation.status === RESERVATION_STATUS.REJECTED
  ) {
    return getReservationDetail(reservationId);
  }

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = new Date();
  reservation.cancelNote = pickString(reason) || "Admin hủy đơn.";
  reservation.updatedAt = new Date();

  if (reservationHasEscrowDeposit(reservation) && reservation.userId) {
    const { refundDepositIfHeld } = require("./reservationService");
    await refundDepositIfHeld(reservation);
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
  removeProductForViolation,
  listReservations,
  getReservationDetail,
  cancelReservation,
  SHOP_STATUS,
  PRODUCT_STATUS,
  isAdminRemovedProduct,
  isSellerRemovedProduct,
  isRemovedProduct,
  removedProductConditions,
  removedProductMatch,
  notRemovedProductMatch,
  resolveAdminProductStatusLabel,
};
