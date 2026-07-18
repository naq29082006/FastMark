const mongoose = require("mongoose");
const { WALLET_TX_TYPE, WALLET_TX_STATUS } = require("../constants/wallet");

const WalletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: Number,
    enum: Object.values(WALLET_TX_TYPE),
    required: true,
    index: true,
  },
  amount: { type: Number, required: true, min: 1 },
  status: {
    type: Number,
    enum: Object.values(WALLET_TX_STATUS),
    default: WALLET_TX_STATUS.PENDING,
    index: true,
  },
  orderCode: { type: Number, required: true, unique: true, index: true },
  paymentLinkId: { type: String, default: "" },
  checkoutUrl: { type: String, default: "" },
  description: { type: String, default: "" },
  balanceAfter: { type: Number, default: null },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

WalletTransactionSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("WalletTransaction", WalletTransactionSchema);
