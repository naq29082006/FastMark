const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ShopProfile = require("../models/ShopProfile");
const { RESERVATION_STATUS } = require("../constants/reservationStatus");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { SHOP_STATUS, SHOP_OPEN } = require("../constants/shopStatus");
const {
  toPublicReservation,
  reserveVariantInventory,
  releaseVariantInventory,
  expireOverdueReservations,
  ensurePickupCode,
} = require("./reservationService");
const { debitWallet, creditWalletRefund } = require("./walletService");
const { createNotification } = require("./notificationService");
const { NOTIFICATION_AUDIENCE } = require("../constants/notificationAudience");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertPhoneVerifiedForTrade(user) {
  const phone = String(user?.Phone || "").trim();
  if (!/^\d{10}$/.test(phone)) {
    throw createServiceError(
      "Vui lòng thêm và xác minh số điện thoại trước khi giữ hàng.",
      403
    );
  }
  if (!user.SellerPhoneVerified) {
    throw createServiceError(
      "Vui lòng xác minh số điện thoại trước khi giữ hàng.",
      403
    );
  }
}

function pickNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function pickString(value) {
  return String(value || "").trim();
}

async function validateProductAndShop(productId, variantId) {
  const product = await Product.findById(productId);
  if (!product || product.Status !== PRODUCT_STATUS.ACTIVE) {
    throw createServiceError("Sản phẩm không khả dụng.", 404);
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant || variant.ProductId?.toString() !== product._id.toString()) {
    throw createServiceError("Biến thể sản phẩm không hợp lệ.", 400);
  }
  if (variant.Status !== undefined && variant.Status !== 1) {
    throw createServiceError("Biến thể sản phẩm không khả dụng.", 400);
  }

  const shop = await ShopProfile.findById(product.ShopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw createServiceError("Cửa hàng không hoạt động.", 400);
  }
  if (shop.isOpen !== SHOP_OPEN.OPEN) {
    throw createServiceError("Cửa hàng đang đóng cửa.", 400);
  }

  return { product, variant, shop };
}

async function notifyShopOwner(shop, { title, content }) {
  if (!shop?.userId) {
    return;
  }
  await createNotification(shop.userId, {
    title,
    content,
    audience: NOTIFICATION_AUDIENCE.SELLER,
  });
}

async function createReservation(user, payload) {
  assertPhoneVerifiedForTrade(user);

  const productId = pickString(payload.productId);
  const variantId = pickString(payload.variantId);
  const quantity = pickNumber(payload.quantity) || 1;
  const note = pickString(payload.note);
  const pickupTimeRaw = payload.pickupTime ?? payload.pickup_time;

  if (!productId || !variantId) {
    throw createServiceError("Thiếu sản phẩm hoặc biến thể.");
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw createServiceError("Số lượng không hợp lệ.");
  }

  let pickupTime = null;
  if (pickupTimeRaw) {
    pickupTime = new Date(pickupTimeRaw);
    if (Number.isNaN(pickupTime.getTime())) {
      throw createServiceError("Thời gian nhận hàng không hợp lệ.");
    }
    if (pickupTime.getTime() <= Date.now()) {
      throw createServiceError("Thời gian nhận hàng phải ở tương lai.");
    }
  } else {
    throw createServiceError("Vui lòng chọn thời gian nhận hàng.");
  }

  const { product, variant, shop } = await validateProductAndShop(productId, variantId);

  if (shop.allowReserve === false) {
    throw createServiceError("Cửa hàng không nhận giữ hàng.", 400);
  }

  if ((variant.Quantity ?? 0) < quantity) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  const agreedPrice = Number(variant.Price) || 0;
  const depositPercent = Math.max(0, Math.min(100, Number(shop.depositPercent) || 0));
  const depositRequired = depositPercent > 0;
  const depositAmount = depositRequired
    ? Math.round((agreedPrice * quantity * depositPercent) / 100)
    : 0;
  const now = new Date();
  const session = await mongoose.startSession();

  try {
    let reservation;
    await session.withTransaction(async () => {
      await reserveVariantInventory(variant._id, quantity, session);

      let depositTxnId = null;
      let depositPaidAt = null;

      if (depositAmount > 0) {
        const { transaction } = await debitWallet(user._id, depositAmount, {
          description: `Cọc giữ hàng ${product.ProductName || ""}`.trim(),
          session,
        });
        depositTxnId = transaction._id;
        depositPaidAt = now;
      }

      reservation = await Reservation.create(
        [
          {
            variantId: variant._id,
            shopId: shop._id,
            productId: product._id,
            userId: user._id,
            quantity,
            reservedPrice: Number(variant.Price) || 0,
            agreedPrice,
            pickupTime,
            note,
            status: RESERVATION_STATUS.PENDING,
            inventoryHeld: true,
            depositRequired,
            depositPercent,
            depositAmount,
            depositPaidAt,
            depositTxnId,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        { session }
      );
      reservation = reservation[0];
    });

    const depositNote =
      depositAmount > 0
        ? ` Đã cọc ${depositAmount.toLocaleString("vi-VN")}đ (${depositPercent}%).`
        : "";

    await notifyShopOwner(shop, {
      title: "Yêu cầu giữ hàng mới",
      content: `${user.FullName || user.UserName} yêu cầu giữ ${quantity} ${product.ProductName} — nhận lúc ${pickupTime.toLocaleString("vi-VN")}.${depositNote}`,
    });

    return toPublicReservation(reservation);
  } finally {
    session.endSession();
  }
}

async function listBuyerReservations(user, { tab = "holding", search } = {}) {
  await expireOverdueReservations();
  let statusFilter = [];

  switch (tab) {
    case "holding":
      statusFilter = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];
      break;
    case "cancelled":
      statusFilter = [RESERVATION_STATUS.CANCELLED];
      break;
    case "completed":
      statusFilter = [RESERVATION_STATUS.COMPLETED];
      break;
    default:
      statusFilter = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];
  }

  const reservations = await Reservation.find({
    userId: user._id,
    status: { $in: statusFilter },
  })
    .sort({ UpdatedAt: -1 })
    .limit(100);

  let mapped = await Promise.all(
    reservations.map(async (doc) => {
      const publicReservation = await toPublicReservation(doc);
      const shop = await ShopProfile.findById(doc.shopId);
      return {
        ...publicReservation,
        shopId: doc.shopId ? String(doc.shopId) : "",
        storeName: shop?.shopName || shop?.description || "",
      };
    })
  );

  const keyword = pickString(search).toLowerCase();
  if (keyword) {
    mapped = mapped.filter(
      (item) =>
        (item.product?.productName || "").toLowerCase().includes(keyword) ||
        (item.variant?.variantName || "").toLowerCase().includes(keyword) ||
        (item.storeName || "").toLowerCase().includes(keyword)
    );
  }

  return mapped;
}

