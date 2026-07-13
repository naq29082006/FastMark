import { Alert, Linking } from 'react-native';

export async function callStore(phone) {
  if (!phone) {
    Alert.alert('Không có số điện thoại', 'Gian hàng chưa cập nhật số liên hệ.');
    return;
  }

  const normalized = String(phone).replace(/[^\d+]/g, '');
  if (!normalized) {
    Alert.alert('Không có số điện thoại', 'Số điện thoại không hợp lệ.');
    return;
  }

  const url = `tel:${normalized}`;

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Lỗi', 'Không thể mở ứng dụng gọi điện.');
  }
}

export async function contactZalo(zalo) {
  if (!zalo) {
    Alert.alert('Không có Zalo', 'Gian hàng chưa cập nhật tài khoản Zalo.');
    return;
  }

  const normalized = String(zalo).replace(/\D/g, '');
  const url = `https://zalo.me/${normalized}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Không thể mở Zalo', 'Vui lòng cài đặt Zalo hoặc thử lại sau.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Lỗi', 'Không thể mở Zalo.');
  }
}
