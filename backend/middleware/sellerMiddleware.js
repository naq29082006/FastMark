const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE } = require("../constants/sellerVerification");

async function requireSeller(req, res, next) {
  const user = await User.findById(req.currentUser?._id);

  if (!user || user.Role !== USER_ROLE.SELLER) {
    return res.status(403).json({
      success: false,
      message: "Chỉ người bán đã được admin duyệt mới có thể đăng sản phẩm.",
    });
  }

  const shop = await ShopProfile.findOne({ userId: user._id });
  if (!shop) {
    return res.status(403).json({
      success: false,
      message: "Chưa có gian hàng. Vui lòng chờ admin duyệt hồ sơ người bán.",
    });
  }

  req.currentUser = user;
  req.sellerShop = shop;
  return next();
}

module.exports = requireSeller;
