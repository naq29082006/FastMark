const Category = require("../models/Category");
const Product = require("../models/Product");
const { normalizeCategoryId, isValidCategoryId } = require("../utils/categoryId");
const { PRODUCT_STATUS } = require("../constants/productStatus");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function toPublicCategory(category) {
  return {
    id: String(category._id),
    categoryName: category.categoryName,
    description: category.description || "",
    createdAt: category.CreatedAt,
    updatedAt: category.UpdatedAt,
  };
}

async function listCategories() {
  const categories = await Category.find().sort({ categoryName: 1 });
  return categories.map(toPublicCategory);
}

async function assertCategoryExists(categoryId) {
  const id = normalizeCategoryId(categoryId);
  if (!isValidCategoryId(id)) {
    throw createServiceError("Vui lòng chọn danh mục kinh doanh.");
  }

  const category = await Category.findById(id).lean();
  if (!category) {
    throw createServiceError("Danh mục kinh doanh không hợp lệ hoặc đã bị xóa.");
  }

  return category;
}

async function getCategoryNameMap(categoryIds = []) {
  const uniqueIds = [...new Set(categoryIds.filter(Boolean).map((id) => String(id)))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const categories = await Category.find({ _id: { $in: uniqueIds } })
    .select("categoryName")
    .lean();

  return new Map(categories.map((category) => [String(category._id), category.categoryName || ""]));
}

async function createCategory({ categoryName, description }) {
  const name = pickString(categoryName);
  if (!name) {
    throw createServiceError("Vui lòng nhập tên danh mục.");
  }

  const existing = await Category.findOne({ categoryName: name });
  if (existing) {
    throw createServiceError("Tên danh mục đã tồn tại.");
  }

  const category = await Category.create({
    categoryName: name,
    description: pickString(description),
  });

  return toPublicCategory(category);
}

async function updateCategory(categoryId, { categoryName, description }) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw createServiceError("Không tìm thấy danh mục.", 404);
  }

  const name = pickString(categoryName);
  if (!name) {
    throw createServiceError("Vui lòng nhập tên danh mục.");
  }

  const duplicate = await Category.findOne({
    categoryName: name,
    _id: { $ne: category._id },
  });
  if (duplicate) {
    throw createServiceError("Tên danh mục đã tồn tại.");
  }

  category.categoryName = name;
  category.description = pickString(description);
  category.UpdatedAt = new Date();
  await category.save();

  return toPublicCategory(category);
}

async function deleteCategory(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw createServiceError("Không tìm thấy danh mục.", 404);
  }

  const productCount = await Product.countDocuments({
    CategoryId: category._id,
    $or: [
      { Status: PRODUCT_STATUS.ACTIVE },
      { Status: { $exists: false }, IsDeleted: { $ne: true } },
    ],
  });
  if (productCount > 0) {
    throw createServiceError(
      `Không thể xóa danh mục đang có ${productCount} sản phẩm.`,
      400
    );
  }

  await category.deleteOne();
  return { id: categoryId };
}

module.exports = {
  listCategories,
  assertCategoryExists,
  getCategoryNameMap,
  createCategory,
  updateCategory,
  deleteCategory,
};
