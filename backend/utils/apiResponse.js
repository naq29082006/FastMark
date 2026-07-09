function success(res, { status = 200, message = "Success", data = null } = {}) {
  const payload = { success: true, message };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(status).json(payload);
}

function fail(res, { status = 500, message = "Đã có lỗi xảy ra." } = {}) {
  return res.status(status).json({
    success: false,
    message,
  });
}

module.exports = {
  success,
  fail,
};
