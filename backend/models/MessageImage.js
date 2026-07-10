const mongoose = require("mongoose");

const MessageImageSchema = new mongoose.Schema({
    messageId:{type:mongoose.Schema.Types.ObjectId,ref:"Message",index:true},
    imageUrl:String,
    sortOrder:{type:Number,default:0},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now},
    DeletedAt:{type:Date,default:null}
});

module.exports = mongoose.model("MessageImage",MessageImageSchema);