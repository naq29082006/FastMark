const productService = require("../services/productService");
const { success } = require("../utils/apiResponse");

exports.createProduct = async (req, res) => {
  const result = await productService.createProduct(req.currentUser, req.body);

  return success(res, {
    status: 201,
    message: result.message || "Đăng sản phẩm thành công.",
    data: {
      product: productService.toPublicProduct(result.product, result.variants),
      subscriptionActive: result.subscriptionActive,
      publiclyVisible: result.publiclyVisible,
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

exports.discoverProducts = async (req, res) => {
  const shopDiscoveryService = require("../services/shopDiscoveryService");
  const products = await shopDiscoveryService.discoverProducts({
    latitude: req.query.lat ?? req.query.latitude,
    longitude: req.query.lng ?? req.query.longitude,
    radiusMeters: req.query.radius ?? req.query.radiusMeters ?? 5000,
    categoryId:
      req.query.categoryId ?? req.query.productCategoryId ?? req.query.product_category_id ?? "",
    search: req.query.search ?? req.query.q ?? req.query.product ?? "",
    limit: req.query.limit ?? 80,
  });

  return success(res, {
    data: {
      products,
      count: products.length,
    },
  });
};
