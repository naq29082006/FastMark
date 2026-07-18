import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import AuthenticatedHome from '../view/auth/AuthenticatedHome';
import AuthScreen from '../view/auth/AuthScreen';
import EmailVerificationScreen from '../view/auth/EmailVerificationScreen';
import GoogleUsernameSetupScreen from '../view/auth/GoogleUsernameSetupScreen';
import {
  selectAuthProfile,
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
  clearCachedIdToken,
  serializeAuthUser,
  subscribeToAuthChanges,
  waitForAuthReady,
} from '../repository/authRepository';
import { getFirebaseInitConfigError } from '../core/config/firebaseApp';
import { getStartupDiagnostics, validateGoogleOAuthSetup } from '../core/utils/authDiagnostics';
import { authLogger as log } from '../core/utils/logger';

const WELCOME_DURATION_MS = 1200;

function applyFirebaseUser(dispatch, firebaseUser, { loadProfileIfNeeded = true } = {}) {
  if (!firebaseUser) {
    clearCachedIdToken();
    dispatch(setUnauthenticated());
    return;
  }

  const user = serializeAuthUser(firebaseUser);
  const state = store.getState().auth;
  const previousUid = state.user?.uid;

  log.info('session:authenticated', { uid: user.uid });
  dispatch(setAuthUser(user));

  if (!loadProfileIfNeeded) {
    return;
  }

  if (previousUid !== user.uid || (!state.profile && state.profileStatus !== 'loading')) {
    log.info('session:load-profile', { uid: user.uid });
    dispatch(loadUserProfile());
  }
}

export default function FastmarkApp() {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const profile = useSelector(selectAuthProfile);
  const profileStatus = useSelector(selectAuthProfileStatus);
  const pendingGoogle = useSelector(selectPendingGoogle);
  const needsEmailVerification = useSelector(selectNeedsEmailVerification);
  const [showWelcome, setShowWelcome] = useState(true);
  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!(status === 'authenticated' && profileStatus === 'loading' && !profile)) {
      setProfileLoadTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setProfileLoadTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [status, profileStatus, profile]);

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

    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      try {
        // Đợi Firebase restore session từ AsyncStorage trước khi tin user=null.
        const restoredUser = await waitForAuthReady(12000);
        if (cancelled) {
          return;
        }

        if (restoredUser) {
          applyFirebaseUser(dispatch, restoredUser);
        } else {
          log.info('session:unauthenticated');
          clearCachedIdToken();
          dispatch(setUnauthenticated());
        }

        unsubscribe = subscribeToAuthChanges(
          (firebaseUser) => {
            if (cancelled) {
              return;
            }
            applyFirebaseUser(dispatch, firebaseUser);
          },
          (error) => {
            log.fail('[AUTH] onAuthStateChanged subscribe callback ERROR', error);
            if (!store.getState().auth.user) {
              dispatch(setConfigError(error?.message || 'Không khởi tạo được xác thực.'));
            }
          }
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        log.fail('startup:init-auth-failed', error);
        dispatch(setConfigError(error?.message || 'Không khởi tạo được xác thực.'));
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [dispatch]);

  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <View style={styles.welcomeScreen}>
          <StatusBar style="light" />
          <Image
            source={require('../../assets/welcome.png')}
            style={styles.welcomeImage}
            resizeMode="contain"
          />
        </View>
      </SafeAreaProvider>
    );
  }

  if (status === 'checking') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingScreen} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color="#076F32" />
          <Text style={styles.loadingText}>Đang kiểm tra đăng nhập...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (pendingGoogle) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar style="dark" />
          <GoogleUsernameSetupScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (status === 'authenticated' && profileStatus === 'loading' && !profile && !profileLoadTimedOut) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingScreen} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color="#076F32" />
          <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (status === 'authenticated' && profileStatus === 'loading' && !profile && profileLoadTimedOut) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthenticatedHome />
      </SafeAreaProvider>
    );
  }

  if (needsEmailVerification) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar style="dark" />
          <EmailVerificationScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {status === 'authenticated' ? <AuthenticatedHome /> : <AuthScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  welcomeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d3d4d',
  },
  welcomeImage: {
    width: '80%',
    height: '50%',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f0ed',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#e7f0ed',
  },
  loadingText: {
    marginTop: 14,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
});
