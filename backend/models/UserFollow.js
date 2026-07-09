const mongoose = require("mongoose");

const UserFollowSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    followedUserId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("UserFollow",UserFollowSchema);