const sellerSubscriptionService = require("../services/sellerSubscriptionService");
const { success, fail } = require("../utils/apiResponse");

exports.getSubscription = async (req, res) => {
  try {
    const data = await sellerSubscriptionService.getSubscription(req.currentUser);
    return success(res, { data });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.purchaseSubscription = async (req, res) => {
  try {
    const data = await sellerSubscriptionService.purchaseSubscription(req.currentUser, req.body);
    return success(res, {
      message: "Đã đăng ký gói người bán.",
      data,
    });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};
