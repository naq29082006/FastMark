const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
    shopId:{type:mongoose.Schema.Types.ObjectId,ref:"ShopProfile"},
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    lastMessage:String,
    lastMessageAt:Date,
    nextThuTu:{type:Number,default:0},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

ConversationSchema.index({ shopId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Conversation",ConversationSchema);