const {
  reservationCompletedWindowMatch,
  getPickupConfirmedAt,
  getReservationUpdatedAt,
} = require("../utils/reservationCompat");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const Reservation = require("../models/Reservation");
const ReservationDispute = require("../models/ReservationDispute");
const FavoriteProduct = require("../models/FavoriteProduct");
const Follow = require("../models/Follow");
const SystemWallet = require("../models/SystemWallet");
const SellerSubscription = require("../models/SellerSubscription");
const SellerBannerPlan = require("../models/SellerBannerPlan");
const SellerVerification = require("../models/SellerVerification");
const Report = require("../models/Report");
const Review = require("../models/Review");
const WithdrawRequest = require("../models/WithdrawRequest");
const WalletTransaction = require("../models/WalletTransaction");
const { USER_ROLE } = require("../constants");
const { USER_STATUS } = require("../constants");
const { SHOP_STATUS } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const {
  RESERVATION_STATUS,
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_VERIFICATION_STATUS,
  SELLER_BANNER_STATUS,
  REPORT_STATUS,
  CONTENT_REPORT_TYPES,
  WITHDRAW_STATUS,
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  DISPUTE_STATUS,
} = require("../constants");
const { computeTotal } = require("./reservationService");
const { mongoExcludeOrderLinkedReportsCondition } = require("../utils/reportType");
const { notRemovedProductMatch } = require("../utils/productRemoval");
const { notDeletedReviewFilter } = require("../utils/reviewRemoval");

function pendingContentReportFilter() {
  return {
    $and: [
      { status: REPORT_STATUS.PENDING },
      { reportType: { $in: CONTENT_REPORT_TYPES } },
      mongoExcludeOrderLinkedReportsCondition(),
    ],
  };
}
const {
  resolveShopDisplayName,
  resolveShopAvatar,
  resolveShopUsername,
} = require("../utils/shopIdentity");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toDateKey(date) {
  const value = new Date(date);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveDateRange(query = {}) {
  const now = new Date();
  const range = String(query.range || query.period || "today").toLowerCase();
  let from = null;
  let to = endOfDay(now);
  const isAllTime =
    range === "all" || range === "alltime" || range === "all-time";

  if (query.from || query.startDate) {
    from = startOfDay(new Date(query.from || query.startDate));
  }
  if (query.to || query.endDate) {
    to = endOfDay(new Date(query.to || query.endDate));
  }

  if (!from) {
    if (isAllTime) {
      from = startOfDay(new Date(2020, 0, 1));
    } else if (range === "day" || range === "today") {
      from = startOfDay(now);
    } else if (range === "week" || range === "7days") {
      from = startOfDay(addDays(now, -6));
    } else if (range === "15days") {
      from = startOfDay(addDays(now, -14));
    } else if (range === "month" || range === "30days") {
      from = startOfDay(addDays(now, -29));
    } else if (range === "custom") {
      throw createServiceError("Khoảng thời gian tùy chọn cần from và to.", 400);
    } else {
      from = startOfDay(now);
    }
  }

  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw createServiceError("Ngày bắt đầu không hợp lệ.", 400);
  }
  if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
    throw createServiceError("Ngày kết thúc không hợp lệ.", 400);
  }
  if (from > to) {
    throw createServiceError("from phải nhỏ hơn hoặc bằng to.", 400);
  }

  const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
  if (!isAllTime && to - from > maxSpanMs) {
    throw createServiceError("Khoảng thời gian tối đa là 366 ngày.", 400);
  }

  return {
    range: isAllTime ? "all" : query.from || query.to ? "custom" : range === "custom" ? "custom" : range,
    from,
    to,
    allTime: isAllTime,
  };
}

function buildEmptySeries(from, to) {
  const series = [];
  let cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor <= last) {
    series.push({ date: toDateKey(cursor), value: 0 });
    cursor = addDays(cursor, 1);
  }
  return series;
}

function fillSeries(emptySeries, rows, dateField = "_id", valueField = "count") {
  const map = new Map(emptySeries.map((item) => [item.date, 0]));
  for (const row of rows) {
    const key = String(row[dateField] || "");
    if (map.has(key)) {
      map.set(key, Number(row[valueField]) || 0);
    }
  }
  return emptySeries.map((item) => ({
    date: item.date,
    value: map.get(item.date) || 0,
  }));
}

