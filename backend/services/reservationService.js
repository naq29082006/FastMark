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
const { getShopForSeller } = require("./shopSettingsService");

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
  const [buyer, product, variant, deal] = await Promise.all([
    User.findById(doc.userId),
    Product.findById(doc.productId),
    ProductVariant.findById(doc.variantId),
    doc.dealOfferId ? DealOffer.findById(doc.dealOfferId) : null,
  ]);

  return {
    id: doc._id,
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
    buyerPriceAcceptedAt: doc.buyerPriceAcceptedAt || null,
    cancelLockedAt: doc.cancelLockedAt || null,
    buyerCancelLocked: doc.cancelLockedAt ? new Date() >= new Date(doc.cancelLockedAt) : false,
    createdAt: doc.CreatedAt,
    updatedAt: doc.UpdatedAt,
    dealOfferId: doc.dealOfferId || null,
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

async function listSellerReservations(user, { tab = "holding" } = {}) {
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
  await reservation.save();

  const soldQuantity = Number(reservation.quantity) || 1;
  shop.soldCount = (shop.soldCount || 0) + soldQuantity;
  shop.UpdatedAt = now;
  await shop.save();

  if (reservation.productId) {
    await Product.findByIdAndUpdate(reservation.productId, {
      $inc: { SoldCount: soldQuantity },
      $set: { UpdatedAt: now },
    });
  }

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
};
