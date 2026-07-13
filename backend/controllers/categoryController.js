const categoryService = require("../services/categoryService");
const { success } = require("../utils/apiResponse");

function pickPayload(body = {}) {
  const payload = {
    name: body.name ?? body.categoryName,
    description: body.description,
    isDeleted: body.isDeleted ?? body.IsDeleted,
  };

  if (body.icon !== undefined) {
    payload.icon = body.icon;
  }

  return payload;
}

exports.listProductCategories = async (req, res) => {
  const categories = await categoryService.listProductCategories({ includeHidden: true });
  return success(res, { data: { categories } });
};

exports.createProductCategory = async (req, res) => {
  const category = await categoryService.createProductCategory(pickPayload(req.body));
  return success(res, {
    status: 201,
    message: "Tạo danh mục sản phẩm thành công.",
    data: { category },
  });
};

exports.updateProductCategory = async (req, res) => {
  const category = await categoryService.updateProductCategory(req.params.id, pickPayload(req.body));
  return success(res, {
    message: "Cập nhật danh mục sản phẩm thành công.",
    data: { category },
  });
};

exports.deleteProductCategory = async (req, res) => {
  await categoryService.deleteProductCategory(req.params.id);
  return success(res, { message: "Xóa danh mục sản phẩm thành công." });
};

exports.uploadProductCategoryIcon = async (req, res) => {
  const uploaded = await categoryService.uploadProductCategoryIcon({
    file: req.file,
    categoryId: req.params.id,
  });
  return success(res, { data: uploaded });
};

exports.listShopCategories = async (req, res) => {
  const categories = await categoryService.listShopCategories({ includeHidden: true });
  return success(res, { data: { categories } });
};

exports.createShopCategory = async (req, res) => {
  const category = await categoryService.createShopCategory(pickPayload(req.body));
  return success(res, {
    status: 201,
    message: "Tạo danh mục cửa hàng thành công.",
    data: { category },
  });
};

exports.updateShopCategory = async (req, res) => {
  const category = await categoryService.updateShopCategory(req.params.id, pickPayload(req.body));
  return success(res, {
    message: "Cập nhật danh mục cửa hàng thành công.",
    data: { category },
  });
};

exports.deleteShopCategory = async (req, res) => {
  await categoryService.deleteShopCategory(req.params.id);
  return success(res, { message: "Xóa danh mục cửa hàng thành công." });
};

exports.uploadShopCategoryIcon = async (req, res) => {
  const uploaded = await categoryService.uploadShopCategoryIcon({
    file: req.file,
    categoryId: req.params.id,
  });
  return success(res, { data: uploaded });
};

// Legacy single-category handlers
exports.listCategories = exports.listProductCategories;
exports.createCategory = exports.createProductCategory;
exports.updateCategory = exports.updateProductCategory;
exports.deleteCategory = exports.deleteProductCategory;
