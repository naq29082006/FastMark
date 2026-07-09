import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { googleLogger as log } from '../../core/utils/logger';

let googleSignInModuleCache = undefined;

export function isExpoGoRuntime() {
  if (Constants.appOwnership === 'expo') {
    return true;
  }

  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function hasGoogleSigninNativeBinary() {
  if (Platform.OS === 'web' || isExpoGoRuntime()) {
    return false;
  }

  return Boolean(NativeModules.RNGoogleSignin);
}

export function getNativeGoogleSignInModule() {
  if (googleSignInModuleCache !== undefined) {
    return googleSignInModuleCache;
  }

  if (!hasGoogleSigninNativeBinary()) {
    googleSignInModuleCache = null;
    return googleSignInModuleCache;
  }

  try {
    const module = require('@react-native-google-signin/google-signin');
    const GoogleSignin = module?.GoogleSignin;
    const statusCodes = module?.statusCodes;

    if (!GoogleSignin) {
      throw new Error('GoogleSignin export missing');
    }

    googleSignInModuleCache = { GoogleSignin, statusCodes };
    log.info('native-module:ready');
  } catch (error) {
    log.warn('native-module-unavailable', error?.message || String(error));
    googleSignInModuleCache = null;
  }

  return googleSignInModuleCache;
}

export function isNativeGoogleSignInAvailable() {
  return Boolean(getNativeGoogleSignInModule());
}
