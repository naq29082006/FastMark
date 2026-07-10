import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  getAndroidFirebaseConfigFromGoogleServices,
  getAndroidOAuthClientIdFromGoogleServices,
  getAndroidOAuthClientIdsFromGoogleServices,
  getWebOAuthClientIdFromGoogleServices,
  resolveAndroidOAuthClientId,
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

function readSupabaseEnv(...keys) {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
}

export const supabaseConfig = {
  url: readSupabaseEnv('EXPO_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'),
  anonKey: readSupabaseEnv(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY'
  ),
};

export function getSupabaseConfig() {
  return supabaseConfig;
}

export function getSupabaseConfigError() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    return 'Thiếu EXPO_PUBLIC_SUPABASE_URL hoặc EXPO_PUBLIC_SUPABASE_ANON_KEY trong .env';
  }

  return '';
}

export const googleOAuthConfig = {
  webClientId:
    getWebOAuthClientIdFromGoogleServices() ||
    env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '',
  androidClientId:
    resolveAndroidOAuthClientId(env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ||
    env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
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

function getExpoDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';

  if (!hostUri) {
    return '';
  }

  return String(hostUri).split(':')[0].trim();
}

function resolveBackendPort(configuredUrl) {
  const portMatch = String(configuredUrl || '').match(/:(\d+)(?:\/|$)/);
  return portMatch?.[1] || '5000';
}

export function getNodeApiUrl() {
  const configured = String(nodeApiUrl || '').trim().replace(/\/$/, '');
  const port = resolveBackendPort(configured);

  // Android emulator không truy cập được IP LAN — dùng 10.0.2.2
  if (Platform.OS === 'android' && Constants.isDevice === false) {
    const url = `http://10.0.2.2:${port}`;
    log.debug('nodeApiUrl:android-emulator', url);
    return url;
  }

  // Dev: tự lấy IP từ Metro/Expo (tránh .env cũ khi đổi Wi-Fi)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const expoHost = getExpoDevHost();
    if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
      const url = `http://${expoHost}:${port}`;
      log.debug('nodeApiUrl:expo-dev-host', url);
      return url;
    }
  }

  if (!configured) {
    return '';
  }

  if (
    Platform.OS === 'android' &&
    /:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i.test(configured)
  ) {
    return `http://10.0.2.2:${port}`;
  }

  return configured;
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
