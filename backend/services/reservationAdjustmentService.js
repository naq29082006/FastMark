const mongoose = require("mongoose");

const Reservation = require("../models/Reservation");
const ReservationAdjustment = require("../models/ReservationAdjustment");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const { RESERVATION_STATUS } = require("../constants");
const { getReservationBuyerId } = require("../utils/reservationCompat");
const {
  refundDepositFromSystem,
  notifyWalletBalanceUpdated,
  getWalletBalance,
  reconcileUserWalletBalanceFromLedger,
} = require("./walletService");
const {
  getOwnedReservation,
  toPublicReservation,
  processReservationLifecycle,
} = require("./reservationService");
const { emitOrderUpdated } = require("./orderRealtimeService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickInteger(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return null;
  }
  return num;
}

function amountsEqual(a, b) {
  return Math.round(Number(a) || 0) === Math.round(Number(b) || 0);
}

function computeDepositAmount(unitPrice, quantity, depositPercent) {
  const percent = Math.max(0, Math.min(100, Number(depositPercent) || 0));
  if (percent <= 0) {
    return 0;
  }
  return Math.round((Number(unitPrice) * Number(quantity) * percent) / 100);
}

function resolveUnitPrice(reservation) {
  return Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0;
}

async function adjustVariantInventoryHeld(reservation, oldQuantity, newQuantity, session) {
  if (!reservation?.inventoryHeld || !reservation.variantId) {
    return;
  }
  const delta = Number(newQuantity) - Number(oldQuantity);
  if (!delta) {
    return;
  }
  const now = new Date();
  if (delta > 0) {
    const query = ProductVariant.findOneAndUpdate(
      { _id: reservation.variantId, Quantity: { $gte: delta } },
      { $inc: { Quantity: -delta }, $set: { UpdatedAt: now } },
      { returnDocument: "after", session }
    );
    const updated = await query;
    if (!updated) {
      throw createServiceError("Số lượng vượt quá tồn kho.", 400);
    }
    return;
  }
  const releaseQty = Math.abs(delta);
  await ProductVariant.findByIdAndUpdate(
    reservation.variantId,
    { $inc: { Quantity: releaseQty }, $set: { UpdatedAt: now } },
    { session }
  );
}

function mapAdjustmentToPublic(doc, productName = "") {
  if (!doc) {
    return null;
  }
  return {
    id: String(doc._id),
    reservationId: doc.reservationId ? String(doc.reservationId) : "",
    shopId: doc.shopId ? String(doc.shopId) : "",
    buyerId: doc.buyerId ? String(doc.buyerId) : "",
    productId: doc.productId ? String(doc.productId) : "",
    productName: productName || "",
    oldQuantity: Number(doc.oldQuantity) || 0,
    newQuantity: Number(doc.newQuantity) || 0,
    oldReservedPrice: Number(doc.oldReservedPrice) || 0,
    newReservedPrice: Number(doc.newReservedPrice) || 0,
    oldDepositAmount: Number(doc.oldDepositAmount) || 0,
    newDepositAmount: Number(doc.newDepositAmount) || 0,
    createdAt: doc.createdAt || null,
  };
}

async function loadAdjustmentsForReservation(reservationId, { productName = "" } = {}) {
  const docs = await ReservationAdjustment.find({ reservationId })
    .sort({ createdAt: -1 })
    .lean();
  return docs.map((doc) => mapAdjustmentToPublic(doc, productName));
}

