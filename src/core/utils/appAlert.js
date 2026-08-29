import { Alert } from 'react-native';

const OK = [{ text: 'OK' }];

export function showErrorAlert(message, title = 'Lỗi', options = {}) {
  const { accountLockedOrderMode = false } = options;
  if (accountLockedOrderMode && isAccountLockBlockedApiMessage(message)) {
    return;
  }
  Alert.alert(title, message || 'Đã xảy ra lỗi.', OK);
}

export function isAccountLockBlockedApiMessage(message) {
  return /tài khoản.*khóa|liên hệ quản trị/i.test(String(message || ''));
}

export function isAdminAccountMessage(message) {
  return /admin/i.test(String(message || ''));
}

export function showAdminAccountAlert() {
  Alert.alert('Thông báo', 'Tài khoản này là admin', OK);
}

export function resolveAuthAlertMessage(message) {
  if (message == null) {
    return '';
  }
  if (typeof message === 'string') {
    return message.trim();
  }
  if (typeof message === 'object') {
    return String(message.message || message.error || '').trim();
  }
  return String(message).trim();
}

export function confirmLogout(onConfirm) {
  Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi FastMark?', [
    { text: 'Không', style: 'cancel' },
    { text: 'Đăng xuất', style: 'destructive', onPress: onConfirm },
  ]);
}
