const mongoose = require("mongoose");

const ReportImageSchema = new mongoose.Schema({
    reportId:{type:mongoose.Schema.Types.ObjectId,ref:"Report"},
    imageUrl:String,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("ReportImage",ReportImageSchema);