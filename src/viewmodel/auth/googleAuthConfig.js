import { makeRedirectUri, ResponseType } from 'expo-auth-session';

import { googleOAuthConfig } from '../../core/config/env';
import { getWebOAuthClientIdFromGoogleServices } from '../../core/config/googleServicesConfig';
import { validateGoogleOAuthSetup } from '../../core/utils/authDiagnostics';
import {
  hasGoogleSigninNativeBinary,
  isExpoGoRuntime,
  isNativeGoogleSignInAvailable,
} from './googleSignInModule';

export function isExpoGoClient() {
  return isExpoGoRuntime();
}

export function getGoogleBrowserRedirectUri() {
  return makeRedirectUri({
    scheme: 'fastmark',
    path: 'oauthredirect',
  });
}

export function getGoogleNativeWebClientId() {
  return getWebOAuthClientIdFromGoogleServices() || googleOAuthConfig.webClientId || '';
}

export function getGoogleBrowserAuthRequestConfig() {
  const webClientId = getGoogleNativeWebClientId();

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
  if (isExpoGoRuntime()) {
    return 'Bạn đang mở app bằng Expo Go. Hãy mở app FastMark đã cài sau khi chạy npx expo run:android.';
  }

  if (!hasGoogleSigninNativeBinary()) {
    return 'Google Sign-In chưa sẵn sàng trên bản build này. Chạy lại: npx expo run:android';
  }

  if (isNativeGoogleSignInAvailable()) {
    if (!getGoogleNativeWebClientId()) {
      return 'Thiếu Web Client ID Google (client_type 3 trong google-services.json).';
    }

    const oauthIssues = validateGoogleOAuthSetup().filter(
      (issue) =>
        issue.includes('does not match google-services.json') ||
        issue.includes('Client ID in .env does not match google-services.json')
    );

    if (oauthIssues.length > 0) {
      return 'Client ID Google trong .env không khớp google-services.json. Web = client_type 3, Android = client_type 1. Tải lại file từ Firebase rồi cập nhật .env.';
    }

    return null;
  }

  return 'Google Sign-In chưa sẵn sàng trên bản build này. Chạy lại: npx expo run:android';
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
      return 'Expo Go không hỗ trợ Google Sign-In. Mở app FastMark đã build bằng npx expo run:android.';
    }

    return (
      `Google từ chối OAuth (400). Thêm redirect URI vào Web client trên Google Cloud: ${redirectUri}`
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
    const setupHint = getGoogleAuthSetupError();
    if (setupHint) {
      return setupHint;
    }

    return (
      'Cấu hình Google chưa khớp (DEVELOPER_ERROR). Thêm SHA-1 debug vào Firebase → tải lại google-services.json → chạy: npx expo run:android. Xem SHA-1 bằng: npm run android:sha1'
    );
  }

  if (
    error.code === '12500' ||
    String(error.code) === '12500' ||
    message.includes('non-recoverable sign in failure')
  ) {
    return (
      'Google Sign-In thất bại (12500). SHA-1 máy bạn chưa có trong Firebase. Vào Firebase → Project settings → Android app → Add fingerprint → dán SHA-1 từ lệnh npm run android:sha1 → tải lại google-services.json → npx expo run:android.'
    );
  }

  if (
    message.includes('RNGoogleSignin') ||
    message.includes('Native module') ||
    message.includes('TurboModule')
  ) {
    if (isExpoGoClient()) {
      return 'Bạn đang dùng Expo Go. Mở app FastMark đã cài sau khi chạy npx expo run:android.';
    }

    return 'Native Google Sign-In chưa được tích hợp. Chạy lại: npx expo run:android';
  }

  if (message.includes('NETWORK_ERROR')) {
    return 'Không có kết nối mạng. Kiểm tra Internet rồi thử lại.';
  }

  return message || 'Đăng nhập Google thất bại.';
}
