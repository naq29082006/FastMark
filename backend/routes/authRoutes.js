const express = require("express");
const authController = require("../controllers/authController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const { singleImage } = require("../config/commom/upload");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/register/email", asyncHandler(authController.registerEmail));
router.post("/login/email", asyncHandler(authController.loginEmail));
router.post("/google", asyncHandler(authController.registerOrLoginGoogle));
router.post("/verify-email/request", verifyFirebaseToken, asyncHandler(authController.requestEmailVerification));
router.post("/verify-email/confirm", verifyFirebaseToken, asyncHandler(authController.confirmEmailVerification));
router.get("/me", verifyFirebaseToken, asyncHandler(authController.getMe));
router.put("/me", verifyFirebaseToken, asyncHandler(authController.updateMe));
function optionalMultipartAvatar(req, res, next) {
  const contentType = String(req.headers["content-type"] || "");

  if (contentType.includes("multipart/form-data")) {
    return singleImage("avatar")(req, res, next);
  }

  return next();
}

router.post(
  "/avatar",
  verifyFirebaseToken,
  optionalMultipartAvatar,
  asyncHandler(authController.uploadAvatar)
);

router.post(
  "/cover",
  verifyFirebaseToken,
  optionalMultipartAvatar,
  asyncHandler(authController.uploadCover)
);

router.post("/presence/online", verifyFirebaseToken, asyncHandler(authController.setPresenceOnline));
router.post("/presence/offline", verifyFirebaseToken, asyncHandler(authController.setPresenceOffline));
router.post(
  "/presence/shop/online",
  verifyFirebaseToken,
  asyncHandler(authController.setShopPresenceOnline)
);
router.post(
  "/presence/shop/offline",
  verifyFirebaseToken,
  asyncHandler(authController.setShopPresenceOffline)
);

module.exports = router;
