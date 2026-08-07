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
const { buyerIdFilter } = require("../utils/reservationCompat");
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
const { toAdminProductRemovalFields } = require("../utils/productRemoval");
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
      return { ...baseFilter, $or: removedProductConditions() };
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
    reservationId: tx.reservationId ? String(tx.reservationId) : null,
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
    processedAt: item.processedAt || null,
    createdAt: item.CreatedAt || null,
  };
}

function populatedReservationBuyer(reservation) {
  const ref = reservation?.userId || reservation?.buyerId || null;
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
    depositSettleTo: reservation.depositSettleTo,
    pickupTime: reservation.pickupTime || null,
    disputeByBuyer: disputeView.disputeByBuyer,
    disputeBySeller: disputeView.disputeBySeller,
    createdAt: reservation.CreatedAt || null,
    completedAt: reservation.completedAt || null,
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
    processedAt: report.processedAt || null,
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
    violationReason: banner.violationReason || "",
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
    categoryName: category?.name || category?.categoryName || "",
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
        .populate("buyerId", "FullName UserName Email")
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
        .populate("buyerId", "UserName FullName Email")
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
        .populate("CategoryId", "name categoryName")
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
      .populate("CategoryId", "name categoryName")
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
        .populate("buyerId", "UserName FullName Email")
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
    email: user.Email || "",
    phone: user.Phone || "",
    role: userRole,
    roleLabel: userRole === USER_ROLE.SELLER ? "Người bán" : "Người mua",
    balance: Number(row.balance) || 0,
  };
}

async function listWalletsByRolePaged(role = null, page = 1, limit = 20) {
  const allowedRoles =
    role != null ? [role] : [USER_ROLE.BUYER, USER_ROLE.SELLER];
  const skip = (page - 1) * limit;

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
    { $match: { "user.Role": { $in: allowedRoles } } },
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
    depositPaidAt: { $ne: null },
    depositSettleTo: 0,
    depositAmount: { $gt: 0 },
  })
    .sort({ depositPaidAt: -1 })
    .limit(DETAIL_LIMIT)
    .populate("userId", "FullName UserName Phone Email")
    .populate("buyerId", "FullName UserName Phone Email")
    .populate({
      path: "shopId",
      select: "userId shopName shopUsername avatar",
      populate: { path: "userId", select: "FullName UserName Avatar" },
    })
    .populate("productId", "ProductName")
    .select(
      "depositAmount depositPaidAt pickupTime status userId buyerId shopId productId quantity reservedPrice"
    )
    .lean();

  return rows.map((row) => {
    const shop = row.shopId || null;
    const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
    const buyer = populatedReservationBuyer(row);
    return {
      id: String(row._id),
      productName: row.productId?.ProductName || "Sản phẩm",
      depositAmount: Number(row.depositAmount) || 0,
      depositPaidAt: row.depositPaidAt || null,
      pickupTime: row.pickupTime || null,
      status: Number(row.status),
      statusLabel: RESERVATION_STATUS_LABEL[row.status] || String(row.status),
      buyerName: buyer?.FullName || buyer?.UserName || "—",
      buyerPhone: buyer?.Phone || "",
      shopName: resolveShopDisplayName(shop, shopOwner),
      quantity: Number(row.quantity) || 0,
      reservedPrice: Number(row.reservedPrice) || 0,
    };
  });
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
      reservationId: row.reservationId ? String(row.reservationId) : "",
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
        reservationId: row.reservationId
          ? String(row.reservationId)
          : "",
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
/**
 * Tổng quan tài chính hệ thống (trang Tài chính admin).
 */
async function getFinanceOverview(query = {}) {
  const { from, to } = resolveRange(query);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const detailType = String(query.detailType || "topup");

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
  ] = await Promise.all([
    sumWalletBalanceByRole(USER_ROLE.BUYER),
    sumWalletBalanceByRole(USER_ROLE.SELLER),
    SystemWallet.findOne({ key: "system" }).lean(),

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
      detailData = {
        items: escrowList,
        pagination: {
          page: 1,
          limit: escrowList.length,
          total: escrowList.length,
          totalPages: 1,
        },
      };
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
    },

    inRange: {
      topup: topupInRange,
      withdrawal: withdrawInRange,
      platformRevenue: paymentInRange,
      depositHold: depositHoldInRange,
      depositRefund: depositRefundInRange,
      depositRelease: depositReleaseInRange,
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