async function loadAdjustmentsForReservations(reservationIds = []) {
  const ids = [...new Set(reservationIds.filter(Boolean).map(String))];
  if (!ids.length) {
    return new Map();
  }
  const docs = await ReservationAdjustment.find({ reservationId: { $in: ids } })
    .sort({ createdAt: -1 })
    .lean();
  const map = new Map();
  for (const doc of docs) {
    const key = String(doc.reservationId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(mapAdjustmentToPublic(doc));
  }
  return map;
}

async function adjustReservationAtPickup(user, reservationId, payload = {}) {
  await processReservationLifecycle();
  const { shop, reservation } = await getOwnedReservation(user, reservationId);

  if (Number(reservation.status) !== RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError("Chỉ điều chỉnh đơn đang chờ giao hàng.", 403);
  }

  const newQuantity = pickInteger(payload.quantity ?? payload.newQuantity);
  if (newQuantity == null || newQuantity < 1) {
    throw createServiceError("Số lượng không hợp lệ.");
  }

  const oldQuantity = Number(reservation.quantity) || 0;
  const oldReservedPrice = Number(reservation.reservedPrice) || resolveUnitPrice(reservation);
  const oldDepositAmount = Number(reservation.depositAmount) || 0;

  if (newQuantity >= oldQuantity) {
    throw createServiceError("Chỉ được giảm số lượng so với đơn hiện tại.", 400);
  }

  const newReservedPrice = oldReservedPrice;

  const newDepositAmount = computeDepositAmount(
    newReservedPrice,
    newQuantity,
    reservation.depositPercent
  );

  if (
    oldQuantity === newQuantity &&
    amountsEqual(oldReservedPrice, newReservedPrice) &&
    amountsEqual(oldDepositAmount, newDepositAmount)
  ) {
    const product = reservation.productId
      ? await Product.findById(reservation.productId).select("ProductName").lean()
      : null;
    const adjustments = await loadAdjustmentsForReservation(reservation._id, {
      productName: product?.ProductName || "",
    });
    return toPublicReservation(reservation, { adjustments });
  }

  const buyerId = getReservationBuyerId(reservation);
  if (!buyerId) {
    throw createServiceError("Không xác định được người mua.", 400);
  }
  if (!reservation.productId) {
    throw createServiceError("Đơn thiếu thông tin sản phẩm.", 400);
  }

  const session = await mongoose.startSession();
  let savedReservation = reservation;

  try {
    await session.withTransaction(async () => {
      await adjustVariantInventoryHeld(reservation, oldQuantity, newQuantity, session);

      await ReservationAdjustment.create(
        [
          {
            reservationId: reservation._id,
            shopId: shop._id,
            buyerId,
            productId: reservation.productId,
            oldQuantity,
            newQuantity,
            oldReservedPrice,
            newReservedPrice,
            oldDepositAmount,
            newDepositAmount,
            createdAt: new Date(),
          },
        ],
        { session }
      );

      reservation.quantity = newQuantity;
      reservation.reservedPrice = newReservedPrice;
      reservation.agreedPrice = newReservedPrice;
      reservation.depositAmount = newDepositAmount;
      reservation.updatedAt = new Date();
      await reservation.save({ session });

      const depositRefund = oldDepositAmount - newDepositAmount;
      if (depositRefund > 0 && reservation.depositPaidAt && buyerId) {
        await refundDepositFromSystem(buyerId, depositRefund, {
          description: "Hoàn phần cọc do điều chỉnh đơn giữ hàng",
          reservationId: reservation._id,
          session,
        });
      }

      savedReservation = reservation;
    });
  } finally {
    session.endSession();
  }

  const product = savedReservation.productId
    ? await Product.findById(savedReservation.productId).select("ProductName").lean()
    : null;
  const adjustments = await loadAdjustmentsForReservation(savedReservation._id, {
    productName: product?.ProductName || "",
  });
  const publicReservation = await toPublicReservation(savedReservation, { adjustments });

  emitOrderUpdated(savedReservation, {
    action: "quantity_adjusted",
    previousQuantity: oldQuantity,
    newQuantity,
  });

  const depositRefund = oldDepositAmount - newDepositAmount;
  if (depositRefund > 0 && buyerId) {
    await reconcileUserWalletBalanceFromLedger(buyerId);
    const wallet = await getWalletBalance(buyerId);
    notifyWalletBalanceUpdated(buyerId, wallet.balance, {
      reservationId: String(savedReservation._id),
    });
  }

  return publicReservation;
}

module.exports = {
  adjustReservationAtPickup,
  loadAdjustmentsForReservation,
  loadAdjustmentsForReservations,
  mapAdjustmentToPublic,
  computeDepositAmount,
};
