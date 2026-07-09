const mongoose = require("mongoose");

const VariantImageSchema = new mongoose.Schema(
  {
    ImageUrl: { type: String, required: true },
    SortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const ProductVariantSchema = new mongoose.Schema({
  ProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },

  VariantName: { type: String, required: true, trim: true },
  Price: { type: Number, required: true, min: 0 },
  Quantity: { type: Number, required: true, min: 0, default: 0 },
  Images: { type: [VariantImageSchema], default: [] },

  Status: { type: Number, default: 1 },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

ProductVariantSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ProductVariant", ProductVariantSchema);
