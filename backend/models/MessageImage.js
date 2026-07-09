const mongoose = require("mongoose");

const MessageImageSchema = new mongoose.Schema({
    messageId:{type:mongoose.Schema.Types.ObjectId,ref:"Message"},
    imageUrl:String,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now},
    DeletedAt:{type:Date,default:null}
});

module.exports = mongoose.model("MessageImage",MessageImageSchema);