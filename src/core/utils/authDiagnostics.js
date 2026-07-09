import { getApps } from 'firebase/app';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import googleServices from '../../../google-services.json';
import { getAndroidOAuthClientIdsFromGoogleServices, getWebOAuthClientIdFromGoogleServices } from '../config/googleServicesConfig';
import { getResolvedFirebaseConfigSummary } from '../config/firebaseApp';
import { googleOAuthConfig, getNodeApiUrl } from '../config/env';
import { isExpoGoClient } from '../../viewmodel/auth/googleAuthConfig';

export function getStartupDiagnostics() {
  const androidClient = googleServices?.client?.[0];
  const oauthClients = androidClient?.oauth_client || [];
  const androidOAuth = oauthClients.find((c) => c.client_type === 1);
  const webOAuth = oauthClients.find((c) => c.client_type === 3);

  const androidOAuthIds = getAndroidOAuthClientIdsFromGoogleServices();
  const fileWebId = getWebOAuthClientIdFromGoogleServices() || webOAuth?.client_id || '';

  const envAndroidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const envWebId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const resolvedAndroidId = googleOAuthConfig.androidClientId;
  const resolvedWebId = googleOAuthConfig.webClientId;

  return {
    firebase: getResolvedFirebaseConfigSummary(),
    firebaseAppsCount: getApps().length,
    nodeApiUrl: getNodeApiUrl() ? 'set' : '(not set)',
    google: {
      webClientId: resolvedWebId ? 'set' : 'missing',
      androidClientId: resolvedAndroidId ? 'set' : 'missing',
      iosClientId: googleOAuthConfig.iosClientId ? 'set' : 'missing',
      envMatchesGoogleServices: {
        web: !envWebId || !fileWebId || envWebId === fileWebId,
        android: !envAndroidId || androidOAuthIds.includes(envAndroidId),
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

  if (isExpoGoClient()) {
    issues.push('Running in Expo Go — native Google Sign-In unavailable');
  }

  if (!googleOAuthConfig.webClientId) {
    issues.push('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }

  const envAndroidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const envWebId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const fileWebId = getWebOAuthClientIdFromGoogleServices();
  const androidOAuthIds = getAndroidOAuthClientIdsFromGoogleServices();

  if (envWebId && fileWebId && envWebId !== fileWebId) {
    issues.push('Web Client ID in .env does not match google-services.json');
  }

  if (envAndroidId && androidOAuthIds.length > 0 && !androidOAuthIds.includes(envAndroidId)) {
    issues.push('Android Client ID in .env does not match google-services.json');
  }

  return issues;
}
