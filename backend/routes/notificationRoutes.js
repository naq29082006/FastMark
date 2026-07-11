const express = require("express");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.get(
  "/",
  verifyFirebaseToken,
  asyncHandler(notificationController.listMyNotifications)
);

module.exports = router;
