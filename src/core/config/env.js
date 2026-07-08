import {
  getAndroidFirebaseConfigFromGoogleServices,
  getAndroidOAuthClientIdFromGoogleServices,
  getWebOAuthClientIdFromGoogleServices,
} from './googleServicesConfig';
import { createLogger } from '../utils/logger';

const log = createLogger('Env');

const env = process.env || {};
const googleServicesFirebase = getAndroidFirebaseConfigFromGoogleServices();

export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY || googleServicesFirebase.apiKey,
  authDomain:
    env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || googleServicesFirebase.authDomain,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || googleServicesFirebase.projectId,
  storageBucket:
    env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || googleServicesFirebase.storageBucket,
  messagingSenderId:
    env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    googleServicesFirebase.messagingSenderId,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID || googleServicesFirebase.appId,
};

export const nodeApiUrl = env.EXPO_PUBLIC_NODE_API_URL || '';

export const googleOAuthConfig = {
  webClientId:
    env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    getWebOAuthClientIdFromGoogleServices() ||
    '',
  androidClientId:
    env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    getAndroidOAuthClientIdFromGoogleServices() ||
    '',
  iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
};

const firebaseRequiredKeys = [
  ['EXPO_PUBLIC_FIREBASE_API_KEY', 'apiKey'],
  ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'projectId'],
  ['EXPO_PUBLIC_FIREBASE_APP_ID', 'appId'],
];

export function getMissingFirebaseEnv() {
  return firebaseRequiredKeys
    .filter(([, configKey]) => !firebaseConfig[configKey])
    .map(([envKey]) => envKey);
}

export function getNodeApiUrl() {
  return nodeApiUrl;
}

export function getAuthConfigError() {
  const missing = getMissingFirebaseEnv();

  if (missing.length === 0) {
    return '';
  }

  return `Cần bổ sung các biến trong .env: ${missing.join(', ')}`;
}

export function getFirebaseConfigSummary() {
  return {
    projectId: firebaseConfig.projectId || '(missing)',
    authDomain: firebaseConfig.authDomain || '(missing)',
    appId: firebaseConfig.appId ? `${firebaseConfig.appId.slice(0, 8)}...` : '(missing)',
    apiKey: firebaseConfig.apiKey ? 'set' : '(missing)',
  };
}

export function assertBackendEnv() {
  const missing = getMissingFirebaseEnv();

  if (missing.length > 0) {
    log.fail('assertBackendEnv', `Missing: ${missing.join(', ')}`);
    throw new Error(`Thiếu cấu hình kết nối: ${missing.join(', ')}`);
  }

  log.debug('assertBackendEnv:ok');
}
