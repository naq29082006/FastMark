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

module.exports = router;
