import Constants, { ExecutionEnvironment } from 'expo-constants';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';

import { googleOAuthConfig } from '../../core/config/env';

export function isExpoGoClient() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function getGoogleBrowserRedirectUri() {
  return makeRedirectUri({
    scheme: 'fastmark',
    path: 'oauthredirect',
  });
}

export function getGoogleBrowserAuthRequestConfig() {
  const { webClientId } = googleOAuthConfig;

  return {
    webClientId,
    clientId: webClientId,
    redirectUri: getGoogleBrowserRedirectUri(),
    responseType: ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  };
}

export function getGoogleAuthSetupError() {
  if (isExpoGoClient()) {
    return 'Google Sign-In không chạy trên Expo Go. Chạy: npx expo run:android';
  }

  const { webClientId } = googleOAuthConfig;

  if (!webClientId) {
    return 'Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong .env (lấy từ Firebase → Authentication → Google).';
  }

  return null;
}

export function describeGoogleOAuthError(response) {
  if (!response || response.type !== 'error') {
    return null;
  }

  const code = response.error?.code || response.params?.error;
  const description = response.error?.message || response.params?.error_description || '';
  const redirectUri = getGoogleBrowserRedirectUri();

  if (code === 'redirect_uri_mismatch' || description.includes('redirect_uri')) {
    return (
      `Redirect URI chưa khớp. Thêm vào Google Cloud Console (OAuth Web client → Authorized redirect URIs): ${redirectUri}`
    );
  }

  if (
    code === 'invalid_request' ||
    description.includes('invalid_request') ||
    description.includes('400')
  ) {
    if (isExpoGoClient()) {
      return (
        'Expo Go không hỗ trợ Google Sign-In (redirect exp://). Chạy bản native: npx expo run:android'
      );
    }

    return (
      `Google từ chối OAuth (400). Thêm redirect URI vào Web client trên Google Cloud: ${redirectUri} — rồi chạy lại npx expo run:android.`
    );
  }

  return description || 'Đăng nhập Google thất bại.';
}

export function describeNativeGoogleError(error) {
  if (!error) {
    return null;
  }

  const message = error.message || '';

  if (message.includes('DEVELOPER_ERROR') || error.code === '10') {
    return (
      'Cấu hình Google chưa khớp. Thêm SHA-1 vào Firebase, tải lại google-services.json, rồi rebuild: npx expo run:android.'
    );
  }

  if (
    message.includes('RNGoogleSignin') ||
    message.includes('Native module') ||
    message.includes('TurboModule')
  ) {
    return 'App chưa rebuild native. Google Sign-In cần chạy: npx expo run:android (không dùng Expo Go).';
  }

  if (message.includes('NETWORK_ERROR')) {
    return 'Không có kết nối mạng. Kiểm tra Internet rồi thử lại.';
  }

  return message || 'Đăng nhập Google thất bại.';
}
