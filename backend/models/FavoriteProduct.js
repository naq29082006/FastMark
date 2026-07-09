const mongoose = require("mongoose");

const FavoriteProductSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("FavoriteProduct",FavoriteProductSchema);