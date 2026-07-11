const { listNotificationsForUser } = require("../services/notificationService");
const { success } = require("../utils/apiResponse");

exports.listMyNotifications = async (req, res) => {
  const data = await listNotificationsForUser(req.currentUser._id, {
    page: req.query.page,
    limit: req.query.limit,
  });

  return success(res, { data });
};
