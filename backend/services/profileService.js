const ShopProfile = require("../models/ShopProfile");
const { getWalletBalance } = require("./walletService");
const { resolveShopDisplayName, resolveShopUsername, resolveShopAvatar } = require("../utils/shopIdentity");

async function getShopStatsForUser(userId, userDoc = null) {
  const shop = await ShopProfile.findOne({ userId })
    .populate("categoryId", "categoryName")
    .sort({ CreatedAt: -1 });

  const owner =
    userDoc ||
    (await User.findById(userId).select("FullName UserName Phone Avatar FollowingCount").lean());

  if (!shop) {
    return {
      shopId: '',
      shopStatus: 1,
      shopName: '',
      shopUsername: '',
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
    shopId: shop._id ? String(shop._id) : '',
    shopStatus: Number(shop.status ?? 1),
    shopName: resolveShopDisplayName(shop, owner),
    shopUsername: resolveShopUsername(shop, owner),
    shopAvatar: resolveShopAvatar(shop, owner),
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
    shopAddress: shop.addressHeThong || shop.address || '',
    shopSystemAddress: shop.addressHeThong || shop.DiaChiHeThong || shop.address || '',
    shopDescription: shop.description || '',
    shopAvatar: '',
    openTime: shop.openTime || '',
    closeTime: shop.closeTime || '',
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
    legacyShopFollowersCount: Number(shop.followersCount) || 0,
  };
}

async function buildPublicUserProfile(user) {
  const [shopStats, wallet] = await Promise.all([
    getShopStatsForUser(user._id, user),
    getWalletBalance(user._id).catch(() => ({ balance: 0 })),
  ]);

  const publicUser = user.toPublicJSON();
  const { legacyShopFollowersCount, ...storefrontStats } = shopStats;
  const followersCount = Number(legacyShopFollowersCount) || 0;

  return {
    ...publicUser,
    ...storefrontStats,
    // Avatar cá nhân và avatar gian hàng tách riêng.
    shopAvatar: storefrontStats.shopAvatar || "",
    shopName: storefrontStats.shopName || '',
    shopUsername: storefrontStats.shopUsername || '',
    followersCount,
    followingCount: Number(publicUser.followingCount) || 0,
    walletBalance: Math.max(0, Number(wallet.balance) || 0),
  };
}

module.exports = {
  buildPublicUserProfile,
};
