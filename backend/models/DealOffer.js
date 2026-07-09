const mongoose = require("mongoose");

const DealOfferSchema = new mongoose.Schema({
    productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},
    variantId:{type:mongoose.Schema.Types.ObjectId,ref:"ProductVariant"},
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    shopId:{type:mongoose.Schema.Types.ObjectId,ref:"ShopProfile"},

    originalPrice:Number,
    offeredPrice:Number,
    discountPercent:Number,

    status:{type:Number,default:0},

    respondedAt:Date,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("DealOffer",DealOfferSchema);