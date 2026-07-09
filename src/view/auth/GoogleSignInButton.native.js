import { Text, View } from 'react-native';

import { googleLogger as log } from '../../core/utils/logger';
import { getGoogleAuthSetupError, isExpoGoClient } from '../../viewmodel/auth/googleAuthConfig';
import { isNativeGoogleSignInAvailable } from '../../viewmodel/auth/googleSignInModule';
import { GoogleSignInPressable } from './googleSignInShared';

function BlockedGoogleSignInButton({ disabled, onError, message }) {
  const hint = message || getGoogleAuthSetupError() || 'Google Sign-In chưa sẵn sàng.';

  function handlePress() {
    log.warn('signIn:blocked', hint);
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
    return (
      <BlockedGoogleSignInButton
        {...props}
        message="Bạn đang mở Expo Go. Hãy mở app FastMark đã cài sau khi chạy npx expo run:android."
      />
    );
  }

  if (isNativeGoogleSignInAvailable()) {
    const NativeImpl = resolveNativeImpl();

    if (NativeImpl) {
      return <NativeImpl {...props} />;
    }
  }

  return (
    <BlockedGoogleSignInButton
      {...props}
      message="Google Sign-In chưa sẵn sàng trên bản build này. Chạy lại: npx expo run:android"
    />
  );
}
