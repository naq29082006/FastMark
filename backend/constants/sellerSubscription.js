const SELLER_SUBSCRIPTION_PLANS = [
  {
    planMonths: 1,
    price: 500000,
    label: "1 tháng",
    description: "Hiển thị gian hàng và bài viết trong 1 tháng",
  },
  {
    planMonths: 3,
    price: 1200000,
    label: "3 tháng",
    description: "Hiển thị gian hàng và bài viết trong 3 tháng",
  },
  {
    planMonths: 6,
    price: 2000000,
    label: "6 tháng",
    description: "Hiển thị gian hàng và bài viết trong 6 tháng",
  },
];

const PLAN_BY_MONTHS = Object.fromEntries(
  SELLER_SUBSCRIPTION_PLANS.map((plan) => [plan.planMonths, plan])
);

function getPlanByMonths(planMonths) {
  return PLAN_BY_MONTHS[Number(planMonths)] || null;
}

function isSubscriptionActive(shop, now = new Date()) {
  if (!shop?.subscriptionExpiresAt) {
    return false;
  }
  const expires = new Date(shop.subscriptionExpiresAt);
  return Number.isFinite(expires.getTime()) && expires.getTime() > now.getTime();
}

/** Mongo filter: shop must have active paid subscription to appear publicly. */
function activeSubscriptionFilter(now = new Date()) {
  return {
    subscriptionExpiresAt: { $gt: now },
  };
}

module.exports = {
  SELLER_SUBSCRIPTION_PLANS,
  getPlanByMonths,
  isSubscriptionActive,
  activeSubscriptionFilter,
};