async function listBuyerOrders(user, { tab = "holding", search } = {}) {
  const reservations = await listBuyerReservations(user, { tab, search });
  return { tab, reservations };
}

async function getBuyerReservation(user, reservationId) {
  await expireOverdueReservations();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  await ensurePickupCode(reservation);
  const publicReservation = await toPublicReservation(reservation);
  const shop = await ShopProfile.findById(reservation.shopId);
  return {
    ...publicReservation,
    shopId: reservation.shopId ? String(reservation.shopId) : "",
    storeName: shop?.shopName || shop?.description || "",
  };
}

async function cancelReservationByBuyer(user, reservationId) {
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (reservation.status === RESERVATION_STATUS.COMPLETED) {
    throw createServiceError("Đơn đã hoàn thành, không thể hủy.");
  }
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    throw createServiceError("Đơn đã được hủy.");
  }
  if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
    throw createServiceError(
      "Shop đã xác nhận giữ hàng. Bạn không thể hủy — hãy đến lấy hàng.",
      403
    );
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Không thể hủy đơn ở trạng thái này.");
  }

  if (reservation.cancelLockedAt && new Date() < new Date(reservation.cancelLockedAt)) {
    const waitMinutes = Math.ceil(
      (new Date(reservation.cancelLockedAt).getTime() - Date.now()) / 60000
    );
    throw createServiceError(
      `Không thể hủy trong ${waitMinutes} phút đầu sau khi shop chấp nhận giá.`,
      403
    );
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelReason = "Người mua hủy đơn";
  await releaseVariantInventory(reservation);

  if (reservation.depositPaidAt && Number(reservation.depositAmount) > 0) {
    await creditWalletRefund(user._id, reservation.depositAmount, {
      description: `Hoàn cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
    });
  }

  reservation.UpdatedAt = now;
  await reservation.save();

  const shop = await ShopProfile.findById(reservation.shopId);
  await notifyShopOwner(shop, {
    title: "Khách hủy giữ hàng",
    content: `${user.FullName || user.UserName} đã hủy yêu cầu giữ hàng.`,
  });

  return toPublicReservation(reservation);
}

async function completeReservationByBuyer(user, reservationId) {
  throw createServiceError(
    "Chỉ người bán mới có thể xác nhận khách đã nhận hàng.",
    403
  );
}

module.exports = {
  createReservation,
  listBuyerReservations,
  listBuyerOrders,
  getBuyerReservation,
  cancelReservationByBuyer,
  completeReservationByBuyer,
};
