const categoryService = require("../services/categoryService");
const { success } = require("../utils/apiResponse");

exports.listCategories = async (req, res) => {
  const categories = await categoryService.listCategories();

  return success(res, {
    data: { categories },
  });
};

exports.createCategory = async (req, res) => {
  const category = await categoryService.createCategory(req.body);

  return success(res, {
    status: 201,
    message: "Tạo danh mục thành công.",
    data: { category },
  });
};

exports.updateCategory = async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);

  return success(res, {
    message: "Cập nhật danh mục thành công.",
    data: { category },
  });
};

exports.deleteCategory = async (req, res) => {
  await categoryService.deleteCategory(req.params.id);

  return success(res, {
    message: "Xóa danh mục thành công.",
  });
};
