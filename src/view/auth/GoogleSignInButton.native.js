import { Text, View } from 'react-native';

import { googleLogger as log } from '../../core/utils/logger';
import { isExpoGoClient } from '../../viewmodel/auth/googleAuthConfig';
import { GoogleSignInPressable } from './googleSignInShared';

function ExpoGoGoogleSignInButton({ disabled, onError, message }) {
  const hint =
    message || 'Google Sign-In không chạy trên Expo Go. Chạy: npx expo run:android';

  function handlePress() {
    log.warn('signIn:blocked');
    onError?.(hint);
  }

  return (
    <View>
      <GoogleSignInPressable disabled={disabled} onPress={handlePress} />
      <Text style={{ marginTop: 8, fontSize: 12, color: '#b45309', textAlign: 'center' }}>
        {hint}
      </Text>
    </View>
  );
}

let nativeImplCache = undefined;

function resolveNativeImpl() {
  if (nativeImplCache !== undefined) {
    return nativeImplCache;
  }

  try {
    nativeImplCache = require('./googleSignInNativeImpl').default;
  } catch (error) {
    log.warn('native-impl-unavailable', error?.message || error);
    nativeImplCache = null;
  }

  return nativeImplCache;
}

export default function GoogleSignInButton(props) {
  if (isExpoGoClient()) {
    log.info('render:expo-go-blocked');
    return <ExpoGoGoogleSignInButton {...props} />;
  }

  const NativeImpl = resolveNativeImpl();

  if (!NativeImpl) {
    return (
      <ExpoGoGoogleSignInButton
        {...props}
        message="Google Sign-In cần rebuild native: npx expo run:android"
      />
    );
  }

  return <NativeImpl {...props} />;
}
