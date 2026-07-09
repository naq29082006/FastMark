const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    targetUserId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    productId:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},

    reportType:Number,
    title:String,
    content:String,

    status:{type:Number,default:0},

    processedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    processedAt:Date,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Report",ReportSchema);