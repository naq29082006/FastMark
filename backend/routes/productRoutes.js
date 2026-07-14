const express = require("express");
const productController = require("../controllers/productController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireSeller = require("../middleware/sellerMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/categories", asyncHandler(productController.listCategories));
router.get("/discover", asyncHandler(productController.discoverProducts));

router.get(
  "/mine/:id",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.getMyProduct)
);

router.get(
  "/",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.listMyProducts)
);

router.post(
  "/",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.createProduct)
);

router.put(
  "/:id",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.updateProduct)
);

router.delete(
  "/:id",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.softDeleteProduct)
);

router.get("/:id", asyncHandler(productController.getProduct));

module.exports = router;
