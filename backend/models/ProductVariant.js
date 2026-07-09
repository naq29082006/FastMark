const mongoose = require("mongoose");

const ProductVariantSchema = new mongoose.Schema({
    productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},

    variantName:String,
    price:Number,
    quantity:Number,
    imageUrl:String,

    status:{type:Number,default:1},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now},
});

module.exports = mongoose.model("ProductVariant",ProductVariantSchema);