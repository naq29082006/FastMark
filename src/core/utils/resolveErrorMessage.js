export function resolveErrorMessage(error, fallback = 'Đã có lỗi xảy ra.') {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  const message = error?.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return fallback;
}
