const adminDashboardService = require("../services/adminDashboardService");
const { success } = require("../utils/apiResponse");

exports.getDashboard = async (req, res) => {
  const dashboard = await adminDashboardService.getAdminDashboard(req.query);
  return success(res, { data: { dashboard } });
};
