const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    title:String,
    content:String,

    isRead:{type:Number,default:0},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Notification",NotificationSchema);