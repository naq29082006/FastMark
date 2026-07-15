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
router.post("/reports", verifyFirebaseToken, asyncHandler(buyerController.createReport));

const buyerOpsController = require("../controllers/buyerOpsController");

router.get("/favorites", verifyFirebaseToken, asyncHandler(buyerController.listFavorites));
router.get("/favorites/ids", verifyFirebaseToken, asyncHandler(buyerController.listFavoriteIds));
router.post("/favorites", verifyFirebaseToken, asyncHandler(buyerController.addFavorite));
router.delete(
  "/favorites/:productId",
  verifyFirebaseToken,
  asyncHandler(buyerController.removeFavorite)
);

router.get(
  "/favorite-shops",
  verifyFirebaseToken,
  asyncHandler(buyerController.listFavoriteShops)
);
router.get(
  "/favorite-shops/ids",
  verifyFirebaseToken,
  asyncHandler(buyerController.listFavoriteShopIds)
);
router.get(
  "/favorite-shops/status",
  verifyFirebaseToken,
  asyncHandler(buyerController.getFavoriteShopStatus)
);
router.post(
  "/favorite-shops",
  verifyFirebaseToken,
  asyncHandler(buyerController.addFavoriteShop)
);
router.delete(
  "/favorite-shops/:shopId",
  verifyFirebaseToken,
  asyncHandler(buyerController.removeFavoriteShop)
);

router.get("/follows/status", verifyFirebaseToken, asyncHandler(buyerController.getFollowStatus));
router.get("/follows/following", verifyFirebaseToken, asyncHandler(buyerController.listFollowing));
router.get("/follows/followers", verifyFirebaseToken, asyncHandler(buyerController.listFollowers));
router.post("/follows", verifyFirebaseToken, asyncHandler(buyerController.followUser));
router.delete(
  "/follows/:targetId",
  verifyFirebaseToken,
  asyncHandler(buyerController.unfollowUser)
);
router.delete("/follows", verifyFirebaseToken, asyncHandler(buyerController.unfollowUser));

router.get("/orders", verifyFirebaseToken, asyncHandler(buyerOpsController.listOrders));
router.post("/deals", verifyFirebaseToken, asyncHandler(buyerOpsController.createDeal));
router.get("/deals", verifyFirebaseToken, asyncHandler(buyerOpsController.listDeals));
router.get("/deals/:id", verifyFirebaseToken, asyncHandler(buyerOpsController.getDeal));
router.post("/deals/:id/resubmit", verifyFirebaseToken, asyncHandler(buyerOpsController.resubmitDeal));
router.post("/deals/:id/counter", verifyFirebaseToken, asyncHandler(buyerOpsController.counterDeal));
router.post(
  "/deals/:id/accept-counter",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.acceptCounter)
);
router.post("/reservations", verifyFirebaseToken, asyncHandler(buyerOpsController.createReservation));
router.get(
  "/reservations/:id",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.getReservation)
);
router.post(
  "/reservations/:id/cancel",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.cancelReservation)
);
router.post(
  "/reservations/:id/complete",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.completeReservation)
);

module.exports = router;
