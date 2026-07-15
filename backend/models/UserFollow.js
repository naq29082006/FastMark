const mongoose = require("mongoose");

const UserFollowSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  followedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

UserFollowSchema.index({ userId: 1, followedUserId: 1 }, { unique: true });

module.exports = mongoose.model("UserFollow", UserFollowSchema);