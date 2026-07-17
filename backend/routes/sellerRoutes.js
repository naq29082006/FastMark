const express = require("express");

const sellerController = require("../controllers/sellerController");
const sellerOpsController = require("../controllers/sellerOpsController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireSeller = require("../middleware/sellerMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post(
  "/phone-code/request",
  verifyFirebaseToken,
  asyncHandler(sellerController.requestPhoneCode)
);
router.post(
  "/phone-code/confirm",
  verifyFirebaseToken,
  asyncHandler(sellerController.confirmPhoneCode)
);
router.get(
  "/verification/me",
  verifyFirebaseToken,
  asyncHandler(sellerController.getMyVerification)
);
router.post(
  "/verification",
  verifyFirebaseToken,
  asyncHandler(sellerController.submitVerification)
);

router.get(
  "/verification/pending",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(sellerController.listPendingVerifications)
);
router.post(
  "/verification/:id/approve",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(sellerController.approveVerification)
);
router.post(
  "/verification/:id/reject",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(sellerController.rejectVerification)
);

router.get("/shop", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.getShopSettings));
router.put("/shop", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.updateShopSettings));
router.post(
  "/shop/username-availability",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.checkShopUsernameAvailability)
);
router.post(
  "/shop/avatar",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.uploadShopAvatar)
);

router.get("/orders", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.listOrders));
router.get(
  "/reservations/:id",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.getReservationDetail)
);
router.post(
  "/reservations/:id/confirm",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.confirmReservation)
);
router.post(
  "/reservations/:id/reject",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.rejectReservation)
);
router.post(
  "/reservations/:id/cancel",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.cancelReservation)
);
router.post(
  "/reservations/:id/complete",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.completeReservation)
);

router.get("/deals", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.listDeals));
router.post(
  "/deals/:id/accept",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.acceptDeal)
);
router.post(
  "/deals/:id/reject",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.rejectDeal)
);
router.post(
  "/deals/:id/counter",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.counterDeal)
);

router.get(
  "/conversations",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.listConversations)
);
router.get(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.listMessages)
);
router.post(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.sendMessage)
);
router.delete(
  "/conversations/:id/messages/:messageId",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.deleteMessage)
);
router.get(
  "/conversations/:id/peer",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.getConversationPeer)
);

router.get("/stats", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.getStats));

module.exports = router;
