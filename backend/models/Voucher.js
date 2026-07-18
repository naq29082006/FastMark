const mongoose = require("mongoose");
const { VOUCHER_DISCOUNT_TYPE, VOUCHER_STATUS } = require("../constants/voucher");

const VoucherSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  discountType: {
    type: Number,
    enum: Object.values(VOUCHER_DISCOUNT_TYPE),
    default: VOUCHER_DISCOUNT_TYPE.PERCENT,
  },
  discountValue: { type: Number, required: true, min: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  usedCount: { type: Number, default: 0 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  status: {
    type: Number,
    enum: Object.values(VOUCHER_STATUS),
    default: VOUCHER_STATUS.ON,
    index: true,
  },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

VoucherSchema.index({ shopId: 1, code: 1 }, { unique: true });

VoucherSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Voucher", VoucherSchema);
