const mongoose = require("mongoose");
const ShopProfile = require("../models/ShopProfile");
const {
  SELLER_SUBSCRIPTION_PLANS,
  getPlanByMonths,
  isSubscriptionActive,
} = require("../constants/sellerSubscription");
const { debitWallet } = require("./walletService");
const { getShopForSeller } = require("./shopSettingsService");
const { getWalletBalance } = require("./walletService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toSubscriptionDto(shop, walletBalance = null) {
  const active = isSubscriptionActive(shop);
  const expiresAt = shop.subscriptionExpiresAt || null;
  let daysLeft = 0;
  if (active && expiresAt) {
    daysLeft = Math.max(
      0,
      Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
  }

  return {
    plans: SELLER_SUBSCRIPTION_PLANS,
    subscriptionPlan: shop.subscriptionPlan || null,
    subscriptionExpiresAt: expiresAt,
    subscriptionActive: active,
    daysLeft,
    pinHours: Boolean(shop.pinHours),
    walletBalance: walletBalance == null ? null : Number(walletBalance) || 0,
  };
}

async function getSubscription(user) {
  const shop = await getShopForSeller(user);
  const wallet = await getWalletBalance(user._id);
  return toSubscriptionDto(shop, wallet.balance);
}

async function purchaseSubscription(user, { planMonths } = {}) {
  const plan = getPlanByMonths(planMonths);
  if (!plan) {
    throw createServiceError("Gói không hợp lệ. Chọn 1, 3 hoặc 6 tháng.");
  }

  const shop = await getShopForSeller(user);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await debitWallet(user._id, plan.price, {
      description: `Gói người bán ${plan.label}`,
      session,
    });

    const now = new Date();
    const base =
      shop.subscriptionExpiresAt && new Date(shop.subscriptionExpiresAt) > now
        ? new Date(shop.subscriptionExpiresAt)
        : now;
    const expires = new Date(base);
    expires.setMonth(expires.getMonth() + plan.planMonths);

    shop.subscriptionPlan = plan.planMonths;
    shop.subscriptionExpiresAt = expires;
    shop.UpdatedAt = now;
    await shop.save({ session });

    const Product = require("../models/Product");
    const { PRODUCT_STATUS } = require("../constants/productStatus");
    await Product.updateMany(
      { ShopId: shop._id, Status: PRODUCT_STATUS.HIDDEN },
      { $set: { Status: PRODUCT_STATUS.ACTIVE, UpdatedAt: now } },
      { session }
    );

    await session.commitTransaction();

    const wallet = await getWalletBalance(user._id);
    return toSubscriptionDto(shop, wallet.balance);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  getSubscription,
  purchaseSubscription,
  toSubscriptionDto,
  isSubscriptionActive,
};
