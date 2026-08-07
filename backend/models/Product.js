const mongoose = require("mongoose");
const { embeddedImagesField } = require("../utils/embeddedImages");

/**
 * Product — sản phẩm thuộc một gian hàng.
 */
const ProductSchema = new mongoose.Schema({  // Gian hàng sở hữu sản phẩm (ref ShopProfile).
  ShopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", required: true, index: true },
  // Danh mục sản phẩm (ref ProductCategory).
  CategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory", required: true, index: true },

  // Tên sản phẩm.
  ProductName: { type: String, required: true, trim: true },
  // Mô tả chi tiết.
  Description: { type: String, default: "" },
  // Đơn vị bán (kg, bó, hộp…).
  DonVi: { type: String, default: "", trim: true },

  // Gallery ảnh (URL, tối đa 5 — phần tử đầu = cover).
  images: embeddedImagesField,

  // Số lượt xem.
  ViewCount: { type: Number, default: 0 },
  // Số lượt thích / yêu thích.
  LikeCount: { type: Number, default: 0 },
  // Tổng đã bán (cộng từ biến thể).
  SoldCount: { type: Number, default: 0 },
  // Trạng thái: 0 = ẩn, 1 = đang bán (có thể bị ẩn khi shop hết gói).
  Status: { type: Number, default: 1, index: true },

  // Giá thấp nhất trong các biến thể (VND, cache để list nhanh).
  MinPrice: { type: Number, default: 0 },
  // Giá cao nhất trong các biến thể (VND, cache để list nhanh).
  MaxPrice: { type: Number, default: 0 },

 
  // Đang trong chương trình giảm giá.
  IsPromotion: { type: Boolean, default: false, index: true },
  // % giảm giá (1–100) — nguồn chính khi bật khuyến mãi.
  DiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
 
  // Thời điểm bắt đầu khuyến mãi.
  PromotionStartDate: { type: Date, default: null, index: true },
  // Thời điểm kết thúc khuyến mãi (hết hạn thì job tắt IsPromotion).
  PromotionEndDate: { type: Date, default: null, index: true },

  /**
   * Ghim sản phẩm trên gian hàng.
   * 0 = không ghim, 1 = vị trí 1, 2 = vị trí 2.
   * Mỗi shop tối đa 2 sản phẩm được ghim (mỗi vị trí 1 sản phẩm).
   */
  pinProduct: { type: Number, default: 0, min: 0, max: 2, index: true },

  /** Trạng thái xóa mềm: 1 = còn hiệu lực, 0 = đã gỡ. */
  IsDeleted: { type: Number, default: 1, index: true },
  /** Ai gỡ sản phẩm: admin | seller — chỉ có khi IsDeleted = 0. */
  RemovedBy: { type: String, default: "", trim: true, index: true },
  /** Lý do gỡ (bắt buộc khi RemovedBy = admin). */
  AdminRemovalReason: { type: String, default: "", trim: true },
  /** Thời điểm gỡ (admin hoặc seller). */
  RemovedAt: { type: Date, default: null },

  // Thời điểm tạo sản phẩm.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ProductSchema.index({ IsPromotion: 1, DiscountPercent: -1, PromotionEndDate: 1 });
ProductSchema.index(
  { ShopId: 1, pinProduct: 1 },
  {
    unique: true,
    partialFilterExpression: { pinProduct: { $in: [1, 2] } },
  }
);

ProductSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Product", ProductSchema);