async function aggregateDailyCount(Model, match, dateField = "CreatedAt") {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

/** Đếm theo ngày với mốc thời gian fallback (vd completedAt ?? UpdatedAt). */
async function aggregateDailyCountWithFallback(Model, match, dateField, fallbackField) {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $ifNull: [`$${dateField}`, `$${fallbackField}`] },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

/** Tổng một field số theo ngày. */
async function aggregateDailySum(Model, match, dateField, sumField) {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` },
        },
        count: { $sum: `$${sumField}` },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function aggregateDailySumWithFallback(
  Model,
  match,
  dateField,
  fallbackField,
  sumField
) {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $ifNull: [`$${dateField}`, `$${fallbackField}`] },
          },
        },
        count: { $sum: `$${sumField}` },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function dayBoundsFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return {
    start: new Date(year, month - 1, day, 0, 0, 0, 0),
    end: new Date(year, month - 1, day, 23, 59, 59, 999),
  };
}

function isBannerRunningOnDay(banner, dayStart, dayEnd) {
  if (Number(banner.status) !== SELLER_BANNER_STATUS.ACTIVE) {
    return false;
  }
  if (!banner.approvedAt || !banner.startDate || !banner.endDate) {
    return false;
  }
  const start = new Date(banner.startDate);
  const end = new Date(banner.endDate);
  return start <= dayEnd && end >= dayStart;
}

async function countActiveBannersAt(at) {
  const dayStart = startOfDay(at);
  const dayEnd = endOfDay(at);
  return SellerBannerPlan.countDocuments({
    status: SELLER_BANNER_STATUS.ACTIVE,
    approvedAt: { $ne: null },
    startDate: { $ne: null, $lte: dayEnd },
    endDate: { $ne: null, $gte: dayStart },
  });
}

/** Số banner đang treo trong từng ngày (theo startDate/endDate, không phải ngày mua). */
async function aggregateDailyActiveBannerCount(from, to) {
  const series = buildEmptySeries(from, to);
  if (!series.length) {
    return [];
  }

  const banners = await SellerBannerPlan.find({
    status: SELLER_BANNER_STATUS.ACTIVE,
    approvedAt: { $ne: null },
    startDate: { $ne: null, $lte: endOfDay(to) },
    endDate: { $ne: null, $gte: startOfDay(from) },
  })
    .select("status approvedAt startDate endDate")
    .lean();

  return series.map((day) => {
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey(day.date);
    let count = 0;
    for (const banner of banners) {
      if (isBannerRunningOnDay(banner, dayStart, dayEnd)) {
        count += 1;
      }
    }
    return { _id: day.date, count };
  });
}

async function aggregatePackageSales(Model, from, to, extraMatch = {}) {
  const rows = await Model.aggregate([
    {
      $addFields: {
        purchaseDate: { $ifNull: ["$ngayMua", "$CreatedAt"] },
      },
    },
    {
      $match: {
        purchaseDate: { $gte: from, $lte: to },
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
  ]);
  return {
    count: Number(rows[0]?.count) || 0,
    revenue: Number(rows[0]?.revenue) || 0,
  };
}

async function aggregatePackageSalesAllTime(Model, extraMatch = {}) {
  const rows = await Model.aggregate([
    {
      $match: {
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
  ]);
  return {
    count: Number(rows[0]?.count) || 0,
    revenue: Number(rows[0]?.revenue) || 0,
  };
}

async function aggregateDailyPackageRevenue(Model, from, to, extraMatch = {}) {
  return Model.aggregate([
    {
      $addFields: {
        purchaseDate: { $ifNull: ["$ngayMua", "$CreatedAt"] },
      },
    },
    {
      $match: {
        purchaseDate: { $gte: from, $lte: to },
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" },
        },
        count: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function aggregatePackageBreakdown(Model, from, to, extraMatch = {}) {
  return Model.aggregate([
    {
      $addFields: {
        purchaseDate: { $ifNull: ["$ngayMua", "$CreatedAt"] },
      },
    },
    {
      $match: {
        purchaseDate: { $gte: from, $lte: to },
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$planName", "Gói không tên"] },
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
    { $sort: { revenue: -1, count: -1 } },
    { $limit: 10 },
  ]);
}

async function aggregatePackageBreakdownAllTime(Model, extraMatch = {}) {
  return Model.aggregate([
    {
      $match: {
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$planName", "Gói không tên"] },
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
    { $sort: { revenue: -1, count: -1 } },
    { $limit: 10 },
  ]);
}

function mapPlanBreakdownRows(rows) {
  return rows.map((row) => ({
    planName: row._id || "Gói không tên",
    count: Number(row.count) || 0,
    revenue: Number(row.revenue) || 0,
  }));
}

const CANCELLED_RESERVATION_STATUSES = [RESERVATION_STATUS.CANCELLED];

const COMPLETED_RESERVATION_STATUSES = [RESERVATION_STATUS.COMPLETED];

/** Đơn đã giao / đang escrow / hoàn tất — dùng cho bảng xếp hạng doanh thu. */
const SOLD_RESERVATION_STATUSES = [
  RESERVATION_STATUS.PICKUP_CONFIRMED,
  RESERVATION_STATUS.DISPUTED,
  RESERVATION_STATUS.COMPLETED,
];

/** Giá trị đơn / cọc: mọi đơn không ở trạng thái đã hủy. */
function orderValueStatusMatch() {
  return { status: { $nin: CANCELLED_RESERVATION_STATUSES } };
}

/** Đơn bán trong kỳ: đã giao (2–4) và (tạo trong kỳ hoặc nhận hàng trong kỳ). */
function rankingSalesInWindowMatch(from, to) {
  return {
    status: { $in: SOLD_RESERVATION_STATUSES },
    $or: [
      reservationCreatedInRange(from, to),
      reservationCompletedWindowMatch(from, to),
    ],
  };
}

async function aggregateTopReportedShops(from, to) {
  return Report.aggregate([
    { $match: { CreatedAt: { $gte: from, $lte: to } } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $lookup: {
        from: "reviews",
        localField: "reviewId",
        foreignField: "_id",
        as: "review",
      },
    },
    {
      $addFields: {
        resolvedShopId: {
          $ifNull: [
            "$shopId",
            {
              $ifNull: [
                { $arrayElemAt: ["$product.ShopId", 0] },
                { $arrayElemAt: ["$review.shopId", 0] },
              ],
            },
          ],
        },
      },
    },
    { $match: { resolvedShopId: { $ne: null } } },
    { $group: { _id: "$resolvedShopId", reportCount: { $sum: 1 } } },
    { $sort: { reportCount: -1 } },
    { $limit: 10 },
  ]);
}

/** Fallback khi chưa có đủ đơn hoàn tất: ước lượng từ SoldCount trên catalog. */
async function aggregateTopSellingShopsFromCatalog(limit = 10) {
  const revenueRows = await Product.aggregate([
    {
      $match: {
        ...notRemovedProductMatch(),
        SoldCount: { $gt: 0 },
        ShopId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$ShopId",
        revenue: {
          $sum: {
            $multiply: [
              { $ifNull: ["$SoldCount", 0] },
              {
                $ifNull: [
                  "$MinPrice",
                  { $ifNull: ["$MaxPrice", 0] },
                ],
              },
            ],
          },
        },
        orders: { $sum: { $ifNull: ["$SoldCount", 0] } },
      },
    },
  ]);
  const revenueByShopId = new Map(
    revenueRows.map((row) => [String(row._id || ""), row])
  );

  const shops = await ShopProfile.find({ soldCount: { $gt: 0 } })
    .sort({ soldCount: -1 })
    .limit(limit)
    .select("shopName shopUsername avatar userId soldCount")
    .lean();

  return shops
    .map((shop) => {
      const revenueRow = revenueByShopId.get(String(shop._id));
      return {
        _id: shop._id,
        revenue: Number(revenueRow?.revenue) || 0,
        orders: Number(revenueRow?.orders) || Number(shop.soldCount) || 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, limit);
}

async function loadTopSellingProductsFromCatalog(limit = 10) {
  return Product.find({
    ...notRemovedProductMatch(),
    SoldCount: { $gt: 0 },
  })
    .sort({ SoldCount: -1, MinPrice: -1 })
    .limit(limit)
    .select("ProductName Thumbnail images ShopId SoldCount MinPrice MaxPrice")
    .lean();
}

/** Reservation dùng createdAt; giữ $or CreatedAt cho dữ liệu legacy. */
function reservationCreatedInRange(from, to) {
  return {
    $or: [
      { createdAt: { $gte: from, $lte: to } },
      { CreatedAt: { $gte: from, $lte: to } },
    ],
  };
}

function reservationUpdatedInRange(from, to) {
  return {
    $or: [
      { updatedAt: { $gte: from, $lte: to } },
      { UpdatedAt: { $gte: from, $lte: to } },
    ],
  };
}

function reservationCreatedInRangeMatch(from, to, extraMatch = {}) {
  return {
    $and: [reservationCreatedInRange(from, to), extraMatch],
  };
}

function reservationDepositInWindowMatch(from, to) {
  return reservationCreatedInRangeMatch(from, to, {
    ...orderValueStatusMatch(),
    depositAmount: { $gt: 0 },
  });
}

function reservationDepositAllTimeMatch() {
  return {
    ...orderValueStatusMatch(),
    depositAmount: { $gt: 0 },
  };
}

function orderValueInWindowMatch(from, to) {
  return reservationCreatedInRangeMatch(from, to, orderValueStatusMatch());
}

async function aggregateReservationDailyCount(from, to, extraMatch = {}) {
  return Reservation.aggregate([
    {
      $match: reservationCreatedInRangeMatch(from, to, extraMatch),
    },
    {
      $addFields: {
        _eventAt: { $ifNull: ["$createdAt", "$CreatedAt"] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$_eventAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function aggregateReservationDailyDepositSum(from, to) {
  return aggregateReservationDailyFieldSum(from, to, {
    ...orderValueStatusMatch(),
    depositAmount: { $gt: 0 },
  }, "depositAmount");
}

async function aggregateReservationDailyFieldSum(from, to, extraMatch, sumField) {
  return Reservation.aggregate([
    {
      $match: reservationCreatedInRangeMatch(from, to, extraMatch),
    },
    {
      $addFields: {
        _eventAt: { $ifNull: ["$createdAt", "$CreatedAt"] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$_eventAt" },
        },
        count: { $sum: `$${sumField}` },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function completedInWindowMatch(from, to) {
  return {
    status: { $in: COMPLETED_RESERVATION_STATUSES },
    ...reservationCompletedWindowMatch(from, to),
  };
}

function approvedWithdrawInWindowMatch(from, to) {
  return {
    status: WITHDRAW_STATUS.APPROVED,
    $or: [
      { tgXuLy: { $gte: from, $lte: to } },
      { tgXuLy: null, UpdatedAt: { $gte: from, $lte: to } },
    ],
  };
}

/** Đếm nhanh các chỉ số của một khoảng thời gian (dùng cho kỳ trước để so sánh). */
async function collectPeriodMetrics(from, to) {
  const createdInWindow = { CreatedAt: { $gte: from, $lte: to } };
  const [
    newUsers,
    newSellers,
    newProducts,
    newReservations,
    completedReservationDocs,
    orderValueReservationDocs,
    cancelledReservations,
    disputedReservations,
    sellerPlanSales,
    bannerPlanSales,
    depositRows,
    topupRows,
    withdrawRows,
    sellerVerificationRequests,
    newReports,
    reportedShopIdsInWindow,
    newBanners,
    escrowRows,
  ] = await Promise.all([
    User.countDocuments({ ...createdInWindow, Role: { $ne: USER_ROLE.ADMIN } }),
    ShopProfile.countDocuments(createdInWindow),
    Product.countDocuments({ ...createdInWindow, ...notRemovedProductMatch() }),
    Reservation.countDocuments(reservationCreatedInRangeMatch(from, to)),
    Reservation.find(completedInWindowMatch(from, to))
      .select("agreedPrice reservedPrice quantity")
      .lean(),
    Reservation.find(orderValueInWindowMatch(from, to))
      .select("agreedPrice reservedPrice quantity")
      .lean(),
    Reservation.countDocuments({
      status: { $in: CANCELLED_RESERVATION_STATUSES },
      $or: [
        { cancelledAt: { $gte: from, $lte: to } },
        {
          cancelledAt: null,
          ...reservationUpdatedInRange(from, to),
        },
      ],
    }),
    ReservationDispute.countDocuments({ createdAt: { $gte: from, $lte: to } }),
    aggregatePackageSales(SellerSubscription, from, to, {
      status: { $ne: SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT },
    }),
    aggregatePackageSales(SellerBannerPlan, from, to),
    Reservation.aggregate([
      { $match: reservationDepositInWindowMatch(from, to) },
      { $group: { _id: null, amount: { $sum: "$depositAmount" }, count: { $sum: 1 } } },
    ]),
    WalletTransaction.aggregate([
      {
        $match: {
          type: WALLET_TX_TYPE.TOPUP,
          status: WALLET_TX_STATUS.SUCCESS,
          CreatedAt: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    WithdrawRequest.aggregate([
      { $match: approvedWithdrawInWindowMatch(from, to) },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    SellerVerification.countDocuments(createdInWindow),
    Report.countDocuments(createdInWindow),
    Report.distinct("shopId", { ...createdInWindow, shopId: { $ne: null } }),
    countActiveBannersAt(to),
    // Cọc đang treo (chưa quyết toán) phát sinh trong kỳ.
    Reservation.aggregate([
      {
        $match: reservationCreatedInRangeMatch(from, to, {
          cocChuyenDen: 0,
          depositAmount: { $gt: 0 },
        }),
      },
      { $group: { _id: null, amount: { $sum: "$depositAmount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const orderValue = orderValueReservationDocs.reduce(
    (sum, doc) => sum + computeTotal(doc),
    0
  );

  return {
    newUsers,
    newSellers,
    newProducts,
    newReservations,
    completedReservations: completedReservationDocs.length,
    cancelledReservations,
    disputedReservations,
    sellerPlanRevenue: sellerPlanSales.revenue,
    sellerPlansSold: sellerPlanSales.count,
    bannerPlanRevenue: bannerPlanSales.revenue,
    bannerPlansSold: bannerPlanSales.count,
    depositAmount: Number(depositRows[0]?.amount) || 0,
    depositCount: Number(depositRows[0]?.count) || 0,
    topupAmount: Number(topupRows[0]?.amount) || 0,
    topupCount: Number(topupRows[0]?.count) || 0,
    withdrawAmount: Number(withdrawRows[0]?.amount) || 0,
    withdrawCount: Number(withdrawRows[0]?.count) || 0,
    sellerVerificationRequests,
    newReports,
    reportedShops: reportedShopIdsInWindow.length,
    newBanners,
    escrowAmount: Number(escrowRows[0]?.amount) || 0,
    escrowCount: Number(escrowRows[0]?.count) || 0,
    orderValue,
    /** @deprecated alias — dùng orderValue */
    orderRevenue: orderValue,
    revenue: sellerPlanSales.revenue + bannerPlanSales.revenue,
    platformRevenue:
      (Number(depositRows[0]?.amount) || 0) +
      sellerPlanSales.revenue +
      bannerPlanSales.revenue,
  };
}

async function getAdminDashboard(query = {}) {
  const { range, from, to, allTime } = resolveDateRange(query);
  const createdInRange = { CreatedAt: { $gte: from, $lte: to } };
  const emptySeries = buildEmptySeries(from, to);
  const now = new Date();

  // Kỳ trước có cùng độ dài để tính % tăng giảm.
  const periodDays = Math.max(
    1,
    Math.round((startOfDay(to) - startOfDay(from)) / (24 * 60 * 60 * 1000)) + 1
  );
  const prevFrom = startOfDay(addDays(from, -periodDays));
  const prevTo = endOfDay(addDays(from, -1));
  const monthFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthTo = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const paidSellerSubscriptionMatch = {
    status: { $ne: SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT },
  };

  const [
    totalUsers,
    totalBuyers,
    totalSellers,
    totalAdmins,
    totalShops,
    totalActiveShops,
    tongSP,
    totalActiveProducts,
    totalReservations,
    reservationsByStatus,
    usersInRange,
    sellersInRange,
    shopsInRange,
    productsInRange,
    reservationsInRange,
    completedReservations,
    topFavoriteProducts,
    topShops,
    followInRange,
    favoriteProductsInRange,
    systemWallet,
    unsettledDeposits,
    sellerPlanSalesInRange,
    bannerPlanSalesInRange,
    sellerPlanSalesAllTime,
    bannerPlanSalesAllTime,
    sellerPlanSalesThisMonth,
    bannerPlanSalesThisMonth,
    sellerPlanBreakdownInRange,
    bannerPlanBreakdownInRange,
    sellerPlanBreakdownAllTime,
    bannerPlanBreakdownAllTime,
    currentPeriod,
    previousPeriod,
    pendingSellerVerifications,
    pendingReports,
    reportedShopIds,
    pendingBanners,
    pendingWithdrawRows,
    sellerPlanRevenueDaily,
    bannerPlanRevenueDaily,
    completedForRevenueSeries,
    completedDaily,
    cancelledDaily,
    disputedDaily,
    depositDaily,
    topupDaily,
    withdrawDaily,
    sellerVerificationDaily,
    reportDaily,
    reportedShopDaily,
    bannerDaily,
    escrowDaily,
    tongDG,
    totalReports,
    pendingReservationDisputes,
    depositAllTimeRows,
    orderValueAllTimeRows,
    topReportedShopRows,
  ] = await Promise.all([
    User.countDocuments({ Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ Role: USER_ROLE.BUYER }),
    ShopProfile.countDocuments({}),
    User.countDocuments({ Role: USER_ROLE.ADMIN }),
    ShopProfile.countDocuments({}),
    ShopProfile.countDocuments({ status: SHOP_STATUS.ACTIVE }),
    Product.countDocuments(notRemovedProductMatch()),
    Product.countDocuments({ ...notRemovedProductMatch(), Status: PRODUCT_STATUS.ACTIVE }),
    Reservation.countDocuments({}),
    Reservation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    aggregateDailyCount(User, {
      ...createdInRange,
      Role: { $ne: USER_ROLE.ADMIN },
    }),
    aggregateDailyCount(ShopProfile, createdInRange),
    aggregateDailyCount(ShopProfile, createdInRange),
    aggregateDailyCount(Product, {
      ...createdInRange,
      ...notRemovedProductMatch(),
    }),
    aggregateReservationDailyCount(from, to),
    Reservation.find(rankingSalesInWindowMatch(from, to))
      .select("shopId productId agreedPrice reservedPrice quantity tgNhanHang updatedAt createdAt CreatedAt")
      .lean(),
    FavoriteProduct.aggregate([
      { $group: { _id: "$productId", likeCount: { $sum: 1 } } },
      { $sort: { likeCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "shopprofiles",
          localField: "product.ShopId",
          foreignField: "_id",
          as: "shop",
        },
      },
      { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: { $ifNull: ["$product.ProductName", "Sản phẩm"] },
          thumbnail: { $ifNull: ["$product.Thumbnail", ""] },
          likeCount: 1,
          productLikeCount: { $ifNull: ["$product.LikeCount", 0] },
          shopId: "$shop._id",
          shopName: { $ifNull: ["$shop.shopName", "Gian hàng"] },
        },
      },
    ]),
    ShopProfile.find({ status: SHOP_STATUS.ACTIVE })
      .sort({ diemTB: -1, soNguoiTheo: -1, soldCount: -1, tongSP: -1 })
      .limit(10)
      .select(
        "shopName shopUsername avatar diemTB soNguoiTheo tongSP soldCount tongDG DiaChiHeThong address isOpen userId"
      )
      .lean(),
    aggregateDailyCount(Follow, createdInRange),
    aggregateDailyCount(FavoriteProduct, createdInRange),
    SystemWallet.findOne().sort({ _id: 1 }).lean(),
    Reservation.aggregate([
      {
        $match: {
          cocChuyenDen: 0,
          depositAmount: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$depositAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    aggregatePackageSales(
      SellerSubscription,
      from,
      to,
      paidSellerSubscriptionMatch
    ),
    aggregatePackageSales(SellerBannerPlan, from, to),
    aggregatePackageSalesAllTime(SellerSubscription, paidSellerSubscriptionMatch),
    aggregatePackageSalesAllTime(SellerBannerPlan),
    aggregatePackageSales(
      SellerSubscription,
      monthFrom,
      monthTo,
      paidSellerSubscriptionMatch
    ),
    aggregatePackageSales(SellerBannerPlan, monthFrom, monthTo),
    aggregatePackageBreakdown(
      SellerSubscription,
      from,
      to,
      paidSellerSubscriptionMatch
    ),
    aggregatePackageBreakdown(SellerBannerPlan, from, to),
    aggregatePackageBreakdownAllTime(SellerSubscription, paidSellerSubscriptionMatch),
    aggregatePackageBreakdownAllTime(SellerBannerPlan),
    collectPeriodMetrics(from, to),
    collectPeriodMetrics(prevFrom, prevTo),
    SellerVerification.countDocuments({
      status: SELLER_VERIFICATION_STATUS.PENDING,
    }),
    Report.countDocuments(pendingContentReportFilter()),
    Report.distinct("shopId", {
      $and: [...pendingContentReportFilter().$and, { shopId: { $ne: null } }],
    }),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.PENDING_REVIEW,
    }),
    WithdrawRequest.aggregate([
      { $match: { status: WITHDRAW_STATUS.PENDING } },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    aggregateDailyPackageRevenue(
      SellerSubscription,
      from,
      to,
      paidSellerSubscriptionMatch
    ),
    aggregateDailyPackageRevenue(SellerBannerPlan, from, to),
    Reservation.find(completedInWindowMatch(from, to))
      .select("agreedPrice reservedPrice quantity tgNhanHang updatedAt")
      .lean(),
    aggregateDailyCountWithFallback(
      Reservation,
      completedInWindowMatch(from, to),
      "tgNhanHang",
      "updatedAt"
    ),
    aggregateDailyCountWithFallback(
      Reservation,
      {
        status: { $in: CANCELLED_RESERVATION_STATUSES },
        $or: [
          { cancelledAt: { $gte: from, $lte: to } },
          {
            cancelledAt: null,
            ...reservationUpdatedInRange(from, to),
          },
        ],
      },
      "cancelledAt",
      "updatedAt"
    ),
    aggregateDailyCount(
      ReservationDispute,
      { createdAt: { $gte: from, $lte: to } },
      "createdAt"
    ),
    aggregateReservationDailyDepositSum(from, to),
    aggregateDailySum(
      WalletTransaction,
      {
        type: WALLET_TX_TYPE.TOPUP,
        status: WALLET_TX_STATUS.SUCCESS,
        CreatedAt: { $gte: from, $lte: to },
      },
      "CreatedAt",
      "amount"
    ),
    aggregateDailySumWithFallback(
      WithdrawRequest,
      approvedWithdrawInWindowMatch(from, to),
      "tgXuLy",
      "UpdatedAt",
      "amount"
    ),
    aggregateDailyCount(SellerVerification, createdInRange),
    aggregateDailyCount(Report, createdInRange),
    // Số shop bị báo cáo (không trùng) theo ngày.
    Report.aggregate([
      { $match: { ...createdInRange, shopId: { $ne: null } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$CreatedAt" } },
            shopId: "$shopId",
          },
        },
      },
      { $group: { _id: "$_id.day", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    aggregateDailyActiveBannerCount(from, to),
    aggregateReservationDailyFieldSum(from, to, {
      cocChuyenDen: 0,
      depositAmount: { $gt: 0 },
    }, "depositAmount"),
    Review.countDocuments(notDeletedReviewFilter()),
    Report.countDocuments({}),
    ReservationDispute.countDocuments({ status: DISPUTE_STATUS.PENDING }),
    Reservation.aggregate([
      { $match: reservationDepositAllTimeMatch() },
      { $group: { _id: null, amount: { $sum: "$depositAmount" } } },
    ]),
    Reservation.aggregate([
      { $match: orderValueStatusMatch() },
      {
        $group: {
          _id: null,
          amount: {
            $sum: {
              $multiply: [
                { $ifNull: ["$agreedPrice", { $ifNull: ["$reservedPrice", 0] }] },
                { $ifNull: ["$quantity", 0] },
              ],
            },
          },
        },
      },
    ]),
    aggregateTopReportedShops(from, to),
  ]);

  const topShopOwnerIds = [
    ...new Set(topShops.map((shop) => String(shop.userId || "")).filter(Boolean)),
  ];
  const topShopOwners = topShopOwnerIds.length
    ? await User.find({ _id: { $in: topShopOwnerIds } }).select("Avatar FullName").lean()
    : [];
  const topShopOwnerById = new Map(topShopOwners.map((user) => [String(user._id), user]));

  const revenueByShopMap = new Map();
  let periodRevenue = 0;
  for (const reservation of completedReservations) {
    const amount = computeTotal(reservation);
    periodRevenue += amount;
    const shopKey = String(reservation.shopId || "");
    if (!shopKey) {
      continue;
    }
    const current = revenueByShopMap.get(shopKey) || { shopId: shopKey, revenue: 0, orders: 0 };
    current.revenue += amount;
    current.orders += 1;
    revenueByShopMap.set(shopKey, current);
  }

  const revenueShopIds = [...revenueByShopMap.keys()];
  const revenueShops = revenueShopIds.length
    ? await ShopProfile.find({ _id: { $in: revenueShopIds } })
        .select("shopName shopUsername avatar userId")
        .lean()
    : [];
  const revenueOwnerIds = [
    ...new Set(revenueShops.map((shop) => String(shop.userId || "")).filter(Boolean)),
  ];
  const revenueOwners = revenueOwnerIds.length
    ? await User.find({ _id: { $in: revenueOwnerIds } }).select("Avatar FullName").lean()
    : [];
  const revenueShopById = new Map(revenueShops.map((shop) => [String(shop._id), shop]));
  const revenueOwnerById = new Map(revenueOwners.map((user) => [String(user._id), user]));

  // Danh sách đầy đủ (frontend hiển thị top 10, nút "Xem tất cả" mở toàn bộ).
  let topSellingShops = [...revenueByShopMap.values()]
    .map((row) => {
      const shop = revenueShopById.get(row.shopId);
      const owner = shop ? revenueOwnerById.get(String(shop.userId || "")) : null;
      return {
        shopId: row.shopId,
        shopName: resolveShopDisplayName(shop, owner),
        shopUsername: resolveShopUsername(shop, owner),
        avatar: resolveShopAvatar(shop, owner),
        revenue: row.revenue,
        orders: row.orders,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  if (!topSellingShops.length || allTime) {
    const catalogShopRows = await aggregateTopSellingShopsFromCatalog(10);
    const catalogShopIds = catalogShopRows.map((row) => String(row._id || "")).filter(Boolean);
    const catalogShops = catalogShopIds.length
      ? await ShopProfile.find({ _id: { $in: catalogShopIds } })
          .select("shopName shopUsername avatar userId")
          .lean()
      : [];
    const catalogOwnerIds = [
      ...new Set(catalogShops.map((shop) => String(shop.userId || "")).filter(Boolean)),
    ];
    const catalogOwners = catalogOwnerIds.length
      ? await User.find({ _id: { $in: catalogOwnerIds } }).select("Avatar FullName").lean()
      : [];
    const catalogShopById = new Map(catalogShops.map((shop) => [String(shop._id), shop]));
    const catalogOwnerById = new Map(catalogOwners.map((user) => [String(user._id), user]));
    topSellingShops = catalogShopRows.map((row) => {
      const shopId = String(row._id || "");
      const shop = catalogShopById.get(shopId);
      const owner = shop ? catalogOwnerById.get(String(shop.userId || "")) : null;
      return {
        shopId,
        shopName: resolveShopDisplayName(shop, owner),
        shopUsername: resolveShopUsername(shop, owner),
        avatar: resolveShopAvatar(shop, owner),
        revenue: Number(row.revenue) || 0,
        orders: Number(row.orders) || 0,
      };
    });
    for (const shop of catalogShops) {
      revenueShopById.set(String(shop._id), shop);
    }
    for (const owner of catalogOwners) {
      revenueOwnerById.set(String(owner._id), owner);
    }
  }

  const revenueByShop = topSellingShops.slice(0, 10);

  // Sản phẩm bán chạy trong kỳ (theo số lượng bán từ đơn hoàn thành).
  const productSalesMap = new Map();
  for (const reservation of completedReservations) {
    const productKey = String(reservation.productId || "");
    if (!productKey) {
      continue;
    }
    const current = productSalesMap.get(productKey) || {
      productId: productKey,
      shopId: String(reservation.shopId || ""),
      revenue: 0,
      soldQuantity: 0,
      orders: 0,
    };
    current.revenue += computeTotal(reservation);
    current.soldQuantity += Number(reservation.quantity) || 0;
    current.orders += 1;
    productSalesMap.set(productKey, current);
  }
  const topProductRows = [...productSalesMap.values()].sort(
    (a, b) => b.soldQuantity - a.soldQuantity || b.revenue - a.revenue
  );
  const topProductIds = topProductRows.map((row) => row.productId);
  const [topProductDocs] = topProductIds.length
    ? await Promise.all([
        Product.find({ _id: { $in: topProductIds } })
          .select("ProductName Thumbnail images")
          .lean(),
      ])
    : [[]];
  const topProductById = new Map(
    topProductDocs.map((product) => [String(product._id), product])
  );
  const coverByProductId = new Map(
    topProductDocs.map((product) => [
      String(product._id),
      (Array.isArray(product.images) && product.images[0]) || product.Thumbnail || "",
    ])
  );
  let topSellingProducts = topProductRows.map((row) => {
    const product = topProductById.get(row.productId);
    const shop = revenueShopById.get(row.shopId);
    const owner = shop ? revenueOwnerById.get(String(shop.userId || "")) : null;
    return {
      productId: row.productId,
      name: product?.ProductName || "Sản phẩm",
      thumbnail: coverByProductId.get(row.productId) || product?.Thumbnail || "",
      shopName: resolveShopDisplayName(shop, owner),
      soldQuantity: row.soldQuantity,
      revenue: row.revenue,
      orders: row.orders,
    };
  });

  if (!topSellingProducts.length || allTime) {
    const catalogProducts = await loadTopSellingProductsFromCatalog(10);
    const catalogProductShopIds = [
      ...new Set(catalogProducts.map((product) => String(product.ShopId || "")).filter(Boolean)),
    ];
    const catalogProductShops = catalogProductShopIds.length
      ? await ShopProfile.find({ _id: { $in: catalogProductShopIds } })
          .select("shopName shopUsername avatar userId")
          .lean()
      : [];
    const catalogProductOwnerIds = [
      ...new Set(
        catalogProductShops.map((shop) => String(shop.userId || "")).filter(Boolean)
      ),
    ];
    const catalogProductOwners = catalogProductOwnerIds.length
      ? await User.find({ _id: { $in: catalogProductOwnerIds } }).select("Avatar FullName").lean()
      : [];
    const catalogProductShopById = new Map(
      catalogProductShops.map((shop) => [String(shop._id), shop])
    );
    const catalogProductOwnerById = new Map(
      catalogProductOwners.map((user) => [String(user._id), user])
    );
    topSellingProducts = catalogProducts.map((product) => {
      const shopId = String(product.ShopId || "");
      const shop = catalogProductShopById.get(shopId);
      const owner = shop ? catalogProductOwnerById.get(String(shop.userId || "")) : null;
      const unitPrice = Number(product.MinPrice ?? product.MaxPrice) || 0;
      const soldQuantity = Number(product.SoldCount) || 0;
      return {
        productId: String(product._id),
        name: product.ProductName || "Sản phẩm",
        thumbnail:
          (Array.isArray(product.images) && product.images[0]) || product.Thumbnail || "",
        shopName: resolveShopDisplayName(shop, owner),
        soldQuantity,
        revenue: unitPrice * soldQuantity,
        orders: soldQuantity,
      };
    });
  }

  const topReportedShopIds = (topReportedShopRows || [])
    .map((row) => String(row._id || ""))
    .filter(Boolean);
  const topReportedShopDocs = topReportedShopIds.length
    ? await ShopProfile.find({ _id: { $in: topReportedShopIds } })
        .select("shopName shopUsername avatar userId")
        .lean()
    : [];
  const topReportedOwnerIds = [
    ...new Set(
      topReportedShopDocs.map((shop) => String(shop.userId || "")).filter(Boolean)
    ),
  ];
  const topReportedOwners = topReportedOwnerIds.length
    ? await User.find({ _id: { $in: topReportedOwnerIds } })
        .select("Avatar FullName")
        .lean()
    : [];
  const topReportedShopById = new Map(
    topReportedShopDocs.map((shop) => [String(shop._id), shop])
  );
  const topReportedOwnerById = new Map(
    topReportedOwners.map((user) => [String(user._id), user])
  );
  const topReportedShops = (topReportedShopRows || []).map((row) => {
    const shopId = String(row._id || "");
    const shop = topReportedShopById.get(shopId);
    const owner = shop ? topReportedOwnerById.get(String(shop.userId || "")) : null;
    return {
      shopId,
      shopName: resolveShopDisplayName(shop, owner),
      shopUsername: resolveShopUsername(shop, owner),
      avatar: resolveShopAvatar(shop, owner),
      reportCount: Number(row.reportCount) || 0,
    };
  });

  const statusLabel = {
    [RESERVATION_STATUS.PENDING]: "Chờ xác nhận",
    [RESERVATION_STATUS.WAITING_PICKUP]: "Giữ hàng",
    [RESERVATION_STATUS.PICKUP_CONFIRMED]: "Đã nhận hàng",
    [RESERVATION_STATUS.DISPUTED]: "Tranh chấp",
    [RESERVATION_STATUS.COMPLETED]: "Hoàn thành",
    [RESERVATION_STATUS.CANCELLED]: "Đã hủy",
  };

  const reservationStatusPie = [0, 1, 2, 3, 4, 5].map((status) => {
    const found = reservationsByStatus.find((row) => Number(row._id) === status);
    return {
      status,
      label: statusLabel[status] || `Trạng thái ${status}`,
      value: Number(found?.count) || 0,
    };
  });

  const disputedReservationsCount =
    Number(
      reservationsByStatus.find((row) => Number(row._id) === RESERVATION_STATUS.DISPUTED)?.count
    ) || 0;

  const rolePie = [
    { key: "buyers", label: "Người mua", value: totalBuyers },
    { key: "sellers", label: "Gian hàng", value: totalSellers },
    { key: "admins", label: "Admin", value: totalAdmins },
  ];

  const topShopsMapped = topShops.map((shop) => {
    const owner = topShopOwnerById.get(String(shop.userId || ""));
    const shopName = resolveShopDisplayName(shop, owner);
    return {
      shopId: String(shop._id),
      shopName,
      name: shopName,
      avatar: resolveShopAvatar(shop, owner),
      logo: resolveShopAvatar(shop, owner),
      rating: Number(shop.diemTB) || 0,
      soNguoiTheo: Number(shop.soNguoiTheo) || 0,
      tongSP: Number(shop.tongSP) || 0,
      soldCount: Number(shop.soldCount) || 0,
      tongDG: Number(shop.tongDG) || 0,
      address: shop.addressHeThong || shop.DiaChiHeThong || shop.address || "",
      isOpen: Number(shop.isOpen) === 1,
    };
  });

  const [activeUsers, blockedUsers] = await Promise.all([
    User.countDocuments({ Status: USER_STATUS.ACTIVE, Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ Status: USER_STATUS.BLOCKED }),
  ]);

  const newUsersInRange = usersInRange.reduce(
    (sum, row) => sum + (Number(row.count) || 0),
    0
  );
  const reservationsCountInRange = reservationsInRange.reduce(
    (sum, row) => sum + (Number(row.count) || 0),
    0
  );
  const escrowByReservations = unsettledDeposits[0] || {};
  const depositAllTime = Number(depositAllTimeRows[0]?.amount) || 0;
  const orderValueAllTime = Number(orderValueAllTimeRows[0]?.amount) || 0;
  const packageRevenueAllTime =
    sellerPlanSalesAllTime.revenue + bannerPlanSalesAllTime.revenue;
  const platformRevenueAllTime =
    packageRevenueAllTime + depositAllTime;

  // Chuỗi doanh thu theo ngày = gói seller + banner (tiền nền tảng thu).
  const sellerRevenueSeries = fillSeries(emptySeries, sellerPlanRevenueDaily);
  const bannerRevenueSeries = fillSeries(emptySeries, bannerPlanRevenueDaily);
  const orderRevenueByDay = new Map(emptySeries.map((item) => [item.date, 0]));
  for (const reservation of completedForRevenueSeries) {
    const key = toDateKey(getPickupConfirmedAt(reservation) || getReservationUpdatedAt(reservation));
    if (orderRevenueByDay.has(key)) {
      orderRevenueByDay.set(
        key,
        orderRevenueByDay.get(key) + computeTotal(reservation)
      );
    }
  }
  const revenueOverTime = emptySeries.map((item, index) => ({
    date: item.date,
    value:
      (sellerRevenueSeries[index]?.value || 0) +
      (bannerRevenueSeries[index]?.value || 0),
    orderValue: orderRevenueByDay.get(item.date) || 0,
  }));

  return {
    range,
    from,
    to,
    periodDays,
    previousPeriod: { from: prevFrom, to: prevTo, ...previousPeriod },
    metrics: currentPeriod,
    pending: {
      sellerVerifications: pendingSellerVerifications,
      reports: pendingReports,
      reportedShops: reportedShopIds.length,
      banners: pendingBanners,
      withdrawAmount: Number(pendingWithdrawRows[0]?.amount) || 0,
      withdrawCount: Number(pendingWithdrawRows[0]?.count) || 0,
      reservationDisputes: pendingReservationDisputes,
    },
    cards: {
      totalUsers,
      totalBuyers,
      totalSellers,
      totalShops,
      totalActiveShops,
      tongSP,
      totalActiveProducts,
      totalReservations,
      tongDG,
      totalReports,
      disputedReservations: disputedReservationsCount,
      periodRevenue,
      activeUsers,
      blockedUsers,
      newUsersInRange,
      reservationsInRange: reservationsCountInRange,
      completedReservationsInRange: completedReservations.length,
      escrowBalance: Number(systemWallet?.balance) || 0,
      escrowReservationsAmount: Number(escrowByReservations.amount) || 0,
      escrowReservationsCount: Number(escrowByReservations.count) || 0,
      sellerPlansSoldInRange: sellerPlanSalesInRange.count,
      sellerPlanRevenueInRange: sellerPlanSalesInRange.revenue,
      sellerPlansSoldAllTime: sellerPlanSalesAllTime.count,
      sellerPlanRevenueAllTime: sellerPlanSalesAllTime.revenue,
      bannerPlansSoldInRange: bannerPlanSalesInRange.count,
      bannerPlanRevenueInRange: bannerPlanSalesInRange.revenue,
      bannerPlansSoldAllTime: bannerPlanSalesAllTime.count,
      bannerPlanRevenueAllTime: bannerPlanSalesAllTime.revenue,
      sellerPlansSoldThisMonth: sellerPlanSalesThisMonth.count,
      sellerPlanRevenueThisMonth: sellerPlanSalesThisMonth.revenue,
      bannerPlansSoldThisMonth: bannerPlanSalesThisMonth.count,
      bannerPlanRevenueThisMonth: bannerPlanSalesThisMonth.revenue,
      platformRevenueAllTime,
      packageRevenueAllTime,
      depositAllTime,
      orderValueAllTime,
    },
    charts: {
      usersOverTime: fillSeries(emptySeries, usersInRange),
      sellersOverTime: fillSeries(emptySeries, sellersInRange),
      shopsOverTime: fillSeries(emptySeries, shopsInRange),
      productsOverTime: fillSeries(emptySeries, productsInRange),
      reservationsOverTime: fillSeries(emptySeries, reservationsInRange),
      revenueOverTime,
      completedOverTime: fillSeries(emptySeries, completedDaily),
      cancelledOverTime: fillSeries(emptySeries, cancelledDaily),
      disputedOverTime: fillSeries(emptySeries, disputedDaily),
      depositOverTime: fillSeries(emptySeries, depositDaily),
      topupOverTime: fillSeries(emptySeries, topupDaily),
      withdrawOverTime: fillSeries(emptySeries, withdrawDaily),
      sellerVerificationsOverTime: fillSeries(emptySeries, sellerVerificationDaily),
      reportsOverTime: fillSeries(emptySeries, reportDaily),
      reportedShopsOverTime: fillSeries(emptySeries, reportedShopDaily),
      bannersOverTime: fillSeries(emptySeries, bannerDaily),
      escrowOverTime: fillSeries(emptySeries, escrowDaily),
      sellerPlanRevenueOverTime: sellerRevenueSeries,
      bannerPlanRevenueOverTime: bannerRevenueSeries,
      followsOverTime: fillSeries(emptySeries, followInRange),
      favoriteProductsOverTime: fillSeries(emptySeries, favoriteProductsInRange),
      reservationStatusPie,
      rolePie,
      revenueByShop,
    },
    rankings: {
      topFavoriteProducts: topFavoriteProducts.map((row) => ({
        productId: String(row.productId || ""),
        name: row.name || "Sản phẩm",
        thumbnail: row.thumbnail || "",
        likeCount: Number(row.likeCount) || 0,
        productLikeCount: Number(row.productLikeCount) || 0,
        shopId: row.shopId ? String(row.shopId) : "",
        shopName: row.shopName || "Gian hàng",
      })),
      topShops: topShopsMapped,
      topSellingShops,
      topSellingProducts,
      topReportedShops,
      sellerPlansInRange: mapPlanBreakdownRows(sellerPlanBreakdownInRange),
      bannerPlansInRange: mapPlanBreakdownRows(bannerPlanBreakdownInRange),
      sellerPlansAllTime: mapPlanBreakdownRows(sellerPlanBreakdownAllTime),
      bannerPlansAllTime: mapPlanBreakdownRows(bannerPlanBreakdownAllTime),
      sellerPlansThisMonth: mapPlanBreakdownRows(sellerPlanBreakdownInRange),
      bannerPlansThisMonth: mapPlanBreakdownRows(bannerPlanBreakdownInRange),
    },
  };
}

async function getAdminPendingCounts() {
  const { countAdminPendingDisputes } = require("../utils/adminDisputeQueue");

  const [sellerVerifications, reports, withdrawRows, bannerPendingReview, disputeAdminQueue] =
    await Promise.all([
    SellerVerification.countDocuments({
      status: SELLER_VERIFICATION_STATUS.PENDING,
    }),
    Report.countDocuments(pendingContentReportFilter()),
    WithdrawRequest.aggregate([
      { $match: { status: WITHDRAW_STATUS.PENDING } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.PENDING_REVIEW,
    }),
    countAdminPendingDisputes(),
  ]);

  return {
    sellerVerifications: Number(sellerVerifications) || 0,
    reports: Number(reports) || 0,
    withdrawCount: Number(withdrawRows[0]?.count) || 0,
    bannerPendingReview: Number(bannerPendingReview) || 0,
    disputeAdminQueue: Number(disputeAdminQueue) || 0,
  };
}

module.exports = {
  getAdminDashboard,
  getAdminPendingCounts,
};
