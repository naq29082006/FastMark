const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const {
  SELLER_VERIFICATION_STATUS,
  RECORD_STATUS,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
  isRecordActive,
  isSubscriptionActive,
} = require("../constants");
const {
  getApprovedAttpMeta,
  isAttpExpired,
  parseAttpDateString,
} = require("../utils/sellerVerificationReReview");
const { createNotification } = require("./notificationService");
const { emitUserResourceUpdated } = require("./realtimeService");

async function findApprovedVerificationForUser(userId) {
  if (!userId) {
    return null;
  }
  return SellerVerification.findOne({
    userId,
    status: SELLER_VERIFICATION_STATUS.APPROVED,
  })
    .sort({ UpdatedAt: -1 })
    .select("LyDoTuChoi status userId")
    .lean();
}

async function isShopAttpLicenseExpired(shop, now = new Date()) {
  if (!shop?.userId) {
    return false;
  }
  const verification = await findApprovedVerificationForUser(shop.userId);
  const attpMeta = getApprovedAttpMeta(verification);
  if (!attpMeta?.expiresAt) {
    return false;
  }
  return isAttpExpired(attpMeta, now);
}

async function notifyAttpExpired(userId) {
  if (!userId) {
    return;
  }
  await createNotification(userId, {
    title: "Giấy phép ATTP đã hết hạn",
    content:
      "Giấy phép kinh doanh hoặc chứng nhận an toàn thực phẩm đã hết hạn. Gian hàng đã tạm ẩn. Vui lòng cập nhật hồ sơ xác thực trong Cài đặt shop.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.SYSTEM,
  }).catch((error) => {
    console.warn("[attpLicense] notify failed:", error?.message || error);
  });
}

async function hideShopForExpiredAttp(shop, { notify = true } = {}) {
  if (!shop || !isRecordActive(shop.isActive)) {
    return false;
  }
  const { deactivateShopProducts } = require("./sellerPlanAccessService");
  shop.isActive = RECORD_STATUS.HIDDEN;
  shop.UpdatedAt = new Date();
  await shop.save();
  await deactivateShopProducts(shop._id);
  if (notify && shop.userId) {
    await notifyAttpExpired(shop.userId);
    emitUserResourceUpdated(shop.userId, "verification", {
      shopId: String(shop._id),
      action: "attp_expired",
    });
  }
  return true;
}

async function notifyPendingReReview(userId) {
  if (!userId) {
    return;
  }
  await createNotification(userId, {
    title: "Giấy phép đang chờ duyệt",
    content:
      "Hồ sơ thay đổi giấy phép ATTP đang được admin xem xét. Gian hàng tạm ẩn trên bản đồ và sản phẩm cho đến khi được phê duyệt.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.SYSTEM,
  }).catch((error) => {
    console.warn("[attpLicense] pending re-review notify failed:", error?.message || error);
  });
}

async function hideShopForPendingReReview(shop, { notify = true } = {}) {
  if (!shop || !isRecordActive(shop.isActive)) {
    return false;
  }
  const { deactivateShopProducts } = require("./sellerPlanAccessService");
  shop.isActive = RECORD_STATUS.HIDDEN;
  shop.UpdatedAt = new Date();
  await shop.save();
  await deactivateShopProducts(shop._id);
  if (notify && shop.userId) {
    await notifyPendingReReview(shop.userId);
    emitUserResourceUpdated(shop.userId, "verification", {
      shopId: String(shop._id),
      action: "re_review_pending",
    });
  }
  return true;
}

async function ensurePendingReReviewFresh(shop, { notify = false } = {}) {
  if (!shop?.userId) {
    return null;
  }
  const { isShopOwnerPendingReReview } = require("../utils/sellerVerificationReReview");
  const pending = await isShopOwnerPendingReReview(shop.userId);
  if (!pending) {
    return null;
  }
  await hideShopForPendingReReview(shop, { notify });
  return { pendingReReview: true };
}

async function shopHasAttpVisibilityBlock(shop) {
  if (!shop?.userId) {
    return false;
  }
  const { isShopOwnerPendingReReview, shopRequiresAttpReApproval } = require("../utils/sellerVerificationReReview");
  if (await isShopOwnerPendingReReview(shop.userId)) {
    return true;
  }
  if (await shopRequiresAttpReApproval(shop.userId)) {
    return true;
  }
  if (await isShopAttpLicenseExpired(shop)) {
    return true;
  }
  return false;
}

async function notifyReReviewRejected(userId, reason) {
  if (!userId) {
    return;
  }
  const detail = String(reason || "").trim();
  await createNotification(userId, {
    title: "Giấy phép ATTP chưa được duyệt",
    content: detail
      ? `Admin đã từ chối giấy phép mới: ${detail}. Gian hàng tạm ẩn — vui lòng gửi lại hồ sơ xác thực.`
      : "Admin đã từ chối giấy phép mới. Gian hàng tạm ẩn — vui lòng gửi lại hồ sơ xác thực.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.SYSTEM,
  }).catch((error) => {
    console.warn("[attpLicense] re-review reject notify failed:", error?.message || error);
  });
}

