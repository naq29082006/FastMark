import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { GoogleSignin } from '@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin';
import { statusCodes } from '@react-native-google-signin/google-signin/lib/module/errors/errorCodes';

import { googleOAuthConfig } from '../../services/env';
import { googleLogger as log } from '../../utils/logger';
import { describeNativeGoogleError, getGoogleAuthSetupError } from './googleAuthConfig';
import { clearGoogleSignInSession } from './clearGoogleSignInSession';
import { socialLogin } from './authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInNativeImpl({ disabled, onError }) {
  const dispatch = useDispatch();
  const setupError = getGoogleAuthSetupError();

  useEffect(() => {
    if (setupError) {
      log.warn('configure:setup-error', setupError);
      return;
    }

    GoogleSignin.configure({
      webClientId: googleOAuthConfig.webClientId,
      offlineAccess: false,
    });
    log.info('configure:success');
  }, [setupError]);

  async function handlePress() {
    onError?.('');
    log.info('signIn:pressed');

    if (setupError) {
      onError?.(setupError);
      return;
    }

    try {
      await clearGoogleSignInSession();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response?.type === 'cancelled') {
        log.info('signIn:cancelled');
        return;
      }

      const userData = response?.data || response;
      let idToken = userData?.idToken || userData?.user?.idToken;

      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }

      if (!idToken) {
        log.warn('signIn:no-id-token');
        onError?.('Google không trả về id_token. Kiểm tra Web Client ID trong Firebase.');
        return;
      }

      log.ok('signIn:id-token-received');
      dispatch(socialLogin({ token: idToken }));
    } catch (error) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        log.info('signIn:cancelled');
        return;
      }

      log.fail('signIn', error);
      onError?.(describeNativeGoogleError(error) || 'Đăng nhập Google thất bại.');
    }
  }

  return (
    <GoogleSignInPressable
      disabled={disabled || Boolean(setupError)}
      onPress={handlePress}
    />
  );
}
