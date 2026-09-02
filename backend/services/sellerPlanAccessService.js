const SellerSubscription = require("../models/SellerSubscription");
const SellerBannerPlan = require("../models/SellerBannerPlan");
const SellerPlan = require("../models/SellerPlan");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const {
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_BANNER_STATUS,
  PRODUCT_STATUS,
  SHOP_STATUS,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
  RECORD_STATUS,
  isRecordActive,
} = require("../constants");
const { createNotification } = require("./notificationService");
const { assertShopOwnerCanSell } = require("../utils/sellerVerificationReReview");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function findActiveSubscription(shopId, now = new Date()) {
  if (!shopId) {
    return null;
  }
  return SellerSubscription.findOne({
    shopId,
    status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
    endDate: { $gte: now },
  }).sort({ endDate: -1 });
}

async function findActiveBannerPlan(shopId, now = new Date()) {
  if (!shopId) {
    return null;
  }
  return SellerBannerPlan.findOne({
    shopId,
    status: SELLER_BANNER_STATUS.ACTIVE,
    endDate: { $gte: now },
  }).sort({ endDate: -1 });
}

async function syncShopFromSubscription(shop, subscription = null, session = null) {
  if (!shop) {
    return null;
  }
  const now = new Date();
  const active =
    subscription ||
    (await findActiveSubscription(shop._id, now));

  if (active && active.endDate && new Date(active.endDate) >= now) {
    shop.isActive = RECORD_STATUS.ACTIVE;
  } else {
    shop.isActive = RECORD_STATUS.HIDDEN;
  }
  shop.UpdatedAt = now;

  if (session) {
    await shop.save({ session });
  } else {
    await shop.save();
  }
  return shop;
}

async function deactivateShopProducts(shopId, session = null) {
  const now = new Date();
  const query = Product.updateMany(
    { ShopId: shopId, Status: PRODUCT_STATUS.ACTIVE },
    { $set: { Status: PRODUCT_STATUS.HIDDEN, UpdatedAt: now } }
  );
  if (session) {
    await query.session(session);
  } else {
    await query;
  }
}

/** Hết hạn banner chỉ dựa endDate — không đổi status (status vẫn ACTIVE cho đến khi hủy/từ chối). */
async function expireShopBanners(_shopId, _session = null) {
  return;
}

async function expireDueSubscriptions({ limit = 200 } = {}) {
  const now = new Date();
  const due = await SellerSubscription.find({
    status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
    endDate: { $lt: now },
  })
    .limit(limit)
    .lean();

  let expiredCount = 0;
  const shopIds = new Set();
  const notifiedSellerIds = new Set();

  for (const row of due) {
    await SellerSubscription.updateOne(
      { _id: row._id },
      { $set: { status: SELLER_SUBSCRIPTION_STATUS.EXPIRED, UpdatedAt: now } }
    );
    expiredCount += 1;
    if (row.shopId) {
      shopIds.add(String(row.shopId));
    }

    const payload = {
      subscriptionId: String(row._id),
      shopId: row.shopId ? String(row.shopId) : "",
      status: SELLER_SUBSCRIPTION_STATUS.EXPIRED,
      action: "expired",
    };
    emitAdminUpdated("subscription", payload);

    const sellerUserId = row.sellerId;
    if (sellerUserId) {
      const sellerKey = String(sellerUserId);
      emitUserResourceUpdated(sellerUserId, "subscription", payload);
      if (!notifiedSellerIds.has(sellerKey)) {
        notifiedSellerIds.add(sellerKey);
        await createNotification(sellerUserId, {
          title: "Gói Seller đã hết hạn",
          content:
            "Gói đăng ký gian hàng của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục bán hàng.",
          audience: NOTIFICATION_AUDIENCE.SELLER,
          index: NOTIFICATION_INDEX.SYSTEM,
        }).catch((error) => {
          console.warn("[sellerPlanExpiry] notify failed:", error?.message || error);
        });
      }
    }
  }

  for (const shopId of shopIds) {
    const shop = await ShopProfile.findById(shopId);
    if (!shop) {
      continue;
    }
    const stillActive = await findActiveSubscription(shop._id, now);
    if (!stillActive) {
      shop.isActive = RECORD_STATUS.HIDDEN;
      shop.UpdatedAt = now;
      await shop.save();
      await deactivateShopProducts(shop._id);
      if (shop.userId) {
        emitUserResourceUpdated(shop.userId, "subscription", {
          shopId: String(shop._id),
          status: SELLER_SUBSCRIPTION_STATUS.EXPIRED,
          action: "shop_deactivated",
        });
      }
    } else {
      await syncShopFromSubscription(shop, stillActive);
    }
  }

  return { expiredSubscriptions: expiredCount, shopsTouched: shopIds.size };
}

async function ensureSubscriptionFresh(shop) {
  if (!shop) {
    return null;
  }
  const now = new Date();
  const active = await findActiveSubscription(shop._id, now);
  if (!active) {
    const stale = await SellerSubscription.findOne({
      shopId: shop._id,
      status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
      endDate: { $lt: now },
    });
    if (stale) {
      stale.status = SELLER_SUBSCRIPTION_STATUS.EXPIRED;
      stale.UpdatedAt = now;
      await stale.save();
      await expireShopBanners(shop._id);
      shop.isActive = RECORD_STATUS.HIDDEN;
      shop.UpdatedAt = now;
      await shop.save();
      await deactivateShopProducts(shop._id);
    } else if (isRecordActive(shop.isActive)) {
      shop.isActive = RECORD_STATUS.HIDDEN;
      shop.UpdatedAt = now;
      await shop.save();
    }
    return null;
  }
  if (!isRecordActive(shop.isActive)) {
    await syncShopFromSubscription(shop, active);
    await unhideShopProducts(shop._id);
  }
  return active;
}

async function assertCanManageProducts(shop) {
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  if (Number(shop.status) === SHOP_STATUS.BLOCKED) {
    throw createServiceError("Gian hàng đang bị khóa.", 403);
  }
  if (shop.userId) {
    await assertShopOwnerCanSell(shop.userId);
  }
  const active = await ensureSubscriptionFresh(shop);
  if (!active) {
    throw createServiceError("Cần mua gói bán hàng còn hiệu lực để đăng / sửa sản phẩm.", 403);
  }
  return active;
}

async function assertCanBuyBanner(shop) {
  // Chỉ cần gói bán còn hiệu lực — không giới hạn số bài / quyền banner theo plan.
  return assertCanManageProducts(shop);
}

async function unhideShopProducts(shopId, session = null) {
  const now = new Date();
  const filter = { ShopId: shopId, Status: PRODUCT_STATUS.HIDDEN };
  let updateQuery = Product.updateMany(filter, {
    $set: { Status: PRODUCT_STATUS.ACTIVE, UpdatedAt: now },
  });
  if (session) {
    updateQuery = updateQuery.session(session);
  }
  await updateQuery;
}

module.exports = {
  findActiveSubscription,
  findActiveBannerPlan,
  syncShopFromSubscription,
  expireDueSubscriptions,
  ensureSubscriptionFresh,
  assertCanManageProducts,
  assertCanBuyBanner,
  deactivateShopProducts,
  unhideShopProducts,
  createServiceError,
};
