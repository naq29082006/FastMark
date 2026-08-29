/**
 * Tên trường MongoDB rút gọn (tiếng Việt, ≤ ~13 ký tự).
 * Dùng chung backend / migrate / compat.
 */
const MF = {
  // Product (PascalCase)
  LyDoGo: "LyDoGo",
  NgayKmBD: "NgayKmBD",
  NgayKmKT: "NgayKmKT",
  PtGiam: "PtGiam",

  // Review / Product removal (camelCase)
  lyDoGo: "lyDoGo",

  // Reservation
  tgShopXN: "tgShopXN",
  tgNhanHang: "tgNhanHang",
  anhHuyShop: "anhHuyShop",
  tgGiaiCoc: "tgGiaiCoc",
  cocChuyenDen: "cocChuyenDen",
  soNgayKN: "soNgayKN",
  hanGiaiCoc: "hanGiaiCoc",

  // ShopProfile
  soNguoiTheo: "soNguoiTheo",
  diemTB: "diemTB",
  tongDG: "tongDG",
  tongSP: "tongSP",

  // User
  SoTheoDoi: "SoTheoDoi",
  HoatDongCuoi: "HoatDongCuoi",

  // Notification
  tbAdmin: "tbAdmin",

  // Wallet refs
  gdViId: "gdViId",
  gdHoanId: "gdHoanId",

  // SellerBannerPlan
  lyDoVP: "lyDoVP",

  // ReservationDispute (reservationId giữ nguyên — ref API quen thuộc)
  maLyDoBuyer: "maLyDoBuyer",
  tgKnBuyer: "tgKnBuyer",
  maLyDoShop: "maLyDoShop",
  tgKnShop: "tgKnShop",

  // ReservationAdjustment
  giaCu: "giaCu",
  giaMoi: "giaMoi",
  cocCu: "cocCu",
  cocMoi: "cocMoi",

  // Report
  phienKhoa: "phienKhoa",
  qdAdmin: "qdAdmin",
  xuLyBoi: "xuLyBoi",
  tgXuLy: "tgXuLy",

  // SellerVerification
  anhCccdTruoc: "anhCccdTruoc",
  anhCccdSau: "anhCccdSau",
  anhKD: "anhKD",
};

/** oldName → newName (dài trước khi replace). */
const FIELD_RENAME_MAP = [
  ["escrowProtectionDays", MF.soNgayKN],
  ["walletTransactionId", MF.gdViId],
  ["refundTransactionId", MF.gdHoanId],
  ["sellerCancelImages", MF.anhHuyShop],
  ["AdminRemovalReason", MF.LyDoGo],
  ["adminRemovalReason", MF.lyDoGo],
  ["PromotionStartDate", MF.NgayKmBD],
  ["PromotionEndDate", MF.NgayKmKT],
  ["DiscountPercent", MF.PtGiam],
  ["sellerConfirmedAt", MF.tgShopXN],
  ["pickupConfirmedAt", MF.tgNhanHang],
  ["sellerComplaintAt", MF.tgKnShop],
  ["buyerComplaintAt", MF.tgKnBuyer],
  ["oldReservedPrice", MF.giaCu],
  ["newReservedPrice", MF.giaMoi],
  ["oldDepositAmount", MF.cocCu],
  ["newDepositAmount", MF.cocMoi],
  ["depositSettledAt", MF.tgGiaiCoc],
  ["isAdminBroadcast", MF.tbAdmin],
  ["depositSettleTo", MF.cocChuyenDen],
  ["escrowReleaseAt", MF.hanGiaiCoc],
  ["violationReason", MF.lyDoVP],
  ["followersCount", MF.soNguoiTheo],
  ["averageRating", MF.diemTB],
  ["FollowingCount", MF.SoTheoDoi],
  ["LanHoatDongCuoi", MF.HoatDongCuoi],
  ["buyerReasonType", MF.maLyDoBuyer],
  ["sellerReasonType", MF.maLyDoShop],
  ["totalProducts", MF.tongSP],
  ["totalReviews", MF.tongDG],
  ["lockSessionAt", MF.phienKhoa],
  ["adminDecision", MF.qdAdmin],
  ["processedBy", MF.xuLyBoi],
  ["processedAt", MF.tgXuLy],
  ["cccdFrontImage", MF.anhCccdTruoc],
  ["cccdBackImage", MF.anhCccdSau],
  ["businessImage", MF.anhKD],
];

module.exports = {
  MF,
  FIELD_RENAME_MAP,
};
