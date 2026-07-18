const mongoose = require("mongoose");
const { BANNER_TARGET_TYPE, BANNER_STATUS } = require("../constants/banner");

const BannerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  targetType: {
    type: Number,
    enum: Object.values(BANNER_TARGET_TYPE),
    default: BANNER_TARGET_TYPE.PROMOTION,
  },
  targetId: { type: String, default: "" },
  priority: { type: Number, default: 0 },
  status: {
    type: Number,
    enum: Object.values(BANNER_STATUS),
    default: BANNER_STATUS.ACTIVE,
    index: true,
  },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

BannerSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Banner", BannerSchema);
