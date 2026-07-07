const firebaseErrorMessages = {
  'auth/email-already-in-use': 'Email này đã được sử dụng.',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/missing-password': 'Vui lòng nhập mật khẩu.',
  'auth/network-request-failed':
    'Không kết nối được Firebase trên máy bạn. Kiểm tra Internet (4G/WiFi), tắt VPN, đổi mạng. Lỗi này không liên quan tới Metro server.',
  'auth/requires-recent-login': 'Phiên đăng nhập đã cũ. Hãy đăng nhập lại.',
  'auth/too-many-requests': 'Bạn thao tác quá nhanh. Thử lại sau ít phút.',
  'auth/user-not-found': 'Không tìm thấy tài khoản.',
  'auth/weak-password': 'Mật khẩu cần tối thiểu 6 ký tự.',
  'auth/wrong-password': 'Mật khẩu hiện tại không đúng.',
};

export function toReadableAuthError(error) {
  if (!error) {
    return 'Đã có lỗi xảy ra.';
  }

  if (firebaseErrorMessages[error.code]) {
    return firebaseErrorMessages[error.code];
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Đã có lỗi xảy ra.';
}
