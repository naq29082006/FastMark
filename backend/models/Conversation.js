const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
    shopId:{type:mongoose.Schema.Types.ObjectId,ref:"ShopProfile"},
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    lastMessage:String,
    lastMessageAt:Date,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Conversation",ConversationSchema);