import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useDispatch, useSelector } from 'react-redux';

import AuthenticatedHome from '../view/auth/AuthenticatedHome';
import AuthScreen from '../view/auth/AuthScreen';
import EmailVerificationScreen from '../view/auth/EmailVerificationScreen';
import GoogleUsernameSetupScreen from '../view/auth/GoogleUsernameSetupScreen';
import {
  selectAuthProfileStatus,
  selectAuthStatus,
  selectNeedsEmailVerification,
  selectPendingGoogle,
} from '../viewmodel/auth/authSelectors';
import {
  loadUserProfile,
  setAuthChecking,
  setAuthUser,
  setConfigError,
  setUnauthenticated,
} from '../viewmodel/auth/authSlice';
import { store } from '../core/store';
import {
  serializeAuthUser,
  subscribeToAuthChanges,
} from '../repository/authRepository';
import { getFirebaseInitConfigError } from '../core/config/firebaseApp';
import { getStartupDiagnostics, validateGoogleOAuthSetup } from '../core/utils/authDiagnostics';
import { authLogger as log } from '../core/utils/logger';

export default function FastmarkApp() {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const profileStatus = useSelector(selectAuthProfileStatus);
  const pendingGoogle = useSelector(selectPendingGoogle);
  const needsEmailVerification = useSelector(selectNeedsEmailVerification);

  useEffect(() => {
    log.info('startup');
    log.info('startup-diagnostics', getStartupDiagnostics());
    const googleIssues = validateGoogleOAuthSetup();
    if (googleIssues.length > 0) {
      log.warn('google-oauth-issues', googleIssues);
    }
    const configError = getFirebaseInitConfigError();

    if (configError) {
      log.fail('config-error', configError);
      dispatch(setConfigError(configError));
      return undefined;
    }

    dispatch(setAuthChecking());

    try {
      const unsubscribe = subscribeToAuthChanges(
        (firebaseUser) => {
          if (!firebaseUser) {
            log.info('session:unauthenticated');
            dispatch(setUnauthenticated());
            return;
          }

          const user = serializeAuthUser(firebaseUser);
          const currentUid = store.getState().auth.user?.uid;

          log.info('session:authenticated', { uid: user.uid });
          dispatch(setAuthUser(user));

          if (currentUid !== user.uid) {
            log.info('session:load-profile', { uid: user.uid });
            dispatch(loadUserProfile());
          }
        },
        (error) => {
          log.fail('[AUTH] onAuthStateChanged subscribe callback ERROR', error);
          // Only surface listener errors when there is no active session.
          if (!store.getState().auth.user) {
            dispatch(setConfigError(error?.message || 'Không khởi tạo được xác thực.'));
          }
        }
      );

      return unsubscribe;
    } catch (error) {
      log.fail('startup:init-auth-failed', error);
      dispatch(setConfigError(error?.message || 'Không khởi tạo được xác thực.'));
      return undefined;
    }
  }, [dispatch]);

  if (status === 'checking') {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang kiểm tra đăng nhập...</Text>
      </View>
    );
  }

  if (pendingGoogle) {
    return (
      <>
        <StatusBar style="dark" />
        <GoogleUsernameSetupScreen />
      </>
    );
  }

  if (status === 'authenticated' && profileStatus === 'loading') {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
      </View>
    );
  }

  if (needsEmailVerification) {
    return (
      <>
        <StatusBar style="dark" />
        <EmailVerificationScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {status === 'authenticated' ? <AuthenticatedHome /> : <AuthScreen />}
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f0ed',
  },
  loadingText: {
    marginTop: 14,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
});
