const express = require("express");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const adminAccountController = require("../controllers/adminAccountController");
const adminReportController = require("../controllers/adminReportController");
const adminReviewController = require("../controllers/adminReviewController");
const adminNotificationController = require("../controllers/adminNotificationController");
const adminDashboardController = require("../controllers/adminDashboardController");
const adminCatalogController = require("../controllers/adminCatalogController");

const router = express.Router();

router.get(
  "/dashboard",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminDashboardController.getDashboard)
);

router.get(
  "/accounts",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.listAccounts)
);
router.get(
  "/accounts/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.getAccountDetail)
);
router.post(
  "/accounts/:id/block",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.blockAccount)
);
router.post(
  "/accounts/:id/unblock",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.unblockAccount)
);

router.get("/shops", verifyFirebaseToken, requireAdmin, asyncHandler(adminCatalogController.listShops));
router.get(
  "/shops/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.getShopDetail)
);
router.post(
  "/shops/:id/block",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.blockShop)
);
router.post(
  "/shops/:id/unblock",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.unblockShop)
);
router.delete(
  "/shops/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.deleteShop)
);

router.get(
  "/products",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.listProducts)
);
router.get(
  "/products/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.getProductDetail)
);
router.post(
  "/products/:id/hide",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.hideProduct)
);
router.post(
  "/products/:id/show",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.showProduct)
);
router.delete(
  "/products/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.deleteProduct)
);

router.get(
  "/reservations",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.listReservations)
);
router.get(
  "/reservations/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.getReservationDetail)
);
router.post(
  "/reservations/:id/cancel",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminCatalogController.cancelReservation)
);

router.get(
  "/reports",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReportController.listReports)
);
router.get(
  "/reports/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReportController.getReportDetail)
);
router.post(
  "/reports/:id/dismiss",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReportController.dismissReport)
);
router.post(
  "/reports/:id/approve",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReportController.approveReport)
);

router.get(
  "/reviews",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReviewController.listReviews)
);
router.post(
  "/reviews/:id/hide",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReviewController.hideReview)
);
router.post(
  "/reviews/:id/show",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReviewController.showReview)
);
router.delete(
  "/reviews/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminReviewController.deleteReview)
);

router.post(
  "/notifications/broadcast",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminNotificationController.sendSystemNotification)
);

const bannerController = require("../controllers/bannerController");
router.get("/banners", verifyFirebaseToken, requireAdmin, asyncHandler(bannerController.listAdmin));
router.post("/banners", verifyFirebaseToken, requireAdmin, asyncHandler(bannerController.create));
router.put("/banners/:id", verifyFirebaseToken, requireAdmin, asyncHandler(bannerController.update));
router.delete("/banners/:id", verifyFirebaseToken, requireAdmin, asyncHandler(bannerController.remove));

module.exports = router;
