const bannerService = require("../services/bannerService");
const { success, fail } = require("../utils/apiResponse");

exports.listActive = async (req, res) => {
  const banners = await bannerService.listActiveBanners({ limit: req.query.limit });
  return success(res, { data: { banners } });
};

exports.listAdmin = async (req, res) => {
  const banners = await bannerService.listAdminBanners();
  return success(res, { data: { banners } });
};

exports.create = async (req, res) => {
  try {
    const banner = await bannerService.createBanner(req.body);
    return success(res, { message: "Đã tạo banner.", data: { banner } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const banner = await bannerService.updateBanner(req.params.id, req.body);
    return success(res, { message: "Đã cập nhật banner.", data: { banner } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await bannerService.deleteBanner(req.params.id);
    return success(res, { message: "Đã xóa banner." });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};
