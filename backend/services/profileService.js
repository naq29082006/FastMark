const ShopProfile = require("../models/ShopProfile");

async function getShopStatsForUser(userId) {
  const shop = await ShopProfile.findOne({ userId }).sort({ CreatedAt: -1 });

  if (!shop) {
    return {
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
      openTime: '',
      closeTime: '',
      isOpen: 1,
    };
  }

  return {
    totalProducts: shop.totalProducts || 0,
    likesCount: shop.totalLikes || 0,
    soldCount: shop.soldCount || 0,
    totalReviews: shop.totalReviews || 0,
    averageRating: shop.averageRating || 0,
    responseRate: shop.responseRate || 98,
    shopPhone: shop.phone || '',
    shopAddress: shop.address || '',
    shopSystemAddress: shop.DiaChiHeThong || '',
    shopDescription: shop.description || '',
    openTime: shop.openTime || '',
    closeTime: shop.closeTime || '',
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
  };
}

async function buildPublicUserProfile(user) {
  const shopStats = await getShopStatsForUser(user._id);

  return {
    ...user.toPublicJSON(),
    ...shopStats,
  };
}

module.exports = {
  buildPublicUserProfile,
};
