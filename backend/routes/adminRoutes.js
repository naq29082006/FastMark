const express = require("express");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const adminAccountController = require("../controllers/adminAccountController");
const adminReportController = require("../controllers/adminReportController");
const adminReviewController = require("../controllers/adminReviewController");
const adminNotificationController = require("../controllers/adminNotificationController");

const router = express.Router();

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

module.exports = router;
