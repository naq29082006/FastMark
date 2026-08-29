const sellerBannerService = require("../services/sellerBannerService");
const { success, fail } = require("../utils/apiResponse");

exports.listAdminPlans = async (req, res) => {
  const plans = await sellerBannerService.listAdminBannerPlans();
  return success(res, { data: { plans } });
};

exports.createPlan = async (req, res) => {
  try {
    const { plan, restored } = await sellerBannerService.createBannerPlan(req.body);
    return success(res, {
      message: restored ? "Đã khôi phục gói banner." : "Đã tạo gói banner.",
      data: { plan, restored: Boolean(restored) },
    });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await sellerBannerService.updateBannerPlan(req.params.id, req.body);
    return success(res, { message: "Đã cập nhật gói banner.", data: { plan } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.removePlan = async (req, res) => {
  try {
    const plan = await sellerBannerService.deleteBannerPlan(req.params.id);
    return success(res, { message: "Đã ngừng bán gói banner.", data: { plan } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.restorePlan = async (req, res) => {
  try {
    const plan = await sellerBannerService.restoreBannerPlan(req.params.id);
    return success(res, { message: "Đã khôi phục gói banner.", data: { plan } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.listSellerBanners = async (req, res) => {
  const data = await sellerBannerService.listAdminSellerBanners({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    filter: req.query.filter || req.query.lifecycle,
    search: req.query.search || req.query.q,
    from: req.query.from || req.query.dateFrom,
    to: req.query.to || req.query.dateTo,
  });
  return success(res, { data });
};

exports.approveSellerBanner = async (req, res) => {
  try {
    const banner = await sellerBannerService.approveSellerBanner(req.params.id);
    return success(res, { message: "Đã duyệt treo banner.", data: { banner } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.rejectSellerBanner = async (req, res) => {
  try {
    const banner = await sellerBannerService.rejectSellerBanner(req.params.id, {
      reason: req.body?.reason || req.body?.lyDoVP,
    });
    return success(res, {
      message: "Đã từ chối treo banner. Seller có thể sửa và gửi lại.",
      data: { banner },
    });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.cancelSellerBanner = async (req, res) => {
  try {
    const banner = await sellerBannerService.cancelSellerBanner(req.params.id);
    return success(res, { message: "Đã hủy banner.", data: { banner } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.getMyBanner = async (req, res) => {
  try {
    const data = await sellerBannerService.getSellerBannerState(req.currentUser);
    return success(res, { data });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.purchaseBanner = async (req, res) => {
  try {
    const data = await sellerBannerService.purchaseBannerPlan(req.currentUser, req.body);
    return success(res, { message: "Đã mua gói banner.", data });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.updateCreative = async (req, res) => {
  try {
    const banner = await sellerBannerService.requestBannerHang(req.currentUser, {
      ...req.body,
      bannerId: req.body?.bannerId || req.body?.id,
    });
    return success(res, {
      message: "Đã gửi yêu cầu treo banner. Chờ admin duyệt.",
      data: { banner },
    });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};
