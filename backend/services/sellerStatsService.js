const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const User = require("../models/User");
const Follow = require("../models/Follow");
const Review = require("../models/Review");
const { RESERVATION_STATUS } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const { notRemovedProductMatch } = require("../utils/productRemoval");
const { publicReviewFilter } = require("../utils/reviewVisibility");
const { getShopForSeller } = require("./shopSettingsService");
const { computeTotal } = require("./reservationService");
const {
  getPickupConfirmedAt,
  getReservationUpdatedAt,
  reservationCreatedInRange,
  reservationPickupConfirmedRangeFilter,
} = require("../utils/reservationCompat");

const CANCELLED_RESERVATION_STATUSES = [RESERVATION_STATUS.CANCELLED];

function formatDayLabel(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function getPreviousPeriodRange(from, to) {
  const spanMs = to.getTime() - from.getTime();
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(new Date(prevTo.getTime() - spanMs));
  return { prevFrom, prevTo };
}

function computePercentChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev <= 0) {
    return cur > 0 ? 100 : 0;
  }
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

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

function startOfMonth(date) {
  const value = new Date(date);
  value.setDate(1);
  value.setHours(0, 0, 0, 0);
  return value;
}

function resolveStatsDateRange(query = {}) {
  const now = new Date();
  const range = String(query.range || query.period || "7d").toLowerCase();
  let from = null;
  let to = endOfDay(now);

  if (query.from || query.startDate) {
    from = startOfDay(new Date(query.from || query.startDate));
  }
  if (query.to || query.endDate) {
    to = endOfDay(new Date(query.to || query.endDate));
  }

  if (!from) {
    if (range === "1d" || range === "day" || range === "today") {
      from = startOfDay(now);
    } else if (range === "2d") {
      from = startOfDay(addDays(now, -1));
    } else if (range === "7d" || range === "week") {
      from = startOfDay(addDays(now, -6));
    } else if (range === "30d" || range === "1m" || range === "month") {
      from = startOfDay(addDays(now, -29));
    } else if (range === "3m" || range === "90d") {
      from = startOfDay(addDays(now, -89));
    } else if (range === "custom") {
      throw createServiceError("Khoảng thời gian tùy chọn cần from và to.", 400);
    } else {
      from = startOfDay(addDays(now, -6));
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
  if (to - from > maxSpanMs) {
    throw createServiceError("Khoảng thời gian tối đa là 366 ngày.", 400);
  }

  return {
    range: query.from || query.to || query.startDate || query.endDate ? "custom" : range,
    from,
    to,
  };
}

function buildRevenueTrend(completedReservations, { from, to, maxDays = 7 } = {}) {
  const rangeEnd = startOfDay(to || new Date());
  const rangeStart = startOfDay(from || addDays(rangeEnd, -(maxDays - 1)));
  const spanDays = Math.min(
    maxDays,
    Math.max(1, Math.round((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)) + 1)
  );
  const buckets = [];
  for (let offset = spanDays - 1; offset >= 0; offset -= 1) {
    const day = startOfDay(addDays(rangeEnd, -offset));
    if (day < rangeStart) {
      continue;
    }
    const dayEnd = endOfDay(day);
    let amount = 0;
    for (const reservation of completedReservations) {
      const pickupAt = getPickupConfirmedAt(reservation) || getReservationUpdatedAt(reservation);
      if (pickupAt && pickupAt >= day && pickupAt <= dayEnd) {
        amount += computeTotal(reservation);
      }
    }
    buckets.push({
      label: formatDayLabel(day),
      amount,
    });
  }
  return buckets;
}

async function sumPeriodRevenue(completedReservations, from, to) {
  let total = 0;
  for (const reservation of completedReservations) {
    const pickupAt = getPickupConfirmedAt(reservation) || getReservationUpdatedAt(reservation);
    if (pickupAt && pickupAt >= from && pickupAt <= to) {
      total += computeTotal(reservation);
    }
  }
  return total;
}

async function countPeriodCompletedOrders(shopId, from, to) {
  return Reservation.countDocuments({
    shopId,
    status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
    ...reservationPickupConfirmedRangeFilter(from, to),
  });
}

async function resolveTopSellingProducts(shopId, from, to, limit = 3) {
  const rows = await Reservation.aggregate([
    {
      $match: {
        shopId,
        productId: { $ne: null },
        status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
        ...reservationPickupConfirmedRangeFilter(from, to),
      },
    },
    { $group: { _id: "$productId", orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: limit },
  ]);
  if (!rows.length) {
    return [];
  }

  const productIds = rows.map((row) => row._id);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("ProductName images")
    .lean();

  const productById = new Map(products.map((item) => [String(item._id), item]));

  return rows
    .map((row, index) => {
      const productId = String(row._id);
      const product = productById.get(productId);
      if (!product) {
        return null;
      }
      return {
        rank: index + 1,
        productId,
        name: product.ProductName || "",
        imageUrl: (product.images && product.images[0]) || "",
        orderCount: Number(row.orderCount) || 0,
      };
    })
    .filter(Boolean);
}

async function resolveTopBuyers(shopId, from, to, limit = 3) {
  const rows = await Reservation.aggregate([
    {
      $match: {
        shopId,
        userId: { $ne: null },
        status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
        ...reservationPickupConfirmedRangeFilter(from, to),
      },
    },
    {
      $addFields: {
        orderAmount: {
          $multiply: [
            { $ifNull: ["$agreedPrice", "$reservedPrice"] },
            { $ifNull: ["$quantity", 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
        totalAmount: { $sum: "$orderAmount" },
      },
    },
    { $sort: { orderCount: -1, totalAmount: -1 } },
    { $limit: limit },
  ]);
  if (!rows.length) {
    return [];
  }

  const users = await User.find({ _id: { $in: rows.map((row) => row._id) } })
    .select("FullName UserName Avatar")
    .lean();
  const userById = new Map(users.map((item) => [String(item._id), item]));

  return rows
    .map((row, index) => {
      const user = userById.get(String(row._id));
      const name = user?.FullName || user?.UserName || "Khách hàng";
      return {
        rank: index + 1,
        userId: String(row._id),
        name,
        avatar: user?.Avatar || "",
        orderCount: Number(row.orderCount) || 0,
        totalAmount: Math.round(Number(row.totalAmount) || 0),
      };
    })
    .filter(Boolean);
}

async function resolveLatestReview(shopId) {
  const review = await Review.findOne({
    shopId,
    $and: publicReviewFilter().$and,
    comment: { $nin: ["", null] },
  })
    .sort({ CreatedAt: -1 })
    .populate("userId", "FullName UserName")
    .lean();
  if (!review) {
    return null;
  }
  const userName =
    review.userId?.FullName || review.userId?.UserName || "Khách hàng";
  return {
    rating: Number(review.rating) || 0,
    comment: String(review.comment || "").trim(),
    userName,
    createdAt: review.CreatedAt,
  };
}

/** Đếm sản phẩm đang niêm yết: tổng = còn hàng + hết hàng (loại trừ lẫn nhau). */
async function resolveShopProductInventoryStats(shopId) {
  const rows = await Product.aggregate([
    {
      $match: {
        ShopId: shopId,
        ...notRemovedProductMatch(),
        Status: PRODUCT_STATUS.ACTIVE,
      },
    },
    {
      $lookup: {
        from: ProductVariant.collection.name,
        localField: "_id",
        foreignField: "ProductId",
        as: "variants",
      },
    },
    {
      $addFields: {
        stockTotal: { $sum: "$variants.Quantity" },
      },
    },
    {
      $group: {
        _id: null,
        totalListed: { $sum: 1 },
        inStockProducts: {
          $sum: { $cond: [{ $gt: ["$stockTotal", 0] }, 1, 0] },
        },
        outOfStockProducts: {
          $sum: { $cond: [{ $lte: ["$stockTotal", 0] }, 1, 0] },
        },
      },
    },
  ]);

  const row = rows[0] || {};
  const inStockProducts = Number(row.inStockProducts) || 0;
  const outOfStockProducts = Number(row.outOfStockProducts) || 0;
  const totalListedProducts = Number(row.totalListed) || inStockProducts + outOfStockProducts;

  return {
    totalListedProducts,
    inStockProducts,
    outOfStockProducts,
  };
}

/** Đánh giá công khai — breakdown + tổng + điểm TB (không dùng cache shop). */
async function resolveShopReviewStats(shopId) {
  const ratingAgg = await Review.aggregate([
    {
      $match: {
        shopId,
        $and: publicReviewFilter().$and,
      },
    },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let tongDG = 0;
  let ratingSum = 0;
  for (const row of ratingAgg) {
    const star = Number(row._id);
    const count = Number(row.count) || 0;
    if (star >= 1 && star <= 5) {
      ratingBreakdown[star] = count;
      tongDG += count;
      ratingSum += star * count;
    }
  }
  const diemTB = tongDG > 0 ? Math.round((ratingSum / tongDG) * 10) / 10 : 0;
  return { ratingBreakdown, tongDG, diemTB };
}

async function countPeriodBuyerChats(_sellerUserId, _from, _to) {
  return 0;
}

function matchShopReservationsCreatedInRange(shopId, from, to, extraMatch = {}) {
  return {
    shopId,
    $and: [reservationCreatedInRange(from, to), extraMatch],
  };
}

async function getSellerStats(user, query = {}) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);
  const sellerUserId = shop.userId || user._id;
  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const { range, from, to } = resolveStatsDateRange(query);
  const { prevFrom, prevTo } = getPreviousPeriodRange(from, to);

  const completedReservations = await Reservation.find({
    shopId: shop._id,
    status: {
      $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED],
    },
  });

  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let totalRevenue = 0;
  let periodRevenue = 0;
  let periodSoldCount = 0;
  let periodCompletedOrders = 0;

  for (const reservation of completedReservations) {
    const amount = computeTotal(reservation);
    const qty = Number(reservation.quantity) || 0;
    totalRevenue += amount;
    const pickupAt = getPickupConfirmedAt(reservation) || getReservationUpdatedAt(reservation);
    if (pickupAt && pickupAt >= dayStart) {
      dailyRevenue += amount;
    }
    if (pickupAt && pickupAt >= monthStart) {
      monthlyRevenue += amount;
    }
    if (pickupAt && pickupAt >= from && pickupAt <= to) {
      periodRevenue += amount;
      periodSoldCount += qty;
      periodCompletedOrders += 1;
    }
  }

  const periodMatch = (extraMatch = {}) =>
    matchShopReservationsCreatedInRange(shop._id, from, to, extraMatch);

  const [
    pendingCount,
    confirmedCount,
    cancelledCount,
    completedCount,
    periodPending,
    periodConfirmed,
    periodHolding,
    periodWaitingPickup,
    periodCancelled,
    periodCompleted,
    periodDisputed,
    periodPickupConfirmed,
    productLikeAgg,
    productViewsAgg,
    productInventoryStats,
    periodNewFollowers,
    previousNewFollowers,
    previousPeriodCompleted,
    previousPeriodRevenue,
    previousNewProducts,
    periodNewProducts,
    periodUniqueBuyerIds,
    shopReviewStats,
    topSellingProducts,
    topBuyers,
    latestReview,
    periodChatCount,
  ] = await Promise.all([
    Reservation.countDocuments({
      shopId: shop._id,
      status: RESERVATION_STATUS.PENDING,
    }),
    Reservation.countDocuments({
      shopId: shop._id,
      status: RESERVATION_STATUS.WAITING_PICKUP,
    }),
    Reservation.countDocuments({
      shopId: shop._id,
      status: { $in: CANCELLED_RESERVATION_STATUSES },
    }),
    Reservation.countDocuments({
      shopId: shop._id,
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
    }),
    Reservation.countDocuments(periodMatch({ status: RESERVATION_STATUS.PENDING })),
    Reservation.countDocuments(periodMatch({ status: RESERVATION_STATUS.WAITING_PICKUP })),
    Reservation.countDocuments(
      periodMatch({
        status: RESERVATION_STATUS.WAITING_PICKUP,
        pickupTime: { $gt: now },
      })
    ),
    Reservation.countDocuments(
      periodMatch({
        status: RESERVATION_STATUS.WAITING_PICKUP,
        $or: [{ pickupTime: { $lte: now } }, { pickupTime: null }],
      })
    ),
    Reservation.countDocuments(
      periodMatch({ status: { $in: CANCELLED_RESERVATION_STATUSES } })
    ),
    Reservation.countDocuments(
      periodMatch({
        status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
      })
    ),
    Reservation.countDocuments(periodMatch({ status: RESERVATION_STATUS.DISPUTED })),
    Reservation.countDocuments(periodMatch({ status: RESERVATION_STATUS.PICKUP_CONFIRMED })),
    Product.aggregate([
      {
        $match: {
          ShopId: shop._id,
          ...notRemovedProductMatch(),
          Status: PRODUCT_STATUS.ACTIVE,
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$LikeCount", 0] } } } },
    ]),
    Product.aggregate([
      {
        $match: {
          ShopId: shop._id,
          ...notRemovedProductMatch(),
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$ViewCount", 0] } } } },
    ]),
    resolveShopProductInventoryStats(shop._id),
    Follow.countDocuments({
      shopId: shop._id,
      CreatedAt: { $gte: from, $lte: to },
    }),
    Follow.countDocuments({
      shopId: shop._id,
      CreatedAt: { $gte: prevFrom, $lte: prevTo },
    }),
    countPeriodCompletedOrders(shop._id, prevFrom, prevTo),
    sumPeriodRevenue(completedReservations, prevFrom, prevTo),
    Product.countDocuments({
      ShopId: shop._id,
      ...notRemovedProductMatch(),
      CreatedAt: { $gte: prevFrom, $lte: prevTo },
    }),
    Product.countDocuments({
      ShopId: shop._id,
      ...notRemovedProductMatch(),
      CreatedAt: { $gte: from, $lte: to },
    }),
    Reservation.distinct("userId", {
      shopId: shop._id,
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
      ...reservationPickupConfirmedRangeFilter(from, to),
    }),
    resolveShopReviewStats(shop._id),
    resolveTopSellingProducts(shop._id, from, to),
    resolveTopBuyers(shop._id, from, to),
    resolveLatestReview(shop._id),
    countPeriodBuyerChats(sellerUserId, from, to),
  ]);

  const periodDecisionTotal = periodCompleted + periodCancelled;
  const completionRate =
    periodDecisionTotal > 0 ? Math.round((periodCompleted / periodDecisionTotal) * 100) : 0;

  const { ratingBreakdown, tongDG, diemTB } = shopReviewStats || {
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    tongDG: 0,
    diemTB: 0,
  };

  const totalListedProducts = Number(productInventoryStats?.totalListedProducts) || 0;
  const inStockProducts = Number(productInventoryStats?.inStockProducts) || 0;
  const outOfStockProducts = Number(productInventoryStats?.outOfStockProducts) || 0;

  const soNguoiTheo = Number(shop.soNguoiTheo) || 0;
  const productViews = Number(productViewsAgg?.[0]?.total) || 0;
  const averageOrderValue =
    periodCompletedOrders > 0 ? Math.round(periodRevenue / periodCompletedOrders) : 0;

  const overviewTrends = {
    periodRevenue: computePercentChange(periodRevenue, previousPeriodRevenue),
    periodCompleted: computePercentChange(periodCompletedOrders, previousPeriodCompleted),
    tongSP: computePercentChange(periodNewProducts, previousNewProducts),
    followers: computePercentChange(periodNewFollowers, previousNewFollowers),
  };

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    periodRevenue,
    periodSoldCount,
    periodCompletedOrders,
    averageOrderValue,
    dailyRevenue,
    monthlyRevenue,
    totalRevenue,
    revenueTrend: buildRevenueTrend(completedReservations, { from, to }),
    overviewTrends,
    reservations: {
      pending: pendingCount,
      confirmed: confirmedCount,
      cancelled: cancelledCount,
      completed: completedCount,
      total: pendingCount + confirmedCount + cancelledCount + completedCount,
    },
    periodReservations: {
      pending: periodPending,
      confirmed: periodConfirmed,
      holding: periodHolding,
      waitingPickup: periodWaitingPickup,
      pickupConfirmed: periodPickupConfirmed,
      cancelled: periodCancelled,
      completed: periodCompleted,
      disputed: periodDisputed,
      completionRate,
      total:
        periodPending +
        periodConfirmed +
        periodPickupConfirmed +
        periodCancelled +
        periodCompleted +
        periodDisputed,
    },
    soNguoiTheo,
    periodNewFollowers,
    periodUniqueBuyers: Array.isArray(periodUniqueBuyerIds) ? periodUniqueBuyerIds.length : 0,
    periodChatCount,
    shopViews: productViews,
    followingCount: freshUser?.SoTheoDoi || 0,
    productLikes: Number(productLikeAgg?.[0]?.total) || 0,
    productViews,
    tongSP: totalListedProducts,
    activeProducts: inStockProducts,
    outOfStockProducts,
    soldCount: shop.soldCount || 0,
    diemTB,
    tongDG,
    ratingBreakdown,
    topSellingProducts,
    topBuyers,
    latestReview,
  };
}

module.exports = {
  getSellerStats,
  resolveStatsDateRange,
};
