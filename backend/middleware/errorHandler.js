function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Payload quá lớn (ảnh đính kèm). Vui lòng chọn ít ảnh hơn hoặc ảnh nhỏ hơn.',
    });
  }

  if (error?.name === 'MulterError' || error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể xử lý file upload.',
    });
  }

  if (error?.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Mã gian hàng hoặc cuộc trò chuyện không hợp lệ.',
    });
  }

  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'dữ liệu';
    const duplicateValue = error.keyValue?.[field];

    if (field === 'externalId' && (duplicateValue == null || duplicateValue === '')) {
      return res.status(409).json({
        success: false,
        message:
          'Lỗi index cũ trên collection products (externalId). Khởi động lại backend để tự dọn index, hoặc chạy: node scripts/migrateProductIndexes.js',
      });
    }

    if (field === 'Phone' || field === 'phone') {
      return res.status(409).json({
        success: false,
        message: 'Số điện thoại đã được sử dụng bởi tài khoản khác.',
      });
    }

    if (field === 'shopId') {
      return res.status(409).json({
        success: false,
        message: 'shopId đã tồn tại trong hệ thống.',
      });
    }

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
    ...(error.code ? { code: error.code } : {}),
    ...(error.field ? { field: error.field } : {}),
    ...(error.data !== undefined && error.data !== null ? { data: error.data } : {}),
    ...(error.data?.remainingSeconds != null
      ? { remainingSeconds: error.data.remainingSeconds }
      : error.retryAfterSeconds != null
        ? { remainingSeconds: error.retryAfterSeconds }
        : {}),
  });
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
