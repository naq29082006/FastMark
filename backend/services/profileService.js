const ShopProfile = require("../models/ShopProfile");
const { getWalletBalance } = require("./walletService");

async function getShopStatsForUser(userId) {
  const shop = await ShopProfile.findOne({ userId })
    .populate("categoryId", "categoryName")
    .sort({ CreatedAt: -1 });

  if (!shop) {
    return {
      categoryId: '',
      categoryName: '',
      totalProducts: 0,
      likesCount: 0,
      soldCount: 0,
      totalReviews: 0,
      averageRating: 0,
      responseRate: 0,
      shopPhone: '',
      shopAddress: '',
      shopSystemAddress: '',
      shopDescription: '',
      shopAvatar: '',
      openTime: '',
      closeTime: '',
      isOpen: 1,
      legacyShopFollowersCount: 0,
    };
  }

  return {
    categoryId: shop.categoryId?._id
      ? String(shop.categoryId._id)
      : shop.categoryId
        ? String(shop.categoryId)
        : '',
    categoryName: shop.categoryId?.categoryName || '',
    totalProducts: shop.totalProducts || 0,
    likesCount: 0,
    soldCount: shop.soldCount || 0,
    totalReviews: shop.totalReviews || 0,
    averageRating: shop.averageRating || 0,
    responseRate: shop.responseRate || 98,
    shopPhone: shop.phone || '',
    shopAddress: shop.address || '',
    shopSystemAddress: shop.DiaChiHeThong || '',
    shopDescription: shop.description || '',
    shopAvatar: shop.avatar || '',
    openTime: shop.openTime || '',
    closeTime: shop.closeTime || '',
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
    legacyShopFollowersCount: Number(shop.followersCount) || 0,
  };
}

async function buildPublicUserProfile(user) {
  const [shopStats, wallet] = await Promise.all([
    getShopStatsForUser(user._id),
    getWalletBalance(user._id).catch(() => ({ balance: 0 })),
  ]);

  const publicUser = user.toPublicJSON();
  const { legacyShopFollowersCount, ...storefrontStats } = shopStats;
  const followersCount =
    Number(publicUser.followersCount) || Number(legacyShopFollowersCount) || 0;

  // Backfill User.FollowersCount once from legacy shop counter.
  if (
    Number(publicUser.followersCount) === 0 &&
    Number(legacyShopFollowersCount) > 0 &&
    user?.FollowersCount !== legacyShopFollowersCount
  ) {
    user.FollowersCount = legacyShopFollowersCount;
    await user.save().catch(() => null);
  }

  return {
    ...publicUser,
    ...storefrontStats,
    shopName: publicUser.fullName || '',
    shopUsername: publicUser.userName || '',
    followersCount,
    followingCount: Number(publicUser.followingCount) || 0,
    walletBalance: Math.max(0, Number(wallet.balance) || 0),
  };
}

module.exports = {
  buildPublicUserProfile,
};
