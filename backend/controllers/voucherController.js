const voucherService = require("../services/voucherService");
const { success, fail } = require("../utils/apiResponse");

exports.listSellerVouchers = async (req, res) => {
  const vouchers = await voucherService.listSellerVouchers(req.currentUser);
  return success(res, { data: { vouchers } });
};

exports.createSellerVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.createSellerVoucher(req.currentUser, req.body);
    return success(res, { message: "Đã tạo voucher.", data: { voucher } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.updateSellerVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.updateSellerVoucher(
      req.currentUser,
      req.params.id,
      req.body
    );
    return success(res, { message: "Đã cập nhật voucher.", data: { voucher } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.deleteSellerVoucher = async (req, res) => {
  try {
    await voucherService.deleteSellerVoucher(req.currentUser, req.params.id);
    return success(res, { message: "Đã xóa voucher." });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.listShopVouchers = async (req, res) => {
  const shopId = req.query.shopId || req.query.shop_id;
  const vouchers = await voucherService.listShopActiveVouchers(shopId);
  return success(res, { data: { vouchers } });
};

exports.listNearbyVouchers = async (req, res) => {
  const vouchers = await voucherService.listNearbyActiveVouchers({
    limit: req.query.limit,
  });
  return success(res, { data: { vouchers } });
};
