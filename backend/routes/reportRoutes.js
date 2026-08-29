const express = require("express");
const {
  verifyFirebaseToken,
  verifyFirebaseTokenAllowBlocked,
} = require("../middleware/authMiddleware");
const requireSeller = require("../middleware/sellerMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const reservationReportController = require("../controllers/reservationReportController");

/** Nick/shop bị khóa vẫn xử lý tranh chấp đơn giữ hàng. */
const verifyDisputeReportsAuth = verifyFirebaseTokenAllowBlocked;

const router = express.Router();

/**
 * Báo cáo tranh chấp giữ hàng (GPS + ảnh + mô tả).
 * Buyer: SELLER_NO_SHOW | Seller: BUYER_NO_SHOW
 */
router.post(
  "/buyer-report-seller",
  verifyDisputeReportsAuth,
  asyncHandler(reservationReportController.buyerReportSeller)
);

router.post(
  "/seller-report-buyer",
  verifyDisputeReportsAuth,
  requireSeller,
  asyncHandler(reservationReportController.sellerReportBuyer)
);

router.get(
  "/reservation/:reservationId",
  verifyDisputeReportsAuth,
  asyncHandler(reservationReportController.listReservationReports)
);

module.exports = router;
