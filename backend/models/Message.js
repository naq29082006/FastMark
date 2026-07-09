const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    conversationId:{type:mongoose.Schema.Types.ObjectId,ref:"Conversation"},
    senderId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    messageType:{type:Number,default:0},
    content:String,

    isRead:{type:Number,default:0},

    messageStatus:{type:Number,default:0},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Message",MessageSchema);