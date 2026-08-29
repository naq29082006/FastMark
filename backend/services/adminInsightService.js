const mongoose = require("mongoose");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const WithdrawRequest = require("../models/WithdrawRequest");
const SystemWallet = require("../models/SystemWallet");
const Reservation = require("../models/Reservation");
const ReservationDispute = require("../models/ReservationDispute");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");
const {
  buyerIdFilter,
  getPickupConfirmedAt,
  getReservationUpdatedAt,
  reservationCompletedWindowMatch,
} = require("../utils/reservationCompat");
const { buildReportsReceivedFilter, resolveReportTypeLabel } = require("../utils/reportType");
const Report = require("../models/Report");
const Review = require("../models/Review");
const SellerSubscription = require("../models/SellerSubscription");
const SellerBannerPlan = require("../models/SellerBannerPlan");
const {
  USER_ROLE,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  REPORT_TYPE_LABELS,
  REPORT_STATUS,
  REPORT_STATUS_LABELS,
  REPORT_REPORTER_ROLE_LABELS,
  PRODUCT_STATUS,
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_TYPE_LABEL,
  WALLET_TX_STATUS_LABEL,
  WALLET_REFERENCE_TYPE,
  WITHDRAW_STATUS,
  WITHDRAW_STATUS_LABEL,
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_SUBSCRIPTION_STATUS_LABEL,
  SELLER_BANNER_STATUS,
  SELLER_BANNER_STATUS_LABEL,
  BANNER_TARGET_TYPE_LABEL,
} = require("../constants");
const {
  resolveShopDisplayName,
  resolveShopUsername,
} = require("../utils/shopIdentity");
const { buildAdminProductPriceFields } = require("./productPromotionService");
const {
  removedProductConditions,
  notRemovedProductMatch,
  resolveAdminProductStatusLabel,
} = require("./adminCatalogService");
const { toAdminProductRemovalFields, removedProductMatch } = require("../utils/productRemoval");
const {
  notDeletedReviewFilter,
  deletedReviewFilter,
  publicReviewFilter,
  adminHiddenReviewFilter,
  toAdminReviewRemovalFields,
} = require("../utils/reviewRemoval");
const {
  disputeViewFromRecord,
  loadDisputesByReservationIds,
} = require("../utils/reservationDisputeView");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendNumericFieldSearchConditions,
} = require("../utils/adminSearchHelpers");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function resolveHistoryStatusGroup(query = {}) {
  const group = String(query.status || query.statusGroup || "").trim();
  return group && group !== "all" ? group : "";
}

function applyHistoryStatusFilter(baseFilter, tab, statusGroup) {
  const group = String(statusGroup || "").trim();
  if (!group || group === "all") {
    return baseFilter;
  }

  if (tab === "reservations" || tab === "shop-reservations") {
    const code = Number(group);
    if (!Number.isFinite(code)) {
      return baseFilter;
    }
    const statuses =
      code === RESERVATION_STATUS.CANCELLED
        ? [RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.CANCELLED]
        : [code];
    return { ...baseFilter, status: { $in: statuses } };
  }

  if (tab === "reports-filed" || tab === "reports-received" || tab === "reports") {
    const code = Number(group);
    if (!Number.isFinite(code)) {
      return baseFilter;
    }
    return { ...baseFilter, status: code };
  }

  if (tab === "wallet") {
    const code = Number(group);
    if (!Number.isFinite(code)) {
      return baseFilter;
    }
    return { ...baseFilter, status: code };
  }

  if (tab === "withdrawals") {
    const code = Number(group);
    if (!Number.isFinite(code)) {
      return baseFilter;
    }
    return { ...baseFilter, status: code };
  }

  if (tab === "products") {
    if (group === "active") {
      return {
        ...baseFilter,
        ...notRemovedProductMatch(),
        Status: PRODUCT_STATUS.ACTIVE,
      };
    }
    if (group === "hidden") {
      return {
        ...baseFilter,
        ...notRemovedProductMatch(),
        Status: PRODUCT_STATUS.HIDDEN,
      };
    }
    if (group === "removed") {
      return { ...baseFilter, ...removedProductMatch() };
    }
    return baseFilter;
  }

  if (tab === "reviews" || tab === "shop-reviews") {
    if (group === "visible") {
      return { ...baseFilter, ...publicReviewFilter() };
    }
    if (group === "hidden") {
      return {
        ...baseFilter,
        $and: [notDeletedReviewFilter(), adminHiddenReviewFilter()],
      };
    }
    if (group === "deleted") {
      return { ...baseFilter, ...deletedReviewFilter() };
    }
    return baseFilter;
  }

  if (tab === "seller-subscriptions") {
    const code = Number(group);
    if (!Number.isFinite(code)) {
      return baseFilter;
    }
    return { ...baseFilter, status: code };
  }

  if (tab === "seller-banners") {
    const code = Number(group);
    if (!Number.isFinite(code)) {
      return baseFilter;
    }
    return { ...baseFilter, status: code };
  }

  return baseFilter;
}

function walletTxReservationId(tx) {
  if (String(tx?.referenceType || "") === WALLET_REFERENCE_TYPE.RESERVATION && tx?.referenceId) {
    return String(tx.referenceId);
  }
  return null;
}

function toWalletTxItem(tx) {
  return {
    id: String(tx._id),
    type: tx.type,
    typeLabel: WALLET_TX_TYPE_LABEL[tx.type] || "Không rõ",
    amount: tx.amount,
    status: tx.status,
    statusLabel: WALLET_TX_STATUS_LABEL[tx.status] || "Không rõ",
    description: tx.description || "",
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    orderCode: tx.orderCode,
    referenceType: tx.referenceType || "",
    referenceId: tx.referenceId ? String(tx.referenceId) : null,
    reservationId: walletTxReservationId(tx),
    createdAt: tx.CreatedAt || null,
  };
}

function toWithdrawItem(item) {
  return {
    id: String(item._id),
    amount: item.amount,
    status: item.status,
    statusLabel: WITHDRAW_STATUS_LABEL[item.status] || "Không rõ",
    bankName: item.bankName || "",
    bankCode: item.bankCode || "",
    accountNumber: item.accountNumber || "",
    accountName: item.accountName || "",
    adminNote: item.adminNote || "",
    tgXuLy: item.tgXuLy || null,
    createdAt: item.CreatedAt || null,
  };
}

function populatedReservationBuyer(reservation) {
  const ref = reservation?.userId || null;
  return ref && typeof ref === "object" && ref._id ? ref : null;
}

function toReservationItem(reservation, disputeRecord = null) {
  const product = reservation.productId || null;
  const shop = reservation.shopId || null;
  const buyer = populatedReservationBuyer(reservation);
  const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
  const totalPrice =
    (Number(reservation.reservedPrice) || 0) * (Number(reservation.quantity) || 0);
  const disputeView = disputeViewFromRecord(disputeRecord);

  return {
    id: String(reservation._id),
    status: reservation.status,
    statusLabel: RESERVATION_STATUS_LABEL[reservation.status] || "Không rõ",
    quantity: reservation.quantity || 0,
    reservedPrice: reservation.reservedPrice || 0,
    totalPrice,
    depositAmount: reservation.depositAmount || 0,
    cocChuyenDen: reservation.cocChuyenDen,
    pickupTime: reservation.pickupTime || null,
    disputeByBuyer: disputeView.disputeByBuyer,
    disputeBySeller: disputeView.disputeBySeller,
    createdAt: reservation.CreatedAt || null,
    completedAt: getPickupConfirmedAt(reservation),
    tgNhanHang: getPickupConfirmedAt(reservation),
    product: product
      ? {
          id: String(product._id),
          name: product.ProductName || product.Name || product.name || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName: resolveShopDisplayName(shop, shopOwner),
          shopUsername: resolveShopUsername(shop, shopOwner),
        }
      : null,
    buyer: buyer
      ? {
          id: String(buyer._id),
          userName: buyer.UserName || "",
          fullName: buyer.FullName || "",
          email: buyer.Email || "",
        }
      : null,
  };
}

async function mapReservationHistoryItems(rows) {
  const disputesMap = await loadDisputesByReservationIds(rows.map((row) => row._id));
  return rows.map((row) =>
    toReservationItem(row, disputesMap.get(String(row._id)) || null)
  );
}

function toReportItem(report) {
  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: resolveReportTypeLabel(report.reportType),
    status: report.status,
    statusLabel: REPORT_STATUS_LABELS[report.status] || "Không rõ",
    title: report.title || "",
    content: report.content || "",
    reservationId: report.reservationId ? String(report.reservationId) : null,
    createdAt: report.CreatedAt || null,
    tgXuLy: report.tgXuLy || null,
  };
}

function toSellerSubscriptionHistoryItem(subscription) {
  const amount = Number(subscription.amount) || 0;
  return {
    id: String(subscription._id),
    planName: subscription.planName || "",
    amount,
    amountLabel: `${amount.toLocaleString("vi-VN")} đ`,
    status: subscription.status,
    statusLabel: SELLER_SUBSCRIPTION_STATUS_LABEL[subscription.status] || "Không rõ",
    startDate: subscription.startDate || null,
    endDate: subscription.endDate || null,
    ngayMua: subscription.ngayMua || subscription.CreatedAt || null,
    createdAt: subscription.CreatedAt || null,
    orderCode: subscription.orderCode || null,
  };
}

function toSellerBannerHistoryItem(banner) {
  const amount = Number(banner.amount) || 0;
  return {
    id: String(banner._id),
    planName: banner.planName || "",
    amount,
    amountLabel: `${amount.toLocaleString("vi-VN")} đ`,
    status: banner.status,
    statusLabel: SELLER_BANNER_STATUS_LABEL[banner.status] || "Không rõ",
    image: banner.image || "",
    targetType: banner.targetType,
    targetTypeLabel: BANNER_TARGET_TYPE_LABEL[banner.targetType] || "",
    targetId: banner.targetId || "",
    startDate: banner.startDate || null,
    endDate: banner.endDate || null,
    ngayMua: banner.ngayMua || banner.CreatedAt || null,
    createdAt: banner.CreatedAt || null,
    lyDoVP: banner.lyDoVP || "",
    clickCount: Number(banner.clickCount) || 0,
  };
}

function toReviewItem(review) {
  const product = review.productId || null;
  const shop = review.shopId || null;
  const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
  return {
    id: String(review._id),
    rating: review.rating || 0,
    comment: review.comment || "",
    ...toAdminReviewRemovalFields(review),
    createdAt: review.CreatedAt || null,
    product: product
      ? {
          id: String(product._id),
          name: product.ProductName || product.Name || product.name || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName: resolveShopDisplayName(shop, shopOwner),
        }
      : null,
  };
}

function toProductHistoryItem(product, shopId, imagesByProduct) {
  const { toPublicProductImages } = require("./productService");
  const category = product.CategoryId || null;
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
    categoryName: category?.name || "",
    donVi: product.DonVi || "",
    ...buildAdminProductPriceFields(product),
    ...toAdminProductRemovalFields(product),
    status: product.Status,
    statusLabel: resolveAdminProductStatusLabel(product),
    viewCount: Number(product.ViewCount) || 0,
    likeCount: Number(product.LikeCount) || 0,
    soldCount: Number(product.SoldCount) || 0,
    shopId: String(shopId),
    createdAt: product.CreatedAt || null,
  };
}

/**
 * Lịch sử hoạt động của một tài khoản theo tab (phục vụ trang chi tiết user).
 * tab: wallet | withdrawals | reservations | shop-reservations |
 *      reports-filed | reports-received | reviews
 */
