const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
    categoryName:{type:String,required:true,unique:true},
    description:String,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Category",CategorySchema);