const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const User = require("../models/User");
const { RESERVATION_STATUS } = require("../constants/reservationStatus");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { getShopForSeller } = require("./shopSettingsService");
const { computeTotal } = require("./reservationService");

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfMonth(date) {
  const value = new Date(date);
  value.setDate(1);
  value.setHours(0, 0, 0, 0);
  return value;
}

async function getSellerStats(user) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);
  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const completedReservations = await Reservation.find({
    shopId: shop._id,
    status: RESERVATION_STATUS.COMPLETED,
  });

  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let totalRevenue = 0;

  for (const reservation of completedReservations) {
    const amount = computeTotal(reservation);
    totalRevenue += amount;
    const completedAt = reservation.completedAt || reservation.UpdatedAt;
    if (completedAt && completedAt >= dayStart) {
      dailyRevenue += amount;
    }
    if (completedAt && completedAt >= monthStart) {
      monthlyRevenue += amount;
    }
  }

  const [pendingCount, confirmedCount, cancelledCount, completedCount, productLikeAgg] =
    await Promise.all([
      Reservation.countDocuments({ shopId: shop._id, status: RESERVATION_STATUS.PENDING }),
      Reservation.countDocuments({ shopId: shop._id, status: RESERVATION_STATUS.CONFIRMED }),
      Reservation.countDocuments({ shopId: shop._id, status: RESERVATION_STATUS.CANCELLED }),
      Reservation.countDocuments({ shopId: shop._id, status: RESERVATION_STATUS.COMPLETED }),
      Product.aggregate([
        {
          $match: {
            ShopId: shop._id,
            IsDeleted: { $ne: true },
            Status: PRODUCT_STATUS.ACTIVE,
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$LikeCount", 0] } } } },
      ]),
    ]);

  return {
    dailyRevenue,
    monthlyRevenue,
    totalRevenue,
    reservations: {
      pending: pendingCount,
      confirmed: confirmedCount,
      cancelled: cancelledCount,
      completed: completedCount,
      total: pendingCount + confirmedCount + cancelledCount + completedCount,
    },
    followersCount: freshUser?.FollowersCount || 0,
    followingCount: freshUser?.FollowingCount || 0,
    productLikes: Number(productLikeAgg?.[0]?.total) || 0,
    shopLikes: shop.totalLikes || 0,
    totalProducts: shop.totalProducts || 0,
    soldCount: shop.soldCount || 0,
    averageRating: shop.averageRating || 0,
    totalReviews: shop.totalReviews || 0,
  };
}

module.exports = {
  getSellerStats,
};
