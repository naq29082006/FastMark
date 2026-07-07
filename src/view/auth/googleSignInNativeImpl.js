import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { googleOAuthConfig } from '../../core/config/env';
import { googleLogger as log } from '../../core/utils/logger';
import { describeNativeGoogleError, getGoogleAuthSetupError } from '../../viewmodel/auth/googleAuthConfig';
import { clearGoogleSignInSession } from '../../viewmodel/auth/clearGoogleSignInSession';
import { socialLogin } from '../../viewmodel/auth/authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

let googleSignInModule = undefined;

function getGoogleSignInModule() {
  if (googleSignInModule !== undefined) {
    return googleSignInModule;
  }

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin');
    const { statusCodes } = require('@react-native-google-signin/google-signin/lib/module/errors/errorCodes');
    googleSignInModule = { GoogleSignin, statusCodes };
  } catch (error) {
    log.warn('native-module-unavailable', error?.message || error);
    googleSignInModule = null;
  }

  return googleSignInModule;
}

export default function GoogleSignInNativeImpl({ disabled, onError }) {
  const dispatch = useDispatch();
  const setupError = getGoogleAuthSetupError();
  const nativeModule = getGoogleSignInModule();
  const moduleError = nativeModule
    ? ''
    : 'Google Sign-In chưa sẵn sàng. Chạy: npx expo run:android';

  useEffect(() => {
    if (setupError || !nativeModule) {
      if (setupError) {
        log.warn('configure:setup-error', setupError);
      }
      return;
    }

    nativeModule.GoogleSignin.configure({
      webClientId: googleOAuthConfig.webClientId,
      offlineAccess: false,
    });
    log.info('configure:success');
  }, [setupError, nativeModule]);

  async function handlePress() {
    onError?.('');
    log.info('signIn:pressed');

    if (setupError) {
      onError?.(setupError);
      return;
    }

    if (!nativeModule) {
      onError?.(moduleError);
      return;
    }

    const { GoogleSignin, statusCodes } = nativeModule;

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
      disabled={disabled || Boolean(setupError || moduleError)}
      onPress={handlePress}
    />
  );
}
