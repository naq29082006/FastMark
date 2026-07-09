function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 5MB.',
    });
  }

  if (error?.name === 'MulterError' || error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể xử lý file upload.',
    });
  }

  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'dữ liệu';

    return res.status(409).json({
      success: false,
      message: `${field} đã tồn tại trong hệ thống.`,
    });
  }

  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Đã có lỗi xảy ra.';

  if (statusCode >= 500) {
    console.error('[API ERROR]', error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: message,
  });
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
