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

const CANCELLED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.REFUNDED,
  RESERVATION_STATUS.CANCELLED,
];

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
      const completedAt = reservation.completedAt || reservation.UpdatedAt;
      if (completedAt && completedAt >= day && completedAt <= dayEnd) {
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
    const completedAt = reservation.completedAt || reservation.UpdatedAt;
    if (completedAt && completedAt >= from && completedAt <= to) {
      total += computeTotal(reservation);
    }
  }
  return total;
}

async function countPeriodCompletedOrders(shopId, from, to) {
  return Reservation.countDocuments({
    shopId,
    status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED] },
    completedAt: { $gte: from, $lte: to },
  });
}

async function resolveTopSellingProducts(shopId, from, to, limit = 3) {
  const rows = await Reservation.aggregate([
    {
      $match: {
        shopId,
        productId: { $ne: null },
        status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED] },
        completedAt: { $gte: from, $lte: to },
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
        status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED] },
        completedAt: { $gte: from, $lte: to },
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
    ...publicReviewFilter(),
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

async function countPeriodBuyerChats(_sellerUserId, _from, _to) {
  return 0;
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
    const completedAt = reservation.completedAt || reservation.UpdatedAt;
    if (completedAt && completedAt >= dayStart) {
      dailyRevenue += amount;
    }
    if (completedAt && completedAt >= monthStart) {
      monthlyRevenue += amount;
    }
    if (completedAt && completedAt >= from && completedAt <= to) {
      periodRevenue += amount;
      periodSoldCount += qty;
      periodCompletedOrders += 1;
    }
  }

  const createdInRange = {
    shopId: shop._id,
    CreatedAt: { $gte: from, $lte: to },
  };

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
    productLikeAgg,
    productViewsAgg,
    activeProducts,
    outOfStockAgg,
    periodNewFollowers,
    previousNewFollowers,
    previousPeriodCompleted,
    previousPeriodRevenue,
    previousNewProducts,
    periodNewProducts,
    periodUniqueBuyerIds,
    ratingAgg,
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
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED] },
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.PENDING,
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.WAITING_PICKUP,
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.WAITING_PICKUP,
      pickupTime: { $gt: now },
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.WAITING_PICKUP,
      $or: [{ pickupTime: { $lte: now } }, { pickupTime: null }],
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: { $in: CANCELLED_RESERVATION_STATUSES },
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED] },
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.DISPUTED,
    }),
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
    Product.countDocuments({
      ShopId: shop._id,
      ...notRemovedProductMatch(),
      Status: PRODUCT_STATUS.ACTIVE,
    }),
    Product.aggregate([
      {
        $match: {
          ShopId: shop._id,
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
      { $match: { stockTotal: { $lte: 0 } } },
      { $count: "total" },
    ]),
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
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETED] },
      completedAt: { $gte: from, $lte: to },
    }),
    Review.aggregate([
      {
        $match: {
          $and: [{ shopId: shop._id }, publicReviewFilter()],
        },
      },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
    resolveTopSellingProducts(shop._id, from, to),
    resolveTopBuyers(shop._id, from, to),
    resolveLatestReview(shop._id),
    countPeriodBuyerChats(sellerUserId, from, to),
  ]);

  const periodDecisionTotal = periodCompleted + periodCancelled;
  const completionRate =
    periodDecisionTotal > 0 ? Math.round((periodCompleted / periodDecisionTotal) * 100) : 0;

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of ratingAgg) {
    const star = Number(row._id);
    if (star >= 1 && star <= 5) {
      ratingBreakdown[star] = Number(row.count) || 0;
    }
  }

  const followersCount = Number(shop.followersCount) || 0;
  const productViews = Number(productViewsAgg?.[0]?.total) || 0;
  const averageOrderValue =
    periodCompletedOrders > 0 ? Math.round(periodRevenue / periodCompletedOrders) : 0;

  const overviewTrends = {
    periodRevenue: computePercentChange(periodRevenue, previousPeriodRevenue),
    periodCompleted: computePercentChange(periodCompleted, previousPeriodCompleted),
    totalProducts: computePercentChange(periodNewProducts, previousNewProducts),
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
      cancelled: periodCancelled,
      completed: periodCompleted,
      disputed: periodDisputed,
      completionRate,
      total:
        periodPending +
        periodConfirmed +
        periodCancelled +
        periodCompleted +
        periodDisputed,
    },
    followersCount,
    periodNewFollowers,
    periodUniqueBuyers: Array.isArray(periodUniqueBuyerIds) ? periodUniqueBuyerIds.length : 0,
    periodChatCount,
    shopViews: productViews,
    followingCount: freshUser?.FollowingCount || 0,
    productLikes: Number(productLikeAgg?.[0]?.total) || 0,
    productViews,
    totalProducts: shop.totalProducts || 0,
    activeProducts,
    outOfStockProducts: Number(outOfStockAgg?.[0]?.total) || 0,
    soldCount: shop.soldCount || 0,
    averageRating: shop.averageRating || 0,
    totalReviews: shop.totalReviews || 0,
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
