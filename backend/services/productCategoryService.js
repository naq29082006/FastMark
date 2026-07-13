const ProductCategory = require("../models/ProductCategory");
const Product = require("../models/Product");
const { normalizeCategoryId, isValidCategoryId } = require("../utils/categoryId");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");

const CATEGORY_SORT = { CreatedAt: 1, _id: 1 };

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function resolveCategoryName(category) {
  return pickString(category?.name || category?.categoryName);
}

function toPublicCategory(category) {
  return {
    id: String(category._id),
    name: resolveCategoryName(category),
    categoryName: resolveCategoryName(category),
    description: category.description || "",
    icon: pickString(category.icon),
    isDeleted: Number(category.IsDeleted) === 0 ? 0 : 1,
    IsDeleted: Number(category.IsDeleted) === 0 ? 0 : 1,
    createdAt: category.CreatedAt,
    updatedAt: category.UpdatedAt,
  };
}

function buildListQuery({ includeHidden = false } = {}) {
  if (includeHidden) {
    return {};
  }
  return { $or: [{ IsDeleted: 1 }, { IsDeleted: { $exists: false } }] };
}

async function listCategories({ includeHidden = false } = {}) {
  const categories = await ProductCategory.find(buildListQuery({ includeHidden })).sort(CATEGORY_SORT);
  return categories.map(toPublicCategory);
}

async function assertProductCategoryExists(categoryId) {
  const id = normalizeCategoryId(categoryId);
  if (!isValidCategoryId(id)) {
    throw createServiceError("Vui lòng chọn danh mục sản phẩm.");
  }

  const category = await ProductCategory.findById(id).lean();
  if (!category || Number(category.IsDeleted) === 0) {
    throw createServiceError("Danh mục sản phẩm không hợp lệ hoặc đã bị ẩn.");
  }

  return category;
}

async function getProductCategoryNameMap(categoryIds = []) {
  const uniqueIds = [...new Set(categoryIds.filter(Boolean).map((id) => String(id)))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const categories = await ProductCategory.find({ _id: { $in: uniqueIds } })
    .select("name categoryName icon")
    .lean();

  return new Map(
    categories.map((category) => [String(category._id), resolveCategoryName(category)])
  );
}

async function createCategory({ name, description, icon, isDeleted }) {
  const categoryName = pickString(name);
  if (!categoryName) {
    throw createServiceError("Vui lòng nhập tên danh mục.");
  }

  const existing = await ProductCategory.findOne({
    $or: [{ name: categoryName }, { categoryName }],
  });
  if (existing) {
    throw createServiceError("Tên danh mục đã tồn tại.");
  }

  const category = await ProductCategory.create({
    name: categoryName,
    categoryName,
    description: pickString(description),
    icon: pickString(icon),
    IsDeleted: Number(isDeleted) === 0 ? 0 : 1,
  });

  return toPublicCategory(category);
}

async function updateCategory(categoryId, { name, description, icon, isDeleted }) {
  const category = await ProductCategory.findById(categoryId);
  if (!category) {
    throw createServiceError("Không tìm thấy danh mục.", 404);
  }

  const categoryName = pickString(name);
  if (!categoryName) {
    throw createServiceError("Vui lòng nhập tên danh mục.");
  }

  const duplicate = await ProductCategory.findOne({
    $or: [{ name: categoryName }, { categoryName }],
    _id: { $ne: category._id },
  });
  if (duplicate) {
    throw createServiceError("Tên danh mục đã tồn tại.");
  }

  category.name = categoryName;
  category.categoryName = categoryName;
  category.description = pickString(description);
  if (icon !== undefined) {
    category.icon = pickString(icon);
  }
  if (isDeleted !== undefined) {
    category.IsDeleted = Number(isDeleted) === 0 ? 0 : 1;
  }
  category.UpdatedAt = new Date();
  await category.save();

  return toPublicCategory(category);
}

async function deleteCategory(categoryId) {
  const category = await ProductCategory.findById(categoryId);
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
    throw createServiceError(`Không thể xóa danh mục đang có ${productCount} sản phẩm.`, 400);
  }

  await category.deleteOne();
  return { id: categoryId };
}

async function uploadCategoryIcon({ file, categoryId }) {
  if (!file?.buffer?.length) {
    throw createServiceError("Vui lòng chọn ảnh icon.", 400);
  }

  const extension = resolveFileExtension(file.mimetype, file.originalname);
  const folder = categoryId ? `categories/products/${categoryId}` : "categories/products/temp";
  const fileName = `icon-${Date.now()}.${extension}`;

  const uploaded = await uploadImageToSupabase({
    buffer: file.buffer,
    mimeType: file.mimetype,
    folder,
    fileName,
  });

  return { icon: uploaded.publicUrl };
}

module.exports = {
  listCategories,
  assertProductCategoryExists,
  getProductCategoryNameMap,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryIcon,
};
