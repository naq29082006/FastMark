const mongoose = require("mongoose");

/**
 * ReservationAdjustment — lịch sử điều chỉnh đơn giữ hàng tại quầy (không cần duyệt).
 * Phục vụ audit, đối soát, tranh chấp.
 */
const ReservationAdjustmentSchema = new mongoose.Schema({
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    index: true,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },
  oldQuantity: { type: Number, required: true },
  newQuantity: { type: Number, required: true },
  giaCu: { type: Number, required: true },
  giaMoi: { type: Number, required: true },
  cocCu: { type: Number, required: true },
  cocMoi: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

ReservationAdjustmentSchema.index({ reservationId: 1, createdAt: -1 });

module.exports = mongoose.model("ReservationAdjustment", ReservationAdjustmentSchema);
