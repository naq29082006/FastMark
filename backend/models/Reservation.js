const mongoose = require("mongoose");

const ReservationSchema = new mongoose.Schema({
    variantId:{type:mongoose.Schema.Types.ObjectId,ref:"ProductVariant"},
    shopId:{type:mongoose.Schema.Types.ObjectId,ref:"ShopProfile"},
    productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    quantity:Number,
    reservedPrice:Number,

    pickupTime:Date,
    note:String,

    status:{type:Number,default:0},

    confirmedAt:Date,
    completedAt:Date,
    cancelledAt:Date,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Reservation",ReservationSchema);