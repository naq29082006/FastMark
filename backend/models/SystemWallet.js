const mongoose = require("mongoose");

/**
 * SystemWallet — ví hệ thống (escrow) giữ tiền cọc giữ hàng.
 * Singleton: collection chỉ có tối đa một bản ghi.
 */
const SystemWalletSchema = new mongoose.Schema({
  balance: { type: Number, default: 0, min: 0 },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

SystemWalletSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SystemWallet", SystemWalletSchema);
