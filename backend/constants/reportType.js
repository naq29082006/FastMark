const REPORT_TYPE = {
  REVIEW: 1,
  USER: 2,
  SHOP: 3,
  PRODUCT: 4,
};

const REPORT_TYPE_LABELS = {
  [REPORT_TYPE.REVIEW]: "Đánh giá",
  [REPORT_TYPE.USER]: "Người dùng",
  [REPORT_TYPE.SHOP]: "Gian hàng",
  [REPORT_TYPE.PRODUCT]: "Sản phẩm",
};

module.exports = {
  REPORT_TYPE,
  REPORT_TYPE_LABELS,
};
