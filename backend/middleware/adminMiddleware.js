const { USER_ROLE } = require("../constants/sellerVerification");

function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.Role !== USER_ROLE.ADMIN) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện thao tác này.",
    });
  }

  return next();
}

module.exports = requireAdmin;
