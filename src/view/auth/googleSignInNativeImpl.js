import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { googleLogger as log } from '../../core/utils/logger';
import { describeNativeGoogleError, getGoogleAuthSetupError, getGoogleNativeWebClientId } from '../../viewmodel/auth/googleAuthConfig';
import { getNativeGoogleSignInModule } from '../../viewmodel/auth/googleSignInModule';
import { selectAuthActionStatus } from '../../viewmodel/auth/authSelectors';
import { clearGoogleSignInSession } from '../../viewmodel/auth/clearGoogleSignInSession';
import { socialLogin } from '../../viewmodel/auth/authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInNativeImpl({ disabled, onError }) {
  const dispatch = useDispatch();
  const actionStatus = useSelector(selectAuthActionStatus);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const setupError = getGoogleAuthSetupError();
  const nativeModule = getNativeGoogleSignInModule();
  const moduleError = nativeModule ? '' : getGoogleAuthSetupError();
  const isBusy = isSigningIn || actionStatus === 'loading';

  useEffect(() => {
    if (setupError || !nativeModule) {
      if (setupError) {
        log.warn('configure:setup-error', setupError);
      }
      return;
    }

    nativeModule.GoogleSignin.configure({
      webClientId: getGoogleNativeWebClientId(),
      offlineAccess: false,
    });
    log.info('configure:success');
  }, [setupError, nativeModule]);

  async function handlePress() {
    if (isBusy) {
      return;
    }

    onError?.('');
    log.info('signIn:pressed');

    if (setupError) {
      onError?.(setupError);
      return;
    }

    if (!nativeModule) {
      onError?.(moduleError || 'Google Sign-In chưa sẵn sàng.');
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
      const fullName = userData?.user?.name || userData?.name || '';
      setIsSigningIn(true);

      try {
        await dispatch(socialLogin({ token: idToken, fullName })).unwrap();
      } catch (error) {
        onError?.(error || 'Đăng nhập Google thất bại.');
      } finally {
        setIsSigningIn(false);
      }
    } catch (error) {
      if (error?.code === statusCodes?.SIGN_IN_CANCELLED) {
        log.info('signIn:cancelled');
        return;
      }

      log.fail('signIn', error);
      onError?.(describeNativeGoogleError(error) || 'Đăng nhập Google thất bại.');
    }
  }

  return (
    <GoogleSignInPressable
      disabled={disabled || isBusy || Boolean(setupError || moduleError)}
      onPress={handlePress}
    />
  );
}
