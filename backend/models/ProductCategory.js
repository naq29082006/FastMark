const mongoose = require("mongoose");

/**
 * ProductCategory — danh mục sản phẩm (admin quản lý).
 * Collection Mongo: "categories".
 */
const ProductCategorySchema = new mongoose.Schema({
  // Tên danh mục (unique).
  name: { type: String, required: true, unique: true, trim: true },
  // Mô tả danh mục.
  description: String,
  // Cờ dùng/xóa mềm: 1 = đang dùng, 0 = đã xóa mềm (convention cũ của project).
  IsDeleted: { type: Number, default: 1 },
  /** Số ngày buyer có thể khiếu nại sau khi nhận hàng (1–30). */
  disputeDays: { type: Number, default: 7, min: 1, max: 30 },
  // Thời điểm tạo danh mục.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ProductCategorySchema.pre("save", function touchUpdatedAt() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ProductCategory", ProductCategorySchema, "categories");
