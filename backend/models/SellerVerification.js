const mongoose = require("mongoose");

const SellerVerificationSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    cccdFrontImage:String,
    cccdBackImage:String,
    selfieImage:String,

    address:String,

    latitude:Number,
    longitude:Number,

    note:String,

    status:{type:Number,default:0},

    rejectReason:String,

    submittedAt:Date,
    approvedAt:Date,

    approvedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("SellerVerification",SellerVerificationSchema);