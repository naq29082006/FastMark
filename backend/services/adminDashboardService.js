const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const Reservation = require("../models/Reservation");
const FavoriteProduct = require("../models/FavoriteProduct");
const FavoriteShop = require("../models/FavoriteShop");
const UserFollow = require("../models/UserFollow");
const { USER_ROLE } = require("../constants/sellerVerification");
const { USER_STATUS } = require("../constants/userStatus");
const { SHOP_STATUS } = require("../constants/shopStatus");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { RESERVATION_STATUS } = require("../constants/reservationStatus");
const { computeTotal } = require("./reservationService");

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
  const range = String(query.range || query.period || "month").toLowerCase();
  let from = null;
  let to = endOfDay(now);

  if (query.from || query.startDate) {
    from = startOfDay(new Date(query.from || query.startDate));
  }
  if (query.to || query.endDate) {
    to = endOfDay(new Date(query.to || query.endDate));
  }

  if (!from) {
    if (range === "day" || range === "today") {
      from = startOfDay(now);
    } else if (range === "week") {
      from = startOfDay(addDays(now, -6));
    } else if (range === "custom") {
      throw createServiceError("Khoảng thời gian tùy chọn cần from và to.", 400);
    } else {
      // month / default: 30 ngày gần nhất
      from = startOfDay(addDays(now, -29));
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
    range: query.from || query.to ? "custom" : range === "custom" ? "custom" : range,
    from,
    to,
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

async function getAdminDashboard(query = {}) {
  const { range, from, to } = resolveDateRange(query);
  const createdInRange = { CreatedAt: { $gte: from, $lte: to } };
  const emptySeries = buildEmptySeries(from, to);

  const [
    totalUsers,
    totalBuyers,
    totalSellers,
    totalAdmins,
    totalShops,
    totalActiveShops,
    totalProducts,
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
    favoriteShopsInRange,
  ] = await Promise.all([
    User.countDocuments({ Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ Role: USER_ROLE.BUYER }),
    User.countDocuments({ Role: USER_ROLE.SELLER }),
    User.countDocuments({ Role: USER_ROLE.ADMIN }),
    ShopProfile.countDocuments({}),
    ShopProfile.countDocuments({ status: SHOP_STATUS.ACTIVE }),
    Product.countDocuments({ IsDeleted: { $ne: true } }),
    Product.countDocuments({ IsDeleted: { $ne: true }, Status: PRODUCT_STATUS.ACTIVE }),
    Reservation.countDocuments({}),
    Reservation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    aggregateDailyCount(User, {
      ...createdInRange,
      Role: { $ne: USER_ROLE.ADMIN },
    }),
    aggregateDailyCount(User, {
      ...createdInRange,
      Role: USER_ROLE.SELLER,
    }),
    aggregateDailyCount(ShopProfile, createdInRange),
    aggregateDailyCount(Product, {
      ...createdInRange,
      IsDeleted: { $ne: true },
    }),
    aggregateDailyCount(Reservation, createdInRange),
    Reservation.find({
      status: RESERVATION_STATUS.COMPLETED,
      $or: [
        { completedAt: { $gte: from, $lte: to } },
        { completedAt: null, UpdatedAt: { $gte: from, $lte: to } },
      ],
    })
      .select("shopId agreedPrice reservedPrice quantity completedAt UpdatedAt")
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
      .sort({ averageRating: -1, totalLikes: -1, soldCount: -1, totalProducts: -1 })
      .limit(10)
      .select(
        "shopName avatar averageRating totalLikes totalProducts soldCount totalReviews DiaChiHeThong address isOpen userId"
      )
      .lean(),
    aggregateDailyCount(UserFollow, createdInRange),
    aggregateDailyCount(FavoriteProduct, createdInRange),
    aggregateDailyCount(FavoriteShop, createdInRange),
  ]);

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
        .select("shopName avatar")
        .lean()
    : [];
  const revenueShopById = new Map(revenueShops.map((shop) => [String(shop._id), shop]));

  const revenueByShop = [...revenueByShopMap.values()]
    .map((row) => ({
      shopId: row.shopId,
      shopName: revenueShopById.get(row.shopId)?.shopName || "Gian hàng",
      avatar: revenueShopById.get(row.shopId)?.avatar || "",
      revenue: row.revenue,
      orders: row.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const statusLabel = {
    [RESERVATION_STATUS.PENDING]: "Chờ xác nhận",
    [RESERVATION_STATUS.CONFIRMED]: "Đã xác nhận",
    [RESERVATION_STATUS.COMPLETED]: "Hoàn thành",
    [RESERVATION_STATUS.CANCELLED]: "Đã hủy",
  };

  const reservationStatusPie = [0, 1, 2, 3].map((status) => {
    const found = reservationsByStatus.find((row) => Number(row._id) === status);
    return {
      status,
      label: statusLabel[status] || `Trạng thái ${status}`,
      value: Number(found?.count) || 0,
    };
  });

  const rolePie = [
    { key: "buyers", label: "Người mua", value: totalBuyers },
    { key: "sellers", label: "Người bán", value: totalSellers },
    { key: "admins", label: "Admin", value: totalAdmins },
  ];

  const topShopsMapped = topShops.map((shop) => ({
    shopId: String(shop._id),
    name: shop.shopName || "Gian hàng",
    logo: shop.avatar || "",
    rating: Number(shop.averageRating) || 0,
    totalLikes: Number(shop.totalLikes) || 0,
    totalProducts: Number(shop.totalProducts) || 0,
    soldCount: Number(shop.soldCount) || 0,
    totalReviews: Number(shop.totalReviews) || 0,
    address: shop.DiaChiHeThong || shop.address || "",
    isOpen: Number(shop.isOpen) === 1,
  }));

  const [activeUsers, blockedUsers] = await Promise.all([
    User.countDocuments({ Status: USER_STATUS.ACTIVE, Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ Status: USER_STATUS.BLOCKED }),
  ]);

  return {
    range,
    from,
    to,
    cards: {
      totalUsers,
      totalBuyers,
      totalSellers,
      totalShops,
      totalActiveShops,
      totalProducts,
      totalActiveProducts,
      totalReservations,
      periodRevenue,
      activeUsers,
      blockedUsers,
    },
    charts: {
      usersOverTime: fillSeries(emptySeries, usersInRange),
      sellersOverTime: fillSeries(emptySeries, sellersInRange),
      shopsOverTime: fillSeries(emptySeries, shopsInRange),
      productsOverTime: fillSeries(emptySeries, productsInRange),
      reservationsOverTime: fillSeries(emptySeries, reservationsInRange),
      followsOverTime: fillSeries(emptySeries, followInRange),
      favoriteProductsOverTime: fillSeries(emptySeries, favoriteProductsInRange),
      favoriteShopsOverTime: fillSeries(emptySeries, favoriteShopsInRange),
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
    },
  };
}

module.exports = {
  getAdminDashboard,
};