async function finalizeShopAfterReReviewRejected(shop, { reason, notify = true } = {}) {
  if (!shop) {
    return null;
  }
  const { deactivateShopProducts } = require("./sellerPlanAccessService");
  if (isRecordActive(shop.isActive)) {
    shop.isActive = RECORD_STATUS.HIDDEN;
  }
  shop.UpdatedAt = new Date();
  await shop.save();
  await deactivateShopProducts(shop._id);
  if (notify && shop.userId) {
    await notifyReReviewRejected(shop.userId, reason);
    emitUserResourceUpdated(shop.userId, "verification", {
      shopId: String(shop._id),
      action: "re_review_rejected",
    });
  }
  return true;
}

async function ensureAttpLicenseFresh(shop, { notify = false } = {}) {
  if (!shop?.userId) {
    return null;
  }
  const expired = await isShopAttpLicenseExpired(shop);
  if (!expired) {
    return null;
  }
  await hideShopForExpiredAttp(shop, { notify });
  return { expired: true };
}

async function restoreShopAfterAttpRenewal(shop) {
  if (!shop) {
    return null;
  }
  const { ensureSubscriptionFresh, unhideShopProducts } = require("./sellerPlanAccessService");
  await ensureSubscriptionFresh(shop);
  if (await shopHasAttpVisibilityBlock(shop)) {
    return null;
  }
  if (!isSubscriptionActive(shop)) {
    return null;
  }
  if (!isRecordActive(shop.isActive)) {
    shop.isActive = RECORD_STATUS.ACTIVE;
    shop.UpdatedAt = new Date();
    await shop.save();
    await unhideShopProducts(shop._id);
    if (shop.userId) {
      emitUserResourceUpdated(shop.userId, "verification", {
        shopId: String(shop._id),
        action: "attp_renewed",
      });
    }
  }
  return shop;
}

async function syncPendingReReviewShopVisibility({ limit = 200 } = {}) {
  const SellerVerification = require("../models/SellerVerification");
  const { SELLER_VERIFICATION_STATUS } = require("../constants");
  const {
    META_TYPE,
    parseVerificationMeta,
  } = require("../utils/sellerVerificationReReview");

  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.PENDING,
  })
    .select("userId LyDoTuChoi")
    .limit(limit)
    .lean();

  let hiddenCount = 0;
  for (const verification of verifications) {
    const meta = parseVerificationMeta(verification.LyDoTuChoi);
    if (meta.type !== META_TYPE.RE_REVIEW_PENDING) {
      continue;
    }
    const shop = await ShopProfile.findOne({ userId: verification.userId });
    if (!shop) {
      continue;
    }
    const hidden = await hideShopForPendingReReview(shop, { notify: false });
    if (hidden) {
      hiddenCount += 1;
    }
  }
  return { hiddenShops: hiddenCount };
}

async function syncReReviewRejectedShopVisibility({ limit = 200 } = {}) {
  const SellerVerification = require("../models/SellerVerification");
  const { SELLER_VERIFICATION_STATUS } = require("../constants");
  const { META_TYPE, parseVerificationMeta, attpMetaRequiresResubmit } = require("../utils/sellerVerificationReReview");

  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.APPROVED,
    LyDoTuChoi: /lastReReviewRejection/,
  })
    .select("userId LyDoTuChoi")
    .limit(limit)
    .lean();

  let hiddenCount = 0;
  for (const verification of verifications) {
    const meta = parseVerificationMeta(verification.LyDoTuChoi);
    if (meta.type !== META_TYPE.ATTP || !attpMetaRequiresResubmit(meta.attpMeta)) {
      continue;
    }
    const shop = await ShopProfile.findOne({ userId: verification.userId });
    if (!shop) {
      continue;
    }
    const hidden = await finalizeShopAfterReReviewRejected(shop, { notify: false });
    if (hidden) {
      hiddenCount += 1;
    }
  }
  return { hiddenShops: hiddenCount };
}

async function expireDueAttpLicenses({ limit = 200 } = {}) {
  const now = new Date();
  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.APPROVED,
    LyDoTuChoi: /"expiresAt"\s*:\s*"[^"]+"/,
  })
    .select("LyDoTuChoi userId")
    .limit(limit)
    .lean();

  let expiredCount = 0;
  const notifiedUserIds = new Set();

  for (const verification of verifications) {
    const attpMeta = getApprovedAttpMeta(verification);
    if (!attpMeta || !isAttpExpired(attpMeta, now)) {
      continue;
    }
    const shop = await ShopProfile.findOne({ userId: verification.userId });
    if (!shop) {
      continue;
    }
    const hidden = await hideShopForExpiredAttp(shop, {
      notify: !notifiedUserIds.has(String(shop.userId)),
    });
    if (hidden) {
      expiredCount += 1;
      if (shop.userId) {
        notifiedUserIds.add(String(shop.userId));
      }
    }
  }

  return { expiredShops: expiredCount };
}

module.exports = {
  parseAttpDateString,
  findApprovedVerificationForUser,
  isShopAttpLicenseExpired,
  ensureAttpLicenseFresh,
  ensurePendingReReviewFresh,
  hideShopForPendingReReview,
  syncPendingReReviewShopVisibility,
  syncReReviewRejectedShopVisibility,
  shopHasAttpVisibilityBlock,
  finalizeShopAfterReReviewRejected,
  restoreShopAfterAttpRenewal,
  expireDueAttpLicenses,
  notifyAttpExpired,
};
