import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';

import { createLogger } from '../utils/logger';
import { firebaseConfig } from './env';
import { getAndroidFirebaseConfigFromGoogleServices } from './googleServicesConfig';

const log = createLogger('FirebaseApp');

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
let appInitLogged = false;

export function getResolvedFirebaseConfig() {
  const androidConfig = getAndroidFirebaseConfigFromGoogleServices();

  if (Platform.OS === 'android' && androidConfig.apiKey) {
    return {
      apiKey: androidConfig.apiKey,
      appId: androidConfig.appId || firebaseConfig.appId,
      projectId: androidConfig.projectId || firebaseConfig.projectId,
      authDomain: androidConfig.authDomain || firebaseConfig.authDomain,
      messagingSenderId: androidConfig.messagingSenderId || firebaseConfig.messagingSenderId,
      storageBucket: androidConfig.storageBucket || firebaseConfig.storageBucket,
    };
  }

  return { ...firebaseConfig };
}

export function getResolvedFirebaseConfigSummary() {
  const config = getResolvedFirebaseConfig();

  return {
    platform: Platform.OS,
    projectId: config.projectId || '(missing)',
    authDomain: config.authDomain || '(missing)',
    appId: config.appId ? `${config.appId.slice(0, 14)}...` : '(missing)',
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...` : '(missing)',
    usesAndroidGoogleServices: Platform.OS === 'android',
  };
}

export function getFirebaseInitConfigError() {
  const config = getResolvedFirebaseConfig();
  const missing = requiredConfigKeys.filter((key) => !config[key]);

  if (missing.length === 0) {
    return '';
  }

  if (Platform.OS === 'android') {
    return `Thiếu cấu hình Firebase (Android): ${missing.join(', ')}. Kiểm tra google-services.json và .env.`;
  }

  return `Cần bổ sung các biến trong .env: ${missing
    .map((key) => `EXPO_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`)
    .join(', ')}`;
}

function validateFirebaseConfig(config) {
  const missing = requiredConfigKeys.filter((key) => !config[key]);

  if (missing.length > 0) {
    log.fail('validateFirebaseConfig', `Missing: ${missing.join(', ')}`, getResolvedFirebaseConfigSummary());
    throw new Error(getFirebaseInitConfigError() || `Thiếu cấu hình Firebase: ${missing.join(', ')}`);
  }
}

export function ensureFirebaseApp() {
  const config = getResolvedFirebaseConfig();
  validateFirebaseConfig(config);

  if (getApps().length > 0) {
    if (!appInitLogged) {
      log.debug('ensureFirebaseApp:reuse-existing', getResolvedFirebaseConfigSummary());
      appInitLogged = true;
    }
    return getApp();
  }

  log.info('ensureFirebaseApp:init', getResolvedFirebaseConfigSummary());
  appInitLogged = true;
  return initializeApp(config);
}

// Backward-compatible alias used by env diagnostics.
export function assertBackendEnv() {
  validateFirebaseConfig(getResolvedFirebaseConfig());
  log.debug('assertBackendEnv:ok', getResolvedFirebaseConfigSummary());
}
