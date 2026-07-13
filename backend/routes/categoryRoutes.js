const express = require("express");

const categoryController = require("../controllers/categoryController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const { singleImage } = require("../config/commom/upload");

const router = express.Router();

router.get(
  "/products",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.listProductCategories)
);
router.post(
  "/products",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.createProductCategory)
);
router.put(
  "/products/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.updateProductCategory)
);
router.delete(
  "/products/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.deleteProductCategory)
);
router.post(
  "/products/:id/icon",
  verifyFirebaseToken,
  requireAdmin,
  singleImage("icon"),
  asyncHandler(categoryController.uploadProductCategoryIcon)
);

router.get(
  "/shops",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.listShopCategories)
);
router.post(
  "/shops",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.createShopCategory)
);
router.put(
  "/shops/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.updateShopCategory)
);
router.delete(
  "/shops/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.deleteShopCategory)
);
router.post(
  "/shops/:id/icon",
  verifyFirebaseToken,
  requireAdmin,
  singleImage("icon"),
  asyncHandler(categoryController.uploadShopCategoryIcon)
);

// Legacy routes -> product categories
router.get("/", verifyFirebaseToken, requireAdmin, asyncHandler(categoryController.listCategories));
router.post("/", verifyFirebaseToken, requireAdmin, asyncHandler(categoryController.createCategory));
router.put("/:id", verifyFirebaseToken, requireAdmin, asyncHandler(categoryController.updateCategory));
router.delete("/:id", verifyFirebaseToken, requireAdmin, asyncHandler(categoryController.deleteCategory));

module.exports = router;
