const DealOffer = require("../models/DealOffer");
const Reservation = require("../models/Reservation");
const ProductVariant = require("../models/ProductVariant");
const { DEAL_OFFER_STATUS } = require("../constants/dealOfferStatus");
const {
  RESERVATION_STATUS,
  BUYER_CANCEL_LOCK_MINUTES,
} = require("../constants/reservationStatus");
const { getShopForSeller } = require("./shopSettingsService");
const { toPublicReservation } = require("./reservationService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

async function getOwnedDeal(user, dealId) {
  const shop = await getShopForSeller(user);
  const deal = await DealOffer.findOne({ _id: dealId, shopId: shop._id });
  if (!deal) {
    throw createServiceError("Không tìm thấy deal giá.", 404);
  }
  return { shop, deal };
}

async function listSellerDeals(user, { status } = {}) {
  const shop = await getShopForSeller(user);
  const query = { shopId: shop._id };
  if (status !== undefined && status !== null && status !== "") {
    query.status = Number(status);
  }

  const deals = await DealOffer.find(query).sort({ CreatedAt: -1 }).limit(100);
  return deals.map((deal) => ({
    id: deal._id,
    status: deal.status,
    originalPrice: deal.originalPrice || 0,
    offeredPrice: deal.offeredPrice || 0,
    sellerCounterPrice: deal.sellerCounterPrice || null,
    discountPercent: deal.discountPercent || 0,
    note: deal.note || "",
    sellerNote: deal.sellerNote || "",
    respondedAt: deal.respondedAt || null,
    createdAt: deal.CreatedAt,
    productId: deal.productId,
    variantId: deal.variantId,
    userId: deal.userId,
    reservationId: deal.reservationId || null,
  }));
}

async function acceptDealOffer(user, dealId) {
  const { shop, deal } = await getOwnedDeal(user, dealId);

  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }

  const variant = await ProductVariant.findById(deal.variantId);
  if (!variant) {
    throw createServiceError("Biến thể sản phẩm không tồn tại.");
  }

  const finalPrice = deal.sellerCounterPrice || deal.offeredPrice;
  const now = new Date();
  const cancelLockedAt = new Date(now.getTime() + BUYER_CANCEL_LOCK_MINUTES * 60 * 1000);

  const reservation = await Reservation.create({
    variantId: deal.variantId,
    shopId: shop._id,
    productId: deal.productId,
    userId: deal.userId,
    dealOfferId: deal._id,
    quantity: 1,
    reservedPrice: deal.originalPrice,
    agreedPrice: finalPrice,
    status: RESERVATION_STATUS.CONFIRMED,
    confirmedAt: now,
    buyerPriceAcceptedAt: now,
    cancelLockedAt,
    CreatedAt: now,
    UpdatedAt: now,
  });

  deal.status = DEAL_OFFER_STATUS.ACCEPTED;
  deal.respondedAt = now;
  deal.reservationId = reservation._id;
  deal.UpdatedAt = now;
  await deal.save();

  return {
    deal: {
      id: deal._id,
      status: deal.status,
      reservationId: reservation._id,
    },
    reservation: await toPublicReservation(reservation),
  };
}

async function rejectDealOffer(user, dealId, { reason } = {}) {
  const { deal } = await getOwnedDeal(user, dealId);

  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }

  const now = new Date();
  deal.status = DEAL_OFFER_STATUS.REJECTED;
  deal.respondedAt = now;
  deal.sellerNote = reason || deal.sellerNote || "";
  deal.UpdatedAt = now;
  await deal.save();

  return {
    id: deal._id,
    status: deal.status,
  };
}

async function counterDealOffer(user, dealId, payload) {
  const { deal } = await getOwnedDeal(user, dealId);

  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }

  const counterPrice = pickNumber(payload.counterPrice ?? payload.sellerCounterPrice);
  if (!Number.isFinite(counterPrice) || counterPrice <= 0) {
    throw createServiceError("Giá đề xuất không hợp lệ.");
  }

  const now = new Date();
  deal.sellerCounterPrice = counterPrice;
  deal.sellerNote = String(payload.note || payload.sellerNote || "").trim();
  deal.respondedAt = now;
  deal.UpdatedAt = now;
  await deal.save();

  return {
    id: deal._id,
    status: deal.status,
    sellerCounterPrice: deal.sellerCounterPrice,
    sellerNote: deal.sellerNote,
  };
}

module.exports = {
  listSellerDeals,
  acceptDealOffer,
  rejectDealOffer,
  counterDealOffer,
};
