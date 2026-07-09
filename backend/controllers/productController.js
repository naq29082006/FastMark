const productService = require("../services/productService");
const { success } = require("../utils/apiResponse");

exports.createProduct = async (req, res) => {
  const result = await productService.createProduct(req.currentUser, req.body);

  return success(res, {
    status: 201,
    message: "Đăng sản phẩm thành công.",
    data: {
      product: productService.toPublicProduct(result.product, result.variants),
    },
  });
};

exports.listMyProducts = async (req, res) => {
  const products = await productService.listMyProducts(req.currentUser);

  return success(res, {
    data: { products },
  });
};

exports.getMyProduct = async (req, res) => {
  const product = await productService.getMyProductById(req.currentUser, req.params.id);

  return success(res, {
    data: { product },
  });
};

exports.updateProduct = async (req, res) => {
  const result = await productService.updateProduct(req.currentUser, req.params.id, req.body);

  return success(res, {
    message: "Cập nhật sản phẩm thành công.",
    data: {
      product: productService.toPublicProduct(result.product, result.variants),
    },
  });
};

exports.softDeleteProduct = async (req, res) => {
  await productService.softDeleteProduct(req.currentUser, req.params.id);

  return success(res, {
    message: "Đã xóa sản phẩm. Không thể khôi phục.",
  });
};

exports.getProduct = async (req, res) => {
  const product = await productService.getProductById(req.params.id);

  return success(res, {
    data: { product },
  });
};

exports.listCategories = async (req, res) => {
  const categories = await productService.listCategories();

  return success(res, {
    data: { categories },
  });
};
