const Reservation = require("../models/Reservation");
const DealOffer = require("../models/DealOffer");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const {
  RESERVATION_STATUS,
  BUYER_CANCEL_LOCK_MINUTES,
} = require("../constants/reservationStatus");
const { DEAL_OFFER_STATUS } = require("../constants/dealOfferStatus");
const { createNotification } = require("./notificationService");

const NO_SHOW_CANCEL_REASON = "Người dùng không đến lấy hàng";

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function computeTotal(reservation) {
  const price = Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0;
  const quantity = Number(reservation.quantity) || 0;
  return price * quantity;
}

async function toPublicReservation(doc) {
  const [buyer, product, variant, deal, shop] = await Promise.all([
    User.findById(doc.userId),
    Product.findById(doc.productId),
    ProductVariant.findById(doc.variantId),
    doc.dealOfferId ? DealOffer.findById(doc.dealOfferId) : null,
    doc.shopId ? ShopProfile.findById(doc.shopId) : null,
  ]);

  return {
    id: doc._id,
    orderCode: `ID: ${String(doc._id).slice(-8).toUpperCase()}`,
    status: doc.status,
    quantity: doc.quantity || 0,
    reservedPrice: doc.reservedPrice || 0,
    agreedPrice: doc.agreedPrice ?? doc.reservedPrice ?? 0,
    totalAmount: computeTotal(doc),
    pickupTime: doc.pickupTime || null,
    note: doc.note || "",
    confirmedAt: doc.confirmedAt || null,
    completedAt: doc.completedAt || null,
    cancelledAt: doc.cancelledAt || null,
    cancelReason: doc.cancelReason || "",
    buyerPriceAcceptedAt: doc.buyerPriceAcceptedAt || null,
    cancelLockedAt: doc.cancelLockedAt || null,
    buyerCancelLocked: doc.cancelLockedAt ? new Date() >= new Date(doc.cancelLockedAt) : false,
    createdAt: doc.CreatedAt,
    updatedAt: doc.UpdatedAt,
    dealOfferId: doc.dealOfferId || null,
    shopId: doc.shopId ? String(doc.shopId) : "",
    storeName: shop?.shopName || shop?.description || "",
    buyer: buyer
      ? {
          id: buyer._id,
          fullName: buyer.FullName || "",
          phone: buyer.Phone || "",
          userName: buyer.UserName || "",
          avatar: buyer.Avatar || "",
        }
      : null,
    product: product
      ? {
          id: product._id,
          productName: product.ProductName || "",
          thumbnail: product.Thumbnail || "",
        }
      : null,
    variant: variant
      ? {
          id: variant._id,
          variantName: variant.VariantName || "",
          price: variant.Price || 0,
        }
      : null,
    deal: deal
      ? {
          id: deal._id,
          status: deal.status,
          offeredPrice: deal.offeredPrice || 0,
          sellerCounterPrice: deal.sellerCounterPrice || null,
        }
      : null,
  };
}

async function getOwnedReservation(user, reservationId) {
  const shop = await getShopForSeller(user);
  const reservation = await Reservation.findOne({ _id: reservationId, shopId: shop._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  return { shop, reservation };
}

async function reserveVariantInventory(variantId, quantity, session = null) {
  const normalizedQuantity = Number(quantity) || 1;
  const now = new Date();
  const query = ProductVariant.findOneAndUpdate(
    { _id: variantId, Quantity: { $gte: normalizedQuantity } },
    { $inc: { Quantity: -normalizedQuantity }, $set: { UpdatedAt: now } },
    { new: true }
  );

  const updatedVariant = session ? await query.session(session) : await query;
  if (!updatedVariant) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  return updatedVariant;
}

async function releaseVariantInventory(reservation, session = null) {
  if (!reservation?.inventoryHeld || !reservation.variantId) {
    return;
  }

  const quantity = Number(reservation.quantity) || 1;
  const now = new Date();
  const query = ProductVariant.findByIdAndUpdate(
    reservation.variantId,
    { $inc: { Quantity: quantity }, $set: { UpdatedAt: now } }
  );

  if (session) {
    await query.session(session);
  } else {
    await query;
  }

  reservation.inventoryHeld = false;
}

async function markReservationSold(reservation, session = null) {
  const soldQuantity = Number(reservation.quantity) || 1;
  const now = new Date();

  if (reservation.productId) {
    const productQuery = Product.findByIdAndUpdate(
      reservation.productId,
      { $inc: { SoldCount: soldQuantity }, $set: { UpdatedAt: now } }
    );
    if (session) {
      await productQuery.session(session);
    } else {
      await productQuery;
    }
  }

  if (reservation.variantId) {
    const variantQuery = ProductVariant.findByIdAndUpdate(
      reservation.variantId,
      { $inc: { SoldCount: soldQuantity }, $set: { UpdatedAt: now } }
    );
    if (session) {
      await variantQuery.session(session);
    } else {
      await variantQuery;
    }
  }

  reservation.inventoryHeld = false;
}

async function listSellerReservations(user, { tab = "holding" } = {}) {
  await expireOverdueReservations();
  const shop = await getShopForSeller(user);
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
    shopId: shop._id,
    status: { $in: statusFilter },
  })
    .sort({ UpdatedAt: -1 })
    .limit(100);

  return Promise.all(reservations.map(toPublicReservation));
}

