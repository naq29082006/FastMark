import { getCurrentFirebaseUser, getCurrentUserIdToken } from '../repository/authRepository';

function isAuthExpirationError(error) {
  if (Number(error?.statusCode) !== 401) {
    return false;
  }

  const message = String(error?.message || '');
  return /hết hạn|thu hồi|đăng nhập|token|bearer/i.test(message);
}

export async function callWithAuthToken(apiCall) {
  const user = getCurrentFirebaseUser();
  if (!user) {
    const error = new Error('Bạn cần đăng nhập lại.');
    error.statusCode = 401;
    throw error;
  }

  // Code cũ forceRefresh=true mọi lần → luôn gọi Google, dễ treo khi mạng kém.
  // Lấy token cache trước; chỉ force khi server trả 401.
  let idToken = await getCurrentUserIdToken(false);
  if (!idToken) {
    idToken = await getCurrentUserIdToken(true);
  }
  if (!idToken) {
    const error = new Error('Bạn cần đăng nhập lại.');
    error.statusCode = 401;
    throw error;
  }

  try {
    return await apiCall(idToken);
  } catch (error) {
    if (!isAuthExpirationError(error)) {
      throw error;
    }

    idToken = await getCurrentUserIdToken(true);
    if (!idToken) {
      throw error;
    }

    return await apiCall(idToken);
  }
}
