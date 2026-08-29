const express = require("express");
const authController = require("../controllers/authController");
const {
  verifyFirebaseToken,
  verifyFirebaseTokenAllowBlocked,
} = require("../middleware/authMiddleware");
const { singleImage } = require("../config/commom/upload");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/register/email", asyncHandler(authController.registerEmail));
router.post("/register/availability", asyncHandler(authController.checkRegisterAvailability));
router.post("/login/email", asyncHandler(authController.loginEmail));
router.post("/google", asyncHandler(authController.registerOrLoginGoogle));
router.post("/forgot-password/request-me", verifyFirebaseToken, asyncHandler(authController.requestPasswordResetForMe));
router.post("/forgot-password/request", asyncHandler(authController.requestPasswordReset));
router.post("/forgot-password/verify", asyncHandler(authController.verifyPasswordResetOtp));
router.post("/forgot-password/reset", asyncHandler(authController.resetPassword));
router.post("/verify-email/request", verifyFirebaseToken, asyncHandler(authController.requestEmailVerification));
router.post("/verify-email/confirm", verifyFirebaseToken, asyncHandler(authController.confirmEmailVerification));
router.get("/me", verifyFirebaseTokenAllowBlocked, asyncHandler(authController.getMe));
router.put("/me", verifyFirebaseToken, asyncHandler(authController.updateMe));
router.get(
  "/lock-appeal",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(authController.getLockAppealStatus)
);
router.post(
  "/lock-appeal",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(authController.createLockAppeal)
);
router.get(
  "/shop-lock-appeal",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(authController.getShopLockAppealStatus)
);
router.post(
  "/shop-lock-appeal",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(authController.createShopLockAppeal)
);

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
