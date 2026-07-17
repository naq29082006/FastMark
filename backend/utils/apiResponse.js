function success(res, { status = 200, message = "Success", data = null } = {}) {
  const payload = { success: true, message };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(status).json(payload);
}

function fail(res, { status = 500, message = "Đã có lỗi xảy ra.", code = "", field = "", data = null } = {}) {
  const payload = {
    success: false,
    message,
  };
  if (code) {
    payload.code = code;
  }
  if (field) {
    payload.field = field;
  }
  if (data !== null && data !== undefined) {
    payload.data = data;
  }
  return res.status(status).json(payload);
}

module.exports = {
  success,
  fail,
};
