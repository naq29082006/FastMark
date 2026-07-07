import { getApps } from 'firebase/app';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import googleServices from '../../../google-services.json';
import { getResolvedFirebaseConfigSummary } from '../config/firebaseApp';
import { googleOAuthConfig, getNodeApiUrl } from '../config/env';
import { isExpoGoClient } from '../../viewmodel/auth/googleAuthConfig';

export function getStartupDiagnostics() {
  const androidClient = googleServices?.client?.[0];
  const oauthClients = androidClient?.oauth_client || [];
  const androidOAuth = oauthClients.find((c) => c.client_type === 1);
  const webOAuth = oauthClients.find((c) => c.client_type === 3);

  const envAndroidId = googleOAuthConfig.androidClientId;
  const fileAndroidId = androidOAuth?.client_id || '';
  const envWebId = googleOAuthConfig.webClientId;
  const fileWebId = webOAuth?.client_id || '';

  return {
    firebase: getResolvedFirebaseConfigSummary(),
    firebaseAppsCount: getApps().length,
    nodeApiUrl: getNodeApiUrl() ? 'set' : '(not set)',
    google: {
      webClientId: envWebId ? 'set' : 'missing',
      androidClientId: envAndroidId ? 'set' : 'missing',
      iosClientId: googleOAuthConfig.iosClientId ? 'set' : 'missing',
      envMatchesGoogleServices: {
        web: !envWebId || !fileWebId || envWebId === fileWebId,
        android: !envAndroidId || !fileAndroidId || envAndroidId === fileAndroidId,
      },
      googleServicesPackage: androidClient?.client_info?.android_client_info?.package_name || '(missing)',
      googleServicesSha1: androidOAuth?.android_info?.certificate_hash || '(missing)',
    },
    runtime: {
      isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
      executionEnvironment: Constants.executionEnvironment,
      metroHost:
        Constants.expoGoConfig?.debuggerHost ||
        Constants.expoConfig?.hostUri ||
        '(unknown)',
    },
  };
}

export function validateGoogleOAuthSetup() {
  const issues = [];
  const diag = getStartupDiagnostics();

  if (isExpoGoClient()) {
    issues.push('Running in Expo Go — native Google Sign-In unavailable');
  }

  if (!googleOAuthConfig.webClientId) {
    issues.push('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }

  if (!diag.google.envMatchesGoogleServices.web) {
    issues.push('Web Client ID in .env does not match google-services.json');
  }

  if (!diag.google.envMatchesGoogleServices.android) {
    issues.push('Android Client ID in .env does not match google-services.json');
  }

  return issues;
}
