const mongoose = require("mongoose");

const ShopProfileSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

    description:String,
    address:String,

    latitude:Number,
    longitude:Number,

    phone:String,

    openTime:String,
    closeTime:String,

    isOpen:{type:Number,default:1},
    status:{type:Number,default:1},

    averageRating:{type:Number,default:0},
    totalLikes:{type:Number,default:0},
    totalReviews:{type:Number,default:0},
    totalProducts:{type:Number,default:0},
    soldCount:{type:Number,default:0},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now},
});

module.exports = mongoose.model("ShopProfile",ShopProfileSchema);