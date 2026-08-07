const productCategoryService = require("./productCategoryService");
const shopCategoryService = require("./shopCategoryService");

module.exports = {
  listProductCategories: productCategoryService.listCategories,
  createProductCategory: productCategoryService.createCategory,
  updateProductCategory: productCategoryService.updateCategory,
  deleteProductCategory: productCategoryService.deleteCategory,
  restoreProductCategory: productCategoryService.restoreCategory,
  assertProductCategoryExists: productCategoryService.assertProductCategoryExists,
  getProductCategoryNameMap: productCategoryService.getProductCategoryNameMap,

  listShopCategories: shopCategoryService.listCategories,
  createShopCategory: shopCategoryService.createCategory,
  updateShopCategory: shopCategoryService.updateCategory,
  deleteShopCategory: shopCategoryService.deleteCategory,
  restoreShopCategory: shopCategoryService.restoreCategory,
  uploadShopCategoryIcon: shopCategoryService.uploadCategoryIcon,
  assertShopCategoryExists: shopCategoryService.assertShopCategoryExists,
  getShopCategoryNameMap: shopCategoryService.getShopCategoryNameMap,

  // Legacy aliases
  listCategories: productCategoryService.listCategories,
  createCategory: productCategoryService.createCategory,
  updateCategory: productCategoryService.updateCategory,
  deleteCategory: productCategoryService.deleteCategory,
  assertCategoryExists: shopCategoryService.assertShopCategoryExists,
};
