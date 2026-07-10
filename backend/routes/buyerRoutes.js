const express = require("express");
const buyerController = require("../controllers/buyerController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get(
  "/conversations",
  verifyFirebaseToken,
  asyncHandler(buyerController.listConversations)
);
router.get("/shops", verifyFirebaseToken, asyncHandler(buyerController.listShops));
router.post(
  "/conversations",
  verifyFirebaseToken,
  asyncHandler(buyerController.startConversation)
);
router.get(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  asyncHandler(buyerController.listMessages)
);
router.post(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  asyncHandler(buyerController.sendMessage)
);
router.delete(
  "/conversations/:id/messages/:messageId",
  verifyFirebaseToken,
  asyncHandler(buyerController.deleteMessage)
);
router.get(
  "/conversations/:id/peer",
  verifyFirebaseToken,
  asyncHandler(buyerController.getConversationPeer)
);
router.get("/reviews", verifyFirebaseToken, asyncHandler(buyerController.listReviews));
router.post("/reviews", verifyFirebaseToken, asyncHandler(buyerController.createReview));
router.put("/reviews/:id", verifyFirebaseToken, asyncHandler(buyerController.updateReview));
router.delete("/reviews/:id", verifyFirebaseToken, asyncHandler(buyerController.deleteReview));

module.exports = router;
