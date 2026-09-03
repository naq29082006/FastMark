const { expireDueSubscriptions } = require("../services/sellerPlanAccessService");
const {
  expireDueAttpLicenses,
  syncPendingReReviewShopVisibility,
  syncReReviewRejectedShopVisibility,
} = require("../services/attpLicenseService");

const INTERVAL_MS = 10 * 60 * 1000;
let timer = null;

async function runOnce() {
  try {
    const [subscriptionResult, attpResult, pendingReReviewResult, rejectedReReviewResult] =
      await Promise.all([
      expireDueSubscriptions({ limit: 300 }),
      expireDueAttpLicenses({ limit: 300 }),
      syncPendingReReviewShopVisibility({ limit: 300 }),
      syncReReviewRejectedShopVisibility({ limit: 300 }),
    ]);
    if (subscriptionResult.expiredSubscriptions > 0 || subscriptionResult.shopsTouched > 0) {
      console.log(
        `[sellerPlanExpiry] expired=${subscriptionResult.expiredSubscriptions} shops=${subscriptionResult.shopsTouched}`
      );
    }
    if (attpResult.expiredShops > 0) {
      console.log(`[attpLicenseExpiry] hiddenShops=${attpResult.expiredShops}`);
    }
    if (pendingReReviewResult.hiddenShops > 0) {
      console.log(`[attpReReview] hiddenShops=${pendingReReviewResult.hiddenShops}`);
    }
    if (rejectedReReviewResult.hiddenShops > 0) {
      console.log(`[attpReReviewReject] hiddenShops=${rejectedReReviewResult.hiddenShops}`);
    }
  } catch (error) {
    console.warn("[sellerPlanExpiry] failed:", error.message);
  }
}

function startSellerPlanExpiryJob() {
  if (timer) {
    return;
  }
  runOnce();
  timer = setInterval(runOnce, INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

module.exports = { startSellerPlanExpiryJob, runOnce };
