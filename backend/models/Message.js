const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    conversationId:{type:mongoose.Schema.Types.ObjectId,ref:"Conversation",index:true},
    senderId:{type:mongoose.Schema.Types.ObjectId,index:true},
    senderType:{type:Number,default:0,index:true},

    ThuTu:{type:Number,default:0,index:true},
    messageType:{type:Number,default:0},
    content:String,

    isRead:{type:Number,default:0},

    messageStatus:{type:Number,default:0},

    DeletedAt:{type:Date,default:null},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

MessageSchema.index({ conversationId: 1, ThuTu: 1 });

module.exports = mongoose.model("Message",MessageSchema);