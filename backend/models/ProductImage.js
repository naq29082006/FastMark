const mongoose = require("mongoose");

const ProductImageSchema = new mongoose.Schema({
    productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},
    imageUrl:String,
    sortOrder:Number,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now},
});

module.exports = mongoose.model("ProductImage",ProductImageSchema);