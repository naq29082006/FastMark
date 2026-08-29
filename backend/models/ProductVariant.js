const mongoose = require("mongoose");

/**
 * ProductVariant — biến thể (size/loại/giá/tồn) của sản phẩm.
 * Chi tiết biến thể chỉ có đúng 1 ảnh: ImageUrl.
 * Gallery ảnh sản phẩm nằm trên Product.images (phần tử đầu = cover).
 */
const ProductVariantSchema = new mongoose.Schema({
  // Sản phẩm cha (ref Product).
  ProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },

  // Tên biến thể (vd: "1kg", "Đỏ").
  VariantName: { type: String, required: true, trim: true },
  // Giá bán (VND).
  Price: { type: Number, required: true, min: 0 },
  // Tồn kho hiện tại (đơn vị theo Product.DonVi).
  Quantity: { type: Number, required: true, min: 0, default: 0 },
  // Số lượng đã bán của biến thể này.
  SoldCount: { type: Number, default: 0, min: 0 },
  // URL ảnh biến thể (1 ảnh).
  ImageUrl: { type: String, default: "" },

  // Trạng thái: 0 = ẩn, 1 = đang bán.
  Status: { type: Number, default: 1 },

  // Thời điểm tạo biến thể.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ProductVariantSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ProductVariant", ProductVariantSchema);
