const adminReportService = require("../services/adminReportService");
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

exports.listReports = async (req, res) => {
  const data = await adminReportService.listReports({
    search: pickQueryValue(req.query, ["search", "q"]),
    reportType: pickQueryValue(req.query, ["reportType", "type"]),
    status: pickQueryValue(req.query, ["status"]),
    page: req.query.page,
    limit: req.query.limit,
  });

  return success(res, { data });
};

exports.getReportDetail = async (req, res) => {
  const report = await adminReportService.getReportDetail(req.params.id);
  return success(res, { data: { report } });
};

exports.dismissReport = async (req, res) => {
  const report = await adminReportService.dismissReport(req.currentUser, req.params.id);
  return success(res, {
    message: "Đã bác bỏ báo cáo vi phạm.",
    data: { report },
  });
};

exports.approveReport = async (req, res) => {
  const action = pickQueryValue(req.body, ["action"]) || "hide";
  const report = await adminReportService.approveReport(req.currentUser, req.params.id, {
    action,
  });

  return success(res, {
    message: adminReportService.getApproveMessage(report.reportType, action),
    data: { report },
  });
};
