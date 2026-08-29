const ShopProfile = require("../models/ShopProfile");
const { emitUserEvent } = require("../socket");
const { emitAdminUpdated } = require("./realtimeService");

const shopOwnerCache = new Map();

async function resolveShopOwnerId(shopId) {
  if (!shopId) {
    return null;
  }

  const key = String(shopId);
  if (shopOwnerCache.has(key)) {
    return shopOwnerCache.get(key);
  }

  const shop = await ShopProfile.findById(shopId).select("userId").lean();
  const ownerId = shop?.userId ? String(shop.userId) : null;
  shopOwnerCache.set(key, ownerId);
  return ownerId;
}

function buildOrderUpdatedPayload(reservation, extra = {}) {
  return {
    reservationId: String(reservation._id || reservation.id),
    status: Number(reservation.status),
    userId: reservation.userId ? String(reservation.userId) : "",
    shopId: reservation.shopId ? String(reservation.shopId) : "",
    updatedAt: reservation.updatedAt || reservation.UpdatedAt || new Date(),
    ...extra,
  };
}

async function emitOrderUpdated(reservation, extra = {}) {
  if (!reservation?._id && !reservation?.id) {
    return;
  }

  const payload = buildOrderUpdatedPayload(reservation, extra);

  if (payload.userId) {
    emitUserEvent(payload.userId, "order_updated", payload);
  }

  const sellerUserId = await resolveShopOwnerId(reservation.shopId);
  if (sellerUserId && sellerUserId !== payload.userId) {
    emitUserEvent(sellerUserId, "order_updated", payload);
  }

  emitAdminUpdated("order", payload);
}

module.exports = {
  emitOrderUpdated,
};
