const adminReviewService = require("../services/adminReviewService");
const { success } = require("../utils/apiResponse");

function pickQueryValue(query, keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickDateRangeQuery(query) {
  return {
    from: pickQueryValue(query, ["from", "dateFrom"]),
    to: pickQueryValue(query, ["to", "dateTo"]),
  };
}

exports.listReviews = async (req, res) => {
  const data = await adminReviewService.listReviews({
    search: pickQueryValue(req.query, ["search", "q"]),
    rating: pickQueryValue(req.query, ["rating", "stars"]),
    status: pickQueryValue(req.query, ["status"]),
    removedBy: pickQueryValue(req.query, ["removedBy", "removed_by"]),
    productId: pickQueryValue(req.query, ["productId"]),
    page: req.query.page,
    limit: req.query.limit,
    ...pickDateRangeQuery(req.query),
  });

  return success(res, { data });
};

exports.getReviewDetail = async (req, res) => {
  const review = await adminReviewService.getReviewDetail(req.params.id);
  return success(res, { data: { review } });
};

exports.hideReview = async (req, res) => {
  const review = await adminReviewService.setReviewVisibility(req.params.id, true, {
    reason: req.body?.reason,
  });
  return success(res, {
    message: "Đã ẩn đánh giá.",
    data: { review },
  });
};

exports.showReview = async (req, res) => {
  const review = await adminReviewService.setReviewVisibility(req.params.id, false);
  return success(res, {
    message: "Đã hiện lại đánh giá.",
    data: { review },
  });
};

exports.deleteReview = async (req, res) => {
  const result = await adminReviewService.softDeleteReview(req.params.id, {
    reason: req.body?.reason,
  });
  return success(res, {
    message: "Đã xóa mềm đánh giá.",
    data: result,
  });
};