async function getSellerReservationDetail(user, reservationId) {
  await expireOverdueReservations();
  const { reservation } = await getOwnedReservation(user, reservationId);
  return toPublicReservation(reservation);
}

async function confirmReservation(user, reservationId) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể xác nhận đơn đang chờ.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CONFIRMED;
  reservation.confirmedAt = now;
  reservation.agreedPrice = reservation.agreedPrice ?? reservation.reservedPrice;
  reservation.UpdatedAt = now;
  await reservation.save();

  return toPublicReservation(reservation);
}

async function rejectReservation(user, reservationId, { reason } = {}) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if ([RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.CANCELLED].includes(reservation.status)) {
    throw createServiceError("Không thể từ chối đơn này.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  if (reason) {
    reservation.note = `${reservation.note || ""}\n[Từ chối] ${reason}`.trim();
  }
  await releaseVariantInventory(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  return toPublicReservation(reservation);
}

async function cancelReservationBySeller(user, reservationId, { reason } = {}) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status === RESERVATION_STATUS.COMPLETED) {
    throw createServiceError("Đơn đã hoàn thành, không thể hủy.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  if (reason) {
    reservation.note = `${reservation.note || ""}\n[Hủy bởi shop] ${reason}`.trim();
  }
  await releaseVariantInventory(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  return toPublicReservation(reservation);
}

async function completeReservation(user, reservationId) {
  const { reservation, shop } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    throw createServiceError("Chỉ xác nhận hoàn thành khi đơn đã được chấp nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.COMPLETED;
  reservation.completedAt = now;
  reservation.UpdatedAt = now;

  const soldQuantity = Number(reservation.quantity) || 1;
  shop.soldCount = (shop.soldCount || 0) + soldQuantity;
  shop.UpdatedAt = now;
  await shop.save();

  await markReservationSold(reservation);
  await reservation.save();

  return toPublicReservation(reservation);
}

async function listPendingPriceDeals(user) {
  const shop = await getShopForSeller(user);
  const deals = await DealOffer.find({
    shopId: shop._id,
    status: DEAL_OFFER_STATUS.PENDING,
  })
    .sort({ CreatedAt: -1 })
    .limit(100);

  return Promise.all(
    deals.map(async (deal) => {
      const [buyer, product, variant] = await Promise.all([
        User.findById(deal.userId),
        Product.findById(deal.productId),
        ProductVariant.findById(deal.variantId),
      ]);

      return {
        id: deal._id,
        status: deal.status,
        originalPrice: deal.originalPrice || 0,
        offeredPrice: deal.offeredPrice || 0,
        quantity: Number(deal.quantity) || 1,
        sellerCounterPrice: deal.sellerCounterPrice || null,
        discountPercent: deal.discountPercent || 0,
        note: deal.note || "",
        sellerNote: deal.sellerNote || "",
        createdAt: deal.CreatedAt,
        buyer: buyer
          ? {
              id: buyer._id,
              fullName: buyer.FullName || "",
              phone: buyer.Phone || "",
              avatar: buyer.Avatar || "",
            }
          : null,
        product: product
          ? {
              id: product._id,
              productName: product.ProductName || "",
              thumbnail: product.Thumbnail || "",
            }
          : null,
        variant: variant
          ? {
              id: variant._id,
              variantName: variant.VariantName || "",
              price: variant.Price || 0,
            }
          : null,
      };
    })
  );
}

async function expireOverdueReservations() {
  const now = new Date();
  const overdue = await Reservation.find({
    status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED] },
    pickupTime: { $ne: null, $lte: now },
  }).limit(200);

  let cancelledCount = 0;

  for (const reservation of overdue) {
    try {
      const product = await Product.findById(reservation.productId);
      const shop = await ShopProfile.findById(reservation.shopId);
      const productName = product?.ProductName || "sản phẩm";

      reservation.status = RESERVATION_STATUS.CANCELLED;
      reservation.cancelledAt = now;
      reservation.cancelReason = NO_SHOW_CANCEL_REASON;
      reservation.note = `${reservation.note || ""}\n[Hủy tự động] ${NO_SHOW_CANCEL_REASON}`.trim();
      await releaseVariantInventory(reservation);
      reservation.UpdatedAt = now;
      await reservation.save();
      cancelledCount += 1;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã bị hủy",
          content: `Đơn giữ ${productName} đã bị hủy vì quá giờ lấy hàng (${NO_SHOW_CANCEL_REASON.toLowerCase()}).`,
        });
      }

      if (shop?.userId) {
        await createNotification(shop.userId, {
          title: "Đơn giữ hàng hết hạn",
          content: `Đơn giữ ${productName} đã tự hủy vì khách không đến lấy. Tồn kho đã được cộng lại.`,
        });
      }
    } catch (error) {
      console.error("expireOverdueReservations failed:", reservation._id, error.message);
    }
  }

  return { cancelledCount, checkedAt: now };
}

module.exports = {
  listSellerReservations,
  getSellerReservationDetail,
  confirmReservation,
  rejectReservation,
  cancelReservationBySeller,
  completeReservation,
  listPendingPriceDeals,
  toPublicReservation,
  computeTotal,
  reserveVariantInventory,
  releaseVariantInventory,
  markReservationSold,
  expireOverdueReservations,
  NO_SHOW_CANCEL_REASON,
};
