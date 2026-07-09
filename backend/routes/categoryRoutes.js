const express = require("express");

const categoryController = require("../controllers/categoryController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get(
  "/",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.listCategories)
);

router.post(
  "/",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.createCategory)
);

router.put(
  "/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.updateCategory)
);

router.delete(
  "/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(categoryController.deleteCategory)
);

module.exports = router;