async function getAccountHistory(userId, query = {}) {
  const user = await User.findById(userId).select("_id Role").lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }

  const tab = String(query.tab || "wallet");
  const { page, limit, skip } = parsePagination(query);
  const statusGroup = resolveHistoryStatusGroup(query);

  if (tab === "wallet") {
    const filter = applyHistoryStatusFilter({ userId: user._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      WalletTransaction.countDocuments(filter),
      WalletTransaction.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toWalletTxItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "withdrawals") {
    const filter = applyHistoryStatusFilter({ userId: user._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      WithdrawRequest.countDocuments(filter),
      WithdrawRequest.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toWithdrawItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "reservations") {
    const filter = applyHistoryStatusFilter(buyerIdFilter(user._id), tab, statusGroup);
    const [total, rows] = await Promise.all([
      Reservation.countDocuments(filter),
      Reservation.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate("userId", "FullName UserName Email")
        .populate({
          path: "shopId",
          select: "userId",
          populate: { path: "userId", select: "FullName UserName" },
        })
        .lean(),
    ]);
    return {
      tab,
      items: await mapReservationHistoryItems(rows),
      pagination: buildPagination(page, limit, total),
    };
  }

  if (tab === "shop-reservations") {
    const shop = await ShopProfile.findOne({ userId: user._id }).select("_id").lean();
    if (!shop) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }
    const filter = applyHistoryStatusFilter({ shopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Reservation.countDocuments(filter),
      Reservation.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate("userId", "UserName FullName Email")
        .populate("userId", "UserName FullName Email")
        .lean(),
    ]);
    return {
      tab,
      items: await mapReservationHistoryItems(rows),
      pagination: buildPagination(page, limit, total),
    };
  }

  if (tab === "reports-filed" || tab === "reports-received") {
    const baseFilter =
      tab === "reports-filed"
        ? { userId: user._id }
        : await buildReportsReceivedFilter(user._id);
    const filter = applyHistoryStatusFilter(baseFilter, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toReportItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "reviews") {
    const filter = applyHistoryStatusFilter({ userId: user._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate({
          path: "shopId",
          select: "userId",
          populate: { path: "userId", select: "FullName UserName" },
        })
        .lean(),
    ]);
    return { tab, items: rows.map(toReviewItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "products") {
    const shop = await ShopProfile.findOne({ userId: user._id }).select("_id").lean();
    if (!shop) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }

    const filter = applyHistoryStatusFilter({ ShopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("CategoryId", "name")
        .lean(),
    ]);

    const { loadProductImagesByProductIds } = require("./productService");
    const imagesByProduct = await loadProductImagesByProductIds(rows.map((item) => item._id));

    const items = rows.map((product) =>
      toProductHistoryItem(product, shop._id, imagesByProduct)
    );

    return { tab, items, pagination: buildPagination(page, limit, total) };
  }

  if (tab === "shop-reviews") {
    const shop = await ShopProfile.findOne({ userId: user._id }).select("_id").lean();
    if (!shop) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }
    const filter = applyHistoryStatusFilter({ shopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate("userId", "FullName UserName")
        .lean(),
    ]);
    return {
      tab,
      items: rows.map(toShopReviewItem),
      pagination: buildPagination(page, limit, total),
    };
  }

  throw createServiceError(`Tab lịch sử không hợp lệ: ${tab}`);
}

function toShopReviewItem(review) {
  const product = review.productId || null;
  const reviewer = review.userId || null;
  return {
    id: String(review._id),
    rating: review.rating || 0,
    comment: review.comment || "",
    ...toAdminReviewRemovalFields(review),
    createdAt: review.CreatedAt || null,
    product: product
      ? {
          id: String(product._id),
          name: product.ProductName || "",
        }
      : null,
    reviewer: reviewer
      ? {
          id: String(reviewer._id),
          fullName: reviewer.FullName || "",
          userName: reviewer.UserName || "",
        }
      : null,
  };
}

async function listShopProductsHistory(shopId, { page, limit, skip, statusGroup = "" }) {
  const filter = applyHistoryStatusFilter({ ShopId: shopId }, "products", statusGroup);
  const [total, rows] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("CategoryId", "name")
      .lean(),
  ]);

  const { loadProductImagesByProductIds } = require("./productService");
  const imagesByProduct = await loadProductImagesByProductIds(rows.map((item) => item._id));

  const items = rows.map((product) => toProductHistoryItem(product, shopId, imagesByProduct));

  return { items, pagination: buildPagination(page, limit, total) };
}

/**
 * Lịch sử hoạt động theo gian hàng (trang chi tiết shop admin).
 * tab: products | shop-reservations | reports-filed | reports-received | shop-reviews |
 *      seller-subscriptions | seller-banners | wallet
 */
async function getShopHistory(shopId, query = {}) {
  const shop = await ShopProfile.findById(shopId).select("_id userId").lean();
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const tab = String(query.tab || "products");
  const { page, limit, skip } = parsePagination(query);
  const statusGroup = resolveHistoryStatusGroup(query);
  const ownerId = shop.userId;

  if (tab === "products") {
    const result = await listShopProductsHistory(shop._id, { page, limit, skip, statusGroup });
    return { tab, ...result };
  }

  if (tab === "wallet") {
    if (!ownerId) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }
    const filter = applyHistoryStatusFilter({ userId: ownerId }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      WalletTransaction.countDocuments(filter),
      WalletTransaction.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toWalletTxItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "shop-reservations") {
    const filter = applyHistoryStatusFilter({ shopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Reservation.countDocuments(filter),
      Reservation.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate("userId", "UserName FullName Email")
        .populate("userId", "UserName FullName Email")
        .lean(),
    ]);
    return {
      tab,
      items: await mapReservationHistoryItems(rows),
      pagination: buildPagination(page, limit, total),
    };
  }

  if (tab === "reports-filed") {
    if (!ownerId) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }
    const filter = applyHistoryStatusFilter({ userId: ownerId }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toReportItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "reports-received") {
    const baseFilter = ownerId
      ? await buildReportsReceivedFilter(ownerId)
      : { shopId: shop._id };
    const filter = applyHistoryStatusFilter(baseFilter, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toReportItem), pagination: buildPagination(page, limit, total) };
  }

  // Alias cũ: gộp báo cáo bị nhận (tương thích client cũ nếu còn gọi tab=reports).
  if (tab === "reports") {
    const baseFilter = ownerId
      ? await buildReportsReceivedFilter(ownerId)
      : { shopId: shop._id };
    const filter = applyHistoryStatusFilter(baseFilter, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toReportItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "shop-reviews") {
    const filter = applyHistoryStatusFilter({ shopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate("userId", "FullName UserName")
        .lean(),
    ]);
    return {
      tab,
      items: rows.map(toShopReviewItem),
      pagination: buildPagination(page, limit, total),
    };
  }

  if (tab === "seller-subscriptions") {
    const filter = applyHistoryStatusFilter({ shopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      SellerSubscription.countDocuments(filter),
      SellerSubscription.find(filter)
        .sort({ ngayMua: -1, CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    return {
      tab,
      items: rows.map(toSellerSubscriptionHistoryItem),
      pagination: buildPagination(page, limit, total),
    };
  }

  if (tab === "seller-banners") {
    const filter = applyHistoryStatusFilter({ shopId: shop._id }, tab, statusGroup);
    const [total, rows] = await Promise.all([
      SellerBannerPlan.countDocuments(filter),
      SellerBannerPlan.find(filter)
        .sort({ ngayMua: -1, CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    return {
      tab,
      items: rows.map(toSellerBannerHistoryItem),
      pagination: buildPagination(page, limit, total),
    };
  }

  throw createServiceError(`Tab lịch sử shop không hợp lệ: ${tab}`);
}

async function sumTransactions(userId, type) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        userId,
        type,
        status: WALLET_TX_STATUS.SUCCESS,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

/**
 * Tổng hợp tài chính một tài khoản: số dư ví, tổng nạp / rút / cọc / hoàn.
 */
async function getAccountFinanceSummary(userId) {
  const user = await User.findById(userId).select("_id Role").lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }

  const [
    wallet,
    topup,
    payment,
    refund,
    withdrawal,
    depositHold,
    depositRefund,
    depositRelease,
    pendingWithdrawAgg,
  ] = await Promise.all([
    Wallet.findOne({ userId: user._id }).lean(),
    sumTransactions(user._id, WALLET_TX_TYPE.TOPUP),
    sumTransactions(user._id, WALLET_TX_TYPE.PAYMENT),
    sumTransactions(user._id, WALLET_TX_TYPE.REFUND),
    sumTransactions(user._id, WALLET_TX_TYPE.WITHDRAWAL),
    sumTransactions(user._id, WALLET_TX_TYPE.DEPOSIT_HOLD),
    sumTransactions(user._id, WALLET_TX_TYPE.DEPOSIT_REFUND),
    sumTransactions(user._id, WALLET_TX_TYPE.DEPOSIT_RELEASE),
    WithdrawRequest.aggregate([
      { $match: { userId: user._id, status: WITHDRAW_STATUS.PENDING } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const pendingWithdraw = pendingWithdrawAgg[0] || { total: 0, count: 0 };

  return {
    walletBalance: wallet?.balance || 0,
    totalTopup: topup.total,
    topupCount: topup.count,
    totalPayment: payment.total,
    paymentCount: payment.count,
    totalRefund: refund.total,
    refundCount: refund.count,
    totalWithdrawal: withdrawal.total,
    withdrawalCount: withdrawal.count,
    totalDepositHold: depositHold.total,
    depositHoldCount: depositHold.count,
    totalDepositRefund: depositRefund.total,
    depositRefundCount: depositRefund.count,
    totalDepositRelease: depositRelease.total,
    depositReleaseCount: depositRelease.count,
    pendingWithdrawTotal: pendingWithdraw.total || 0,
    pendingWithdrawCount: pendingWithdraw.count || 0,
  };
}

function resolveRange(query = {}) {
  const now = new Date();
  let to = query.to ? new Date(`${query.to}T23:59:59.999`) : now;
  let from;
  if (query.from) {
    from = new Date(`${query.from}T00:00:00.000`);
  } else {
    from = new Date(to);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw createServiceError("Khoảng thời gian không hợp lệ.");
  }
  return { from, to };
}

async function sumTxInRange(type, from, to) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        type,
        status: WALLET_TX_STATUS.SUCCESS,
        CreatedAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

async function sumApprovedWithdrawAll() {
  const rows = await WithdrawRequest.aggregate([
    { $match: { status: WITHDRAW_STATUS.APPROVED } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

async function sumTxAll(type) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        type,
        status: WALLET_TX_STATUS.SUCCESS,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

async function dailyTxSeries(type, from, to) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        type,
        status: WALLET_TX_STATUS.SUCCESS,
        CreatedAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$CreatedAt" } },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ date: row._id, total: row.total, count: row.count }));
}

async function sumWalletBalanceByRole(role) {
  const rows = await Wallet.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: { "user.Role": role } },
    { $group: { _id: null, total: { $sum: "$balance" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

const DETAIL_LIMIT = 40;

function mapWalletRow(row) {
  const user = row.user || {};
  const userRole = Number(user.Role);
  return {
    id: String(user._id || row.userId || ""),
    fullName: user.FullName || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
    email: user.Email || "",
    phone: user.Phone || "",
    role: userRole,
    roleLabel: userRole === USER_ROLE.SELLER ? "Người bán" : "Người mua",
    balance: Number(row.balance) || 0,
  };
}

function parseFinanceRoleFilter(role) {
  const roleNum = Number(role);
  if (roleNum === USER_ROLE.BUYER || roleNum === USER_ROLE.SELLER) {
    return roleNum;
  }
  return null;
}

async function buildWalletTxListFilter({ type, q, role }) {
  const filter = {
    type,
    status: WALLET_TX_STATUS.SUCCESS,
  };
  const queryText = String(q || "").trim();
  const roleNum = parseFinanceRoleFilter(role);

  let roleUserIds = null;
  if (roleNum != null) {
    const rows = await User.find({ Role: roleNum }).select("_id").lean();
    roleUserIds = rows.map((row) => row._id);
    if (!roleUserIds.length) {
      return { ...filter, _id: { $in: [] } };
    }
  }

  if (!queryText) {
    if (roleUserIds) {
      filter.userId = { $in: roleUserIds };
    }
    return filter;
  }

  const orConditions = [];
  const regex = buildSearchRegex(queryText);

  if (regex) {
    appendNumericFieldSearchConditions(orConditions, "orderCode", queryText);
    orConditions.push({ description: regex });

    const matchedUsers = await findUsersBySearchRegex(User, regex);
    let matchedUserIds = matchedUsers.map((row) => row._id);
    if (roleUserIds) {
      const roleSet = new Set(roleUserIds.map(String));
      matchedUserIds = matchedUserIds.filter((id) => roleSet.has(String(id)));
    }
    if (matchedUserIds.length) {
      orConditions.push({ userId: { $in: matchedUserIds } });
    }

    if (type === WALLET_TX_TYPE.WITHDRAWAL) {
      const withdrawFilter = {
        $or: [{ accountNumber: regex }, { accountName: regex }, { bankName: regex }],
      };
      if (roleUserIds) {
        withdrawFilter.userId = { $in: roleUserIds };
      }
      const withdrawRows = await WithdrawRequest.find(withdrawFilter)
        .select("_id gdViId")
        .lean();
      const withdrawIds = withdrawRows.map((row) => row._id);
      const gdViIds = withdrawRows.map((row) => row.gdViId).filter(Boolean);
      if (withdrawIds.length) {
        orConditions.push({
          referenceType: WALLET_REFERENCE_TYPE.WITHDRAW,
          referenceId: { $in: withdrawIds },
        });
      }
      if (gdViIds.length) {
        orConditions.push({ _id: { $in: gdViIds } });
      }
    }
  }

  for (const cond of buildObjectIdSearchConditions(queryText)) {
    if (cond._id) {
      orConditions.push({ _id: cond._id });
      orConditions.push({ referenceId: cond._id });
    }
  }

  if (!orConditions.length) {
    if (roleUserIds) {
      filter.userId = { $in: roleUserIds };
    }
    return filter;
  }

  if (roleUserIds) {
    filter.$and = [{ userId: { $in: roleUserIds } }, { $or: orConditions }];
  } else {
    filter.$or = orConditions;
  }

  return filter;
}

function mapWalletTxRow(row, userMap) {
  const user = userMap.get(String(row.userId));
  const userRole = Number(user?.Role);
  return {
    id: String(row._id),
    userId: String(row.userId || ""),
    fullName: user?.FullName || "",
    userName: user?.UserName || "",
    avatar: user?.Avatar || "",
    amount: Number(row.amount) || 0,
    description: row.description || "",
    orderCode: row.orderCode || "",
    reservationId: walletTxReservationId(row) || "",
    createdAt: row.CreatedAt || null,
    status: Number(row.status),
    statusLabel: WALLET_TX_STATUS_LABEL[row.status] || "",
    typeLabel: WALLET_TX_TYPE_LABEL[row.type] || "",
    userPhone: user?.Phone || "",
    userEmail: user?.Email || "",
    role: userRole,
    roleLabel:
      userRole === USER_ROLE.SELLER
        ? "Người bán"
        : userRole === USER_ROLE.BUYER
          ? "Người mua"
          : "",
  };
}

async function buildFinanceWithdrawFilter({ q, role }) {
  const filter = { status: WITHDRAW_STATUS.APPROVED };
  const roleNum = parseFinanceRoleFilter(role);
  if (roleNum != null) {
    const users = await User.find({ Role: roleNum }).select("_id").lean();
    const userIds = users.map((row) => row._id);
    if (!userIds.length) {
      return { _id: { $in: [] } };
    }
    filter.userId = { $in: userIds };
  }

  const queryText = String(q || "").trim();
  if (!queryText) {
    return filter;
  }

  const orConditions = [];
  const regex = buildSearchRegex(queryText);
  if (regex) {
    orConditions.push(
      { accountNumber: regex },
      { accountName: regex },
      { bankName: regex }
    );
    const matchedUsers = await findUsersBySearchRegex(User, regex);
    if (matchedUsers.length) {
      orConditions.push({ userId: { $in: matchedUsers.map((row) => row._id) } });
    }
  }

  orConditions.push(...buildObjectIdSearchConditions(queryText));

  const numericOrderCode = Number(String(queryText).replace(/\D/g, ""));
  if (Number.isFinite(numericOrderCode) && numericOrderCode > 0) {
    const matchedTxs = await WalletTransaction.find({ orderCode: numericOrderCode })
      .select("_id")
      .lean();
    if (matchedTxs.length) {
      orConditions.push({ gdViId: { $in: matchedTxs.map((row) => row._id) } });
    }
  }

  if (!orConditions.length) {
    return filter;
  }

  if (filter.userId) {
    return { $and: [filter, { $or: orConditions }] };
  }
  return { ...filter, $or: orConditions };
}

async function listFinanceWithdrawalsPaged(page = 1, limit = 20, { q, role } = {}) {
  const filter = await buildFinanceWithdrawFilter({ q, role });
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WithdrawRequest.countDocuments(filter),
    WithdrawRequest.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const gdViIds = rows.map((row) => row.gdViId).filter(Boolean);
  const [users, walletTxs] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select("FullName UserName Phone Email Role Avatar")
          .lean()
      : [],
    gdViIds.length
      ? WalletTransaction.find({ _id: { $in: gdViIds } })
          .select("orderCode description")
          .lean()
      : [],
  ]);
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const txMap = new Map(walletTxs.map((tx) => [String(tx._id), tx]));

  return {
    items: rows.map((row) => {
      const user = userMap.get(String(row.userId));
      const tx = row.gdViId ? txMap.get(String(row.gdViId)) : null;
      return {
        id: String(row._id),
        withdrawId: String(row._id),
        orderCode: tx?.orderCode || "",
        userId: String(row.userId || ""),
        fullName: user?.FullName || "",
        userName: user?.UserName || "",
        avatar: user?.Avatar || "",
        roleLabel: "Người bán",
        amount: Number(row.amount) || 0,
        description: tx?.description || row.adminNote || "",
        createdAt: row.CreatedAt || null,
        accountNumber: row.accountNumber || "",
        accountName: row.accountName || "",
        status: Number(row.status),
        statusLabel: WITHDRAW_STATUS_LABEL[row.status] || "",
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function buildEscrowListFilter({ q, role }) {
  const filter = {
    cocChuyenDen: 0,
    depositAmount: { $gt: 0 },
  };
  const queryText = String(q || "").trim();
  const roleNum = parseFinanceRoleFilter(role);
  const andConditions = [];

  if (roleNum === USER_ROLE.SELLER) {
    andConditions.push({ shopId: { $ne: null } });
  } else if (roleNum === USER_ROLE.BUYER) {
    const buyers = await User.find({ Role: USER_ROLE.BUYER }).select("_id").lean();
    if (buyers.length) {
      andConditions.push({ userId: { $in: buyers.map((row) => row._id) } });
    } else {
      return { ...filter, _id: { $in: [] } };
    }
  }

  if (queryText) {
    const orConditions = [];
    orConditions.push(...buildObjectIdSearchConditions(queryText));

    const regex = buildSearchRegex(queryText);
    if (regex) {
      const matchedUsers = await findUsersBySearchRegex(User, regex);
      const buyerIds = matchedUsers.map((row) => row._id);
      if (buyerIds.length) {
        orConditions.push({ userId: { $in: buyerIds } });
      }

      const shops = await ShopProfile.find({
        $or: [{ shopName: regex }, { shopUsername: regex }],
      })
        .select("_id")
        .lean();
      if (shops.length) {
        orConditions.push({ shopId: { $in: shops.map((row) => row._id) } });
      }

      const products = await Product.find({ ProductName: regex }).select("_id").lean();
      if (products.length) {
        orConditions.push({ productId: { $in: products.map((row) => row._id) } });
      }
    }

    if (orConditions.length) {
      andConditions.push({ $or: orConditions });
    }
  }

  if (andConditions.length === 1) {
    return { ...filter, ...andConditions[0] };
  }
  if (andConditions.length > 1) {
    return { ...filter, $and: andConditions };
  }

  return filter;
}

async function listWalletsByRolePaged(role = null, page = 1, limit = 20, { q } = {}) {
  const allowedRoles =
    role != null ? [role] : [USER_ROLE.BUYER, USER_ROLE.SELLER];
  const skip = (page - 1) * limit;
  const matchStage = { "user.Role": { $in: allowedRoles } };
  const queryText = String(q || "").trim();
  const regex = queryText ? buildSearchRegex(queryText) : null;

  if (regex) {
    matchStage.$or = [
      { "user.FullName": regex },
      { "user.UserName": regex },
      { "user.Email": regex },
      { "user.Phone": regex },
    ];
  }

  const [result] = await Wallet.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: matchStage },
    { $sort: { balance: -1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ]);

  const total = result?.total?.[0]?.count || 0;
  const items = (result?.items || []).map(mapWalletRow);

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

async function listEscrowReservations() {
  const rows = await Reservation.find({
    cocChuyenDen: 0,
    depositAmount: { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .limit(DETAIL_LIMIT)
    .populate("userId", "FullName UserName Phone Email")
    .populate({
      path: "shopId",
      select: "userId shopName shopUsername avatar",
      populate: { path: "userId", select: "FullName UserName Avatar" },
    })
    .populate("productId", "ProductName")
    .select(
      "depositAmount createdAt pickupTime status userId shopId productId quantity reservedPrice"
    )
    .lean();

  return rows.map((row) => mapEscrowReservationRow(row));
}

function mapEscrowReservationRow(row, imagesByProduct = null) {
  const shop = row.shopId || null;
  const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
  const buyer = populatedReservationBuyer(row);
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.reservedPrice) || 0;
  const orderTotal = unitPrice * quantity;
  const productId = row.productId?._id || row.productId || null;
  let productThumbnail = "";
  if (productId && imagesByProduct) {
    const { toPublicProductImages } = require("./productService");
    const thumbs = toPublicProductImages(imagesByProduct.get(String(productId)) || []).map(
      (image) => image.imageUrl
    );
    const legacy = Array.isArray(row.productId?.images)
      ? row.productId.images.map((image) => image?.url || image).filter(Boolean)
      : [];
    productThumbnail = thumbs[0] || legacy[0] || "";
  }

  return {
    id: String(row._id),
    productId: productId ? String(productId) : "",
    productName: row.productId?.ProductName || "Sản phẩm",
    productThumbnail,
    depositAmount: Number(row.depositAmount) || 0,
    depositPercent: Number(row.depositPercent) || 0,
    orderTotal,
    createdAt: row.createdAt || row.CreatedAt || null,
    purchaseDate: row.createdAt || row.CreatedAt || null,
    releaseDate: row.hanGiaiCoc || null,
    pickupTime: row.pickupTime || null,
    status: Number(row.status),
    statusLabel: RESERVATION_STATUS_LABEL[row.status] || String(row.status),
    buyerName: buyer?.FullName || buyer?.UserName || "—",
    buyerFullName: buyer?.FullName || "",
    buyerUserName: buyer?.UserName || "",
    buyerAvatar: buyer?.Avatar || "",
    buyerPhone: buyer?.Phone || "",
    shopId: shop?._id ? String(shop._id) : "",
    shopName: resolveShopDisplayName(shop, shopOwner),
    shopUsername: shop?.shopUsername || resolveShopUsername(shop, shopOwner) || "",
    shopAvatar: shop?.avatar || shopOwner?.Avatar || "",
    quantity,
    reservedPrice: unitPrice,
  };
}

async function listEscrowReservationsPaged(page = 1, limit = 20, { q, role } = {}) {
  const filter = await buildEscrowListFilter({ q, role });
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    .populate("userId", "FullName UserName Phone Email Avatar")
    .populate({
      path: "shopId",
      select: "userId shopName shopUsername avatar",
      populate: { path: "userId", select: "FullName UserName Avatar" },
    })
    .populate("productId", "ProductName images")
    .select(
      "depositAmount depositPercent createdAt hanGiaiCoc pickupTime status userId shopId productId quantity reservedPrice"
    )
    .lean(),
  ]);

  const productIds = rows
    .map((row) => row.productId?._id || row.productId)
    .filter(Boolean);
  const { loadProductImagesByProductIds } = require("./productService");
  const imagesByProduct = productIds.length
    ? await loadProductImagesByProductIds(productIds)
    : new Map();

  return {
    items: rows.map((row) => mapEscrowReservationRow(row, imagesByProduct)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function listPendingWithdraws() {
  const rows = await WithdrawRequest.find({ status: WITHDRAW_STATUS.PENDING })
    .sort({ CreatedAt: -1 })
    .limit(DETAIL_LIMIT)
    .lean();
  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("FullName UserName Phone Email")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return rows.map((row) => {
    const user = userMap.get(String(row.userId));
    return {
      id: String(row._id),
      amount: Number(row.amount) || 0,
      bankName: row.bankName || "",
      bankCode: row.bankCode || "",
      accountNumber: row.accountNumber || "",
      accountName: row.accountName || "",
      createdAt: row.CreatedAt || null,
      statusLabel: WITHDRAW_STATUS_LABEL[row.status] || "Chờ duyệt",
      userName: user?.FullName || user?.UserName || "",
      userPhone: user?.Phone || "",
      userEmail: user?.Email || "",
    };
  });
}

async function listTxInRange(type, from, to) {
  const rows = await WalletTransaction.find({
    type,
    status: WALLET_TX_STATUS.SUCCESS,
    CreatedAt: { $gte: from, $lte: to },
  })
    .sort({ CreatedAt: -1 })
    .limit(DETAIL_LIMIT)
    .lean();
  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("FullName UserName Phone Email Role")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return rows.map((row) => {
    const user = userMap.get(String(row.userId));
    return {
      id: String(row._id),
      amount: Number(row.amount) || 0,
      description: row.description || "",
      orderCode: row.orderCode || "",
      reservationId: walletTxReservationId(row) || "",
      createdAt: row.CreatedAt || null,
      typeLabel: WALLET_TX_TYPE_LABEL[row.type] || "",
      userName: user?.FullName || user?.UserName || "",
      userPhone: user?.Phone || "",
      userEmail: user?.Email || "",
      roleLabel:
        Number(user?.Role) === USER_ROLE.SELLER
          ? "Người bán"
          : Number(user?.Role) === USER_ROLE.BUYER
            ? "Người mua"
            : "",
    };
  });
}
async function listTxInRangePaged(type, from, to, page = 1, limit = 20) {
  const filter = {
    type,
    status: WALLET_TX_STATUS.SUCCESS,
    CreatedAt: { $gte: from, $lte: to },
  };

  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WalletTransaction.countDocuments(filter),
    WalletTransaction.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const userIds = rows.map((row) => row.userId).filter(Boolean);

  const users = userIds.length
    ? await User.find({
        _id: { $in: userIds },
      })
        .select("FullName UserName Phone Email Role")
        .lean()
    : [];

  const userMap = new Map(
    users.map((user) => [String(user._id), user])
  );

  return {
    items: rows.map((row) => {
      const user = userMap.get(String(row.userId));

      return {
        id: String(row._id),
        amount: Number(row.amount) || 0,
        description: row.description || "",
        orderCode: row.orderCode || "",
        reservationId: walletTxReservationId(row) || "",
        createdAt: row.CreatedAt || null,
        typeLabel: WALLET_TX_TYPE_LABEL[row.type] || "",
        userName: user?.FullName || user?.UserName || "",
        userPhone: user?.Phone || "",
        userEmail: user?.Email || "",
        roleLabel:
          Number(user?.Role) === USER_ROLE.SELLER
            ? "Người bán"
            : Number(user?.Role) === USER_ROLE.BUYER
            ? "Người mua"
            : "",
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function listTxAllPaged(type, page = 1, limit = 20, { q, role } = {}) {
  const filter = await buildWalletTxListFilter({ type, q, role });
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WalletTransaction.countDocuments(filter),
    WalletTransaction.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const userIds = rows.map((row) => row.userId).filter(Boolean);

  const users = userIds.length
    ? await User.find({
        _id: { $in: userIds },
      })
        .select("FullName UserName Phone Email Role Avatar")
        .lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return {
    items: rows.map((row) => mapWalletTxRow(row, userMap)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

const WALLET_OVERVIEW_TX_TYPES = [
  WALLET_TX_TYPE.TOPUP,
  WALLET_TX_TYPE.WITHDRAWAL,
  WALLET_TX_TYPE.DEPOSIT_HOLD,
  WALLET_TX_TYPE.DEPOSIT_REFUND,
  WALLET_TX_TYPE.DEPOSIT_RELEASE,
  WALLET_TX_TYPE.PAYMENT,
];

async function listAllWalletTxInRangePaged(from, to, page = 1, limit = 20) {
  const filter = {
    type: { $in: WALLET_OVERVIEW_TX_TYPES },
    status: WALLET_TX_STATUS.SUCCESS,
    CreatedAt: { $gte: from, $lte: to },
  };

  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WalletTransaction.countDocuments(filter),
    WalletTransaction.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const userIds = rows.map((row) => row.userId).filter(Boolean);

  const users = userIds.length
    ? await User.find({
        _id: { $in: userIds },
      })
        .select("FullName UserName Phone Email Role")
        .lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return {
    items: rows.map((row) => {
      const user = userMap.get(String(row.userId));

      return {
        id: String(row._id),
        amount: Number(row.amount) || 0,
        description: row.description || "",
        orderCode: row.orderCode || "",
        reservationId: walletTxReservationId(row) || "",
        createdAt: row.CreatedAt || null,
        type: row.type,
        typeLabel: WALLET_TX_TYPE_LABEL[row.type] || "",
        userName: user?.FullName || user?.UserName || "",
        userPhone: user?.Phone || "",
        userEmail: user?.Email || "",
        roleLabel:
          Number(user?.Role) === USER_ROLE.SELLER
            ? "Người bán"
            : Number(user?.Role) === USER_ROLE.BUYER
              ? "Người mua"
              : "",
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function reservationLineTotal(row) {
  const price = Number(row.agreedPrice ?? row.reservedPrice) || 0;
  const qty = Math.max(1, Number(row.quantity) || 1);
  return price * qty;
}

async function sumGmvInRange(from, to) {
  const rows = await Reservation.aggregate([
    {
      $match: {
        status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.RECEIVED] },
        ...reservationCompletedWindowMatch(from, to),
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $multiply: [
              { $ifNull: ["$agreedPrice", { $ifNull: ["$reservedPrice", 0] }] },
              { $ifNull: ["$quantity", 1] },
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  return { total: Number(rows[0]?.total) || 0, count: Number(rows[0]?.count) || 0 };
}

async function sumEscrowHeldAmount() {
  const rows = await Reservation.aggregate([
    {
      $match: {
        cocChuyenDen: 0,
        depositAmount: { $gt: 0 },
      },
    },
    { $group: { _id: null, total: { $sum: "$depositAmount" }, count: { $sum: 1 } } },
  ]);
  return { total: Number(rows[0]?.total) || 0, count: Number(rows[0]?.count) || 0 };
}

async function sumDisputedInRange(from, to) {
  const rows = await Reservation.aggregate([
    {
      $match: {
        status: RESERVATION_STATUS.DISPUTED,
        UpdatedAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, total: { $sum: "$depositAmount" }, count: { $sum: 1 } } },
  ]);
  return { total: Number(rows[0]?.total) || 0, count: Number(rows[0]?.count) || 0 };
}

async function sumBannerSalesInRange(from, to) {
  const rows = await SellerBannerPlan.aggregate([
    {
      $match: {
        ngayMua: { $gte: from, $lte: to },
        amount: { $gt: 0 },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: Number(rows[0]?.total) || 0, count: Number(rows[0]?.count) || 0 };
}

async function mapReservationFinanceRow(row) {
  const shop = row.shopId && typeof row.shopId === "object" ? row.shopId : null;
  const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
  const buyer = populatedReservationBuyer(row);
  const product = row.productId && typeof row.productId === "object" ? row.productId : null;
  return {
    id: String(row._id),
    productName: product?.ProductName || "Sản phẩm",
    shopName: resolveShopDisplayName(shop, shopOwner),
    buyerName: buyer?.FullName || buyer?.UserName || "—",
    statusLabel: RESERVATION_STATUS_LABEL[row.status] || String(row.status),
    orderValue: reservationLineTotal(row),
    depositAmount: Number(row.depositAmount) || 0,
    completedAt: getPickupConfirmedAt(row) || getReservationUpdatedAt(row) || null,
    tgNhanHang: getPickupConfirmedAt(row) || null,
    createdAt: row.CreatedAt || null,
  };
}

async function listGmvReservationsPaged(from, to, page = 1, limit = 20) {
  const filter = {
    status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.RECEIVED] },
    $or: [
      ...reservationCompletedWindowMatch(from, to),
    ],
  };
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter)
      .sort({ tgNhanHang: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "FullName UserName Phone Email")
      .populate("userId", "FullName UserName Phone Email")
      .populate({
        path: "shopId",
        select: "userId shopName shopUsername avatar",
        populate: { path: "userId", select: "FullName UserName Avatar" },
      })
      .populate("productId", "ProductName")
      .lean(),
  ]);
  const items = await Promise.all(rows.map((row) => mapReservationFinanceRow(row)));
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function listDisputedReservationsPaged(from, to, page = 1, limit = 20) {
  const filter = {
    status: RESERVATION_STATUS.DISPUTED,
    UpdatedAt: { $gte: from, $lte: to },
  };
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter)
      .sort({ UpdatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "FullName UserName Phone Email")
      .populate("userId", "FullName UserName Phone Email")
      .populate({
        path: "shopId",
        select: "userId shopName shopUsername avatar",
        populate: { path: "userId", select: "FullName UserName Avatar" },
      })
      .populate("productId", "ProductName")
      .lean(),
  ]);
  const items = await Promise.all(rows.map((row) => mapReservationFinanceRow(row)));
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function listBannerSalesPaged(from, to, page = 1, limit = 20) {
  const filter = { ngayMua: { $gte: from, $lte: to }, amount: { $gt: 0 } };
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    SellerBannerPlan.countDocuments(filter),
    SellerBannerPlan.find(filter).sort({ ngayMua: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return {
    items: rows.map((row) => toSellerBannerHistoryItem(row)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/**
 * Tổng quan tài chính hệ thống (trang Tài chính admin).
 */
async function getFinanceOverview(query = {}) {
  const allTime =
    String(query.allTime || "") === "1" ||
    query.allTime === true ||
    query.allTime === 1;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const detailType = String(query.detailType || "all");

  if (allTime) {
    const q = String(query.q || query.search || "").trim();
    const role = parseFinanceRoleFilter(query.role);
    const listOptions = { q, role };

    const [buyerWallets, sellerWallets, topupAll, withdrawAll, escrowHeld] =
      await Promise.all([
        sumWalletBalanceByRole(USER_ROLE.BUYER),
        sumWalletBalanceByRole(USER_ROLE.SELLER),
        sumTxAll(WALLET_TX_TYPE.TOPUP),
        sumApprovedWithdrawAll(),
        sumEscrowHeldAmount(),
      ]);

    let detailData = {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    };

    switch (detailType) {
      case "allWallets":
        detailData = await listWalletsByRolePaged(role, page, limit, listOptions);
        break;
      case "topup":
        detailData = await listTxAllPaged(WALLET_TX_TYPE.TOPUP, page, limit, listOptions);
        break;
      case "withdrawal":
        detailData = await listFinanceWithdrawalsPaged(page, limit, listOptions);
        break;
      case "escrow":
        detailData = await listEscrowReservationsPaged(page, limit, listOptions);
        break;
      default:
        break;
    }

    const walletTotal =
      (Number(buyerWallets.total) || 0) + (Number(sellerWallets.total) || 0);
    const walletCount =
      (Number(buyerWallets.count) || 0) + (Number(sellerWallets.count) || 0);

    return {
      allTime: true,
      balances: {
        buyerWalletTotal: buyerWallets.total,
        buyerWalletCount: buyerWallets.count,
        sellerWalletTotal: sellerWallets.total,
        sellerWalletCount: sellerWallets.count,
        walletTotal,
        walletCount,
        escrowHeldTotal: escrowHeld.total,
        escrowHeldCount: escrowHeld.count,
      },
      summary: {
        walletTotal,
        walletCount,
        topupTotal: topupAll.total,
        topupCount: topupAll.count,
        withdrawTotal: withdrawAll.total,
        withdrawCount: withdrawAll.count,
        escrowHeldTotal: escrowHeld.total,
        escrowHeldCount: escrowHeld.count,
      },
      table: detailData.items,
      pagination: detailData.pagination,
      detailType,
    };
  }

  const { from, to } = resolveRange(query);

  const [
    buyerWallets,
    sellerWallets,
    systemWallet,
    topupInRange,
    withdrawInRange,
    paymentInRange,
    depositHoldInRange,
    depositRefundInRange,
    depositReleaseInRange,
    pendingWithdrawAgg,
    topupSeries,
    withdrawSeries,
    paymentSeries,
    depositReleaseSeries,
    escrowList,
    pendingWithdrawList,
    gmvInRange,
    escrowHeld,
    disputedInRange,
    bannerSalesInRange,
  ] = await Promise.all([
    sumWalletBalanceByRole(USER_ROLE.BUYER),
    sumWalletBalanceByRole(USER_ROLE.SELLER),
    SystemWallet.findOne().sort({ _id: 1 }).lean(),

    sumTxInRange(WALLET_TX_TYPE.TOPUP, from, to),
    sumTxInRange(WALLET_TX_TYPE.WITHDRAWAL, from, to),
    sumTxInRange(WALLET_TX_TYPE.PAYMENT, from, to),
    sumTxInRange(WALLET_TX_TYPE.DEPOSIT_HOLD, from, to),
    sumTxInRange(WALLET_TX_TYPE.DEPOSIT_REFUND, from, to),
    sumTxInRange(WALLET_TX_TYPE.DEPOSIT_RELEASE, from, to),

    WithdrawRequest.aggregate([
      { $match: { status: WITHDRAW_STATUS.PENDING } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),

    dailyTxSeries(WALLET_TX_TYPE.TOPUP, from, to),
    dailyTxSeries(WALLET_TX_TYPE.WITHDRAWAL, from, to),
    dailyTxSeries(WALLET_TX_TYPE.PAYMENT, from, to),
    dailyTxSeries(WALLET_TX_TYPE.DEPOSIT_RELEASE, from, to),

    listEscrowReservations(),
    listPendingWithdraws(),
    sumGmvInRange(from, to),
    sumEscrowHeldAmount(),
    sumDisputedInRange(from, to),
    sumBannerSalesInRange(from, to),
  ]);

  let detailData = {
    items: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 1,
    },
  };

  switch (detailType) {
    case "all":
      detailData = await listAllWalletTxInRangePaged(from, to, page, limit);
      break;

    case "topup":
      detailData = await listTxInRangePaged(
        WALLET_TX_TYPE.TOPUP,
        from,
        to,
        page,
        limit
      );
      break;

    case "withdrawal":
      detailData = await listTxInRangePaged(
        WALLET_TX_TYPE.WITHDRAWAL,
        from,
        to,
        page,
        limit
      );
      break;

    case "platformRevenue":
      detailData = await listTxInRangePaged(
        WALLET_TX_TYPE.PAYMENT,
        from,
        to,
        page,
        limit
      );
      break;

    case "depositHold":
      detailData = await listTxInRangePaged(
        WALLET_TX_TYPE.DEPOSIT_HOLD,
        from,
        to,
        page,
        limit
      );
      break;

    case "depositRefund":
      detailData = await listTxInRangePaged(
        WALLET_TX_TYPE.DEPOSIT_REFUND,
        from,
        to,
        page,
        limit
      );
      break;

    case "depositRelease":
      detailData = await listTxInRangePaged(
        WALLET_TX_TYPE.DEPOSIT_RELEASE,
        from,
        to,
        page,
        limit
      );
      break;

    case "pendingWithdraw":
      detailData = {
        items: pendingWithdrawList,
        pagination: {
          page: 1,
          limit: pendingWithdrawList.length,
          total: pendingWithdrawList.length,
          totalPages: 1,
        },
      };
      break;

    case "allWallets":
      detailData = await listWalletsByRolePaged(null, page, limit);
      break;

    case "buyerWallets":
      detailData = await listWalletsByRolePaged(USER_ROLE.BUYER, page, limit);
      break;

    case "sellerWallets":
      detailData = await listWalletsByRolePaged(USER_ROLE.SELLER, page, limit);
      break;

    case "escrow":
      detailData = await listEscrowReservationsPaged(page, limit);
      break;

    case "gmv":
      detailData = await listGmvReservationsPaged(from, to, page, limit);
      break;

    case "disputed":
      detailData = await listDisputedReservationsPaged(from, to, page, limit);
      break;

    case "bannerSales":
      detailData = await listBannerSalesPaged(from, to, page, limit);
      break;
  }

  return {
    range: { from, to },

    balances: {
      buyerWalletTotal: buyerWallets.total,
      buyerWalletCount: buyerWallets.count,
      sellerWalletTotal: sellerWallets.total,
      sellerWalletCount: sellerWallets.count,
      escrowBalance: systemWallet?.balance || 0,
      escrowHeldTotal: escrowHeld.total,
      escrowHeldCount: escrowHeld.count,
    },

    inRange: {
      topup: topupInRange,
      withdrawal: withdrawInRange,
      platformRevenue: paymentInRange,
      depositHold: depositHoldInRange,
      depositRefund: depositRefundInRange,
      depositRelease: depositReleaseInRange,
      gmv: gmvInRange,
      disputed: disputedInRange,
      bannerSales: bannerSalesInRange,
    },

    pendingWithdraw: {
      total: pendingWithdrawAgg[0]?.total || 0,
      count: pendingWithdrawAgg[0]?.count || 0,
    },

    series: {
      topup: topupSeries,
      withdrawal: withdrawSeries,
      platformRevenue: paymentSeries,
      depositRelease: depositReleaseSeries,
    },

    details: {
      allWallets: [],
      buyerWallets: [],
      sellerWallets: [],
      escrow: escrowList,
      pendingWithdraw: pendingWithdrawList,
    },

    table: detailData.items,
    pagination: detailData.pagination,
    detailType,
  };
}
/**
 * Nhật ký thao tác admin trên đơn giữ hàng (tranh chấp).
 */
async function listAuditLogs(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const match = {};

  if (query.action) {
    match["auditLogs.action"] = String(query.action);
  }
  if (query.reservationId) {
    match.reservationId = new mongoose.Types.ObjectId(String(query.reservationId));
  }

  const createdAtRange = {};
  if (query.from) {
    createdAtRange.$gte = new Date(query.from);
  }
  if (query.to) {
    createdAtRange.$lte = new Date(query.to);
  }
  if (Object.keys(createdAtRange).length) {
    match["auditLogs.createdAt"] = createdAtRange;
  }

  const pipeline = [
    { $match: { auditLogs: { $exists: true, $ne: [] } } },
    { $unwind: "$auditLogs" },
  ];
  if (Object.keys(match).length) {
    pipeline.push({ $match: match });
  }
  pipeline.push(
    { $sort: { "auditLogs.createdAt": -1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        rows: [{ $skip: skip }, { $limit: limit }],
      },
    }
  );

  const [result] = await ReservationDispute.aggregate(pipeline);
  const total = result?.total?.[0]?.count || 0;
  const rows = result?.rows || [];

  const adminIds = [
    ...new Set(rows.map((row) => String(row.auditLogs?.adminId || "")).filter(Boolean)),
  ];
  const admins = adminIds.length
    ? await User.find({ _id: { $in: adminIds } }).select("UserName FullName Email").lean()
    : [];
  const adminById = new Map(admins.map((user) => [String(user._id), user]));

  const items = rows.map((row) => {
    const log = row.auditLogs;
    const admin = adminById.get(String(log.adminId || ""));
    return {
      id: String(log._id || `${row._id}-${log.createdAt}`),
      action: log.action,
      decision: log.decision || "",
      note: log.note || "",
      reservationId: row.reservationId ? String(row.reservationId) : null,
      createdAt: log.createdAt || null,
      admin: admin
        ? {
            id: String(admin._id),
            userName: admin.UserName || "",
            fullName: admin.FullName || "",
            email: admin.Email || "",
          }
        : null,
    };
  });

  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  getAccountHistory,
  getShopHistory,
  getAccountFinanceSummary,
  getFinanceOverview,
  listAuditLogs,
};
