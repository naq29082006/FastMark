const ProductCategory = require("../models/ProductCategory");
const { normalizeCategoryId, isValidCategoryId } = require("../utils/categoryId");
const { normalizeEscrowProtectionDays } = require("../utils/escrowProtectionDays");

const CATEGORY_SORT = { IsDeleted: -1, CreatedAt: 1, _id: 1 };

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function resolveCategoryName(category) {
  return pickString(category?.name);
}

function resolveDisputeDays(category) {
  if (category?.disputeDays != null) {
    return normalizeEscrowProtectionDays(category.disputeDays);
  }
  return normalizeEscrowProtectionDays(undefined);
}

function toPublicCategory(category) {
  return {
    id: String(category._id),
    name: resolveCategoryName(category),
    categoryName: resolveCategoryName(category),
    description: category.description || "",
    disputeDays: resolveDisputeDays(category),
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
    .select("name")
    .lean();

  return new Map(
    categories.map((category) => [String(category._id), resolveCategoryName(category)])
  );
}

async function createCategory({ name, description, disputeDays }) {
  const categoryName = pickString(name);
  if (!categoryName) {
    throw createServiceError("Vui lòng nhập tên danh mục.");
  }

  const existing = await ProductCategory.findOne({ name: categoryName });
  if (existing) {
    if (Number(existing.IsDeleted) === 0) {
      existing.name = categoryName;
      existing.description = pickString(description);
      if (disputeDays !== undefined) {
        existing.disputeDays = normalizeEscrowProtectionDays(disputeDays);
      }
      existing.IsDeleted = 1;
      existing.UpdatedAt = new Date();
      await existing.save();
      return { category: toPublicCategory(existing), restored: true };
    }
    throw createServiceError("Tên danh mục đã tồn tại.");
  }

  const category = await ProductCategory.create({
    name: categoryName,
    description: pickString(description),
    disputeDays: normalizeEscrowProtectionDays(disputeDays),
    IsDeleted: 1,
  });

  return { category: toPublicCategory(category), restored: false };
}

async function updateCategory(categoryId, { name, description, disputeDays }) {
  const category = await ProductCategory.findById(categoryId);
  if (!category) {
    throw createServiceError("Không tìm thấy danh mục.", 404);
  }

  const categoryName = pickString(name);
  if (!categoryName) {
    throw createServiceError("Vui lòng nhập tên danh mục.");
  }

  const duplicate = await ProductCategory.findOne({
    name: categoryName,
    _id: { $ne: category._id },
  });
  if (duplicate) {
    throw createServiceError("Tên danh mục đã tồn tại.");
  }

  category.name = categoryName;
  category.description = pickString(description);
  if (disputeDays !== undefined) {
    category.disputeDays = normalizeEscrowProtectionDays(disputeDays);
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

  if (Number(category.IsDeleted) === 0) {
    return toPublicCategory(category);
  }

  category.IsDeleted = 0;
  category.UpdatedAt = new Date();
  await category.save();
  return toPublicCategory(category);
}

async function restoreCategory(categoryId) {
  const category = await ProductCategory.findById(categoryId);
  if (!category) {
    throw createServiceError("Không tìm thấy danh mục.", 404);
  }
  if (Number(category.IsDeleted) !== 0) {
    return toPublicCategory(category);
  }
  category.IsDeleted = 1;
  category.UpdatedAt = new Date();
  await category.save();
  return toPublicCategory(category);
}

async function resolveDisputeDaysForCategoryId(categoryId) {
  const id = normalizeCategoryId(categoryId);
  if (!isValidCategoryId(id)) {
    return null;
  }
  const category = await ProductCategory.findById(id).select("disputeDays").lean();
  if (!category) {
    return null;
  }
  return resolveDisputeDays(category);
}

module.exports = {
  listCategories,
  assertProductCategoryExists,
  getProductCategoryNameMap,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
  resolveDisputeDaysForCategoryId,
  resolveDisputeDays,
};
