import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { googleLogger as log } from '../../utils/logger';
import {
  describeGoogleOAuthError,
  getGoogleBrowserAuthRequestConfig,
} from './googleAuthConfig';
import { socialLogin } from './authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInBrowserButton({ disabled, onError }) {
  const dispatch = useDispatch();
  const [request, googleResponse, promptGoogle] = Google.useAuthRequest(
    getGoogleBrowserAuthRequestConfig()
  );

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    log.info('browserResponse', googleResponse.type);

    if (googleResponse.type === 'error') {
      log.fail('browserResponse:error', describeGoogleOAuthError(googleResponse));
      onError?.(describeGoogleOAuthError(googleResponse) || 'Đăng nhập Google thất bại.');
      return;
    }

    if (googleResponse.type !== 'success') {
      return;
    }

    const idToken =
      googleResponse.params?.id_token ||
      googleResponse.authentication?.idToken ||
      '';

    if (!idToken) {
      log.warn('browserResponse:no-id-token');
      onError?.('Google không trả về id_token. Kiểm tra OAuth Client ID trên Google Cloud.');
      return;
    }

    log.ok('browserResponse:id-token-received');
    dispatch(socialLogin({ token: idToken }));
  }, [googleResponse, dispatch, onError]);

  function handlePress() {
    onError?.('');
    log.info('browserSignIn:pressed');

    if (!request) {
      log.warn('browserSignIn:request-not-ready');
      onError?.('Google Sign-In đang khởi tạo. Thử lại sau vài giây.');
      return;
    }

    promptGoogle({ extraParams: { prompt: 'select_account' } });
  }

  return (
    <GoogleSignInPressable
      disabled={disabled}
      onPress={handlePress}
    />
  );
}
