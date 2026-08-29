import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  registerDevicePushTokenOnBackend,
  removeDevicePushTokenOnBackend,
} from '../api/notificationApi';
import { loadNotificationSettings } from '../core/storage/notificationSettingsStorage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function resolvePlatform() {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'unknown';
}

function extractDevicePushToken(tokenResult) {
  if (!tokenResult) {
    return '';
  }

  if (typeof tokenResult === 'string') {
    return tokenResult.trim();
  }

  return String(tokenResult.data || tokenResult.token || '').trim();
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'FastMark',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#076F32',
  });
}

async function requestPushPermission() {
  const settings = await loadNotificationSettings();
  if (!settings.orderNotifications && !settings.systemNotifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function fetchNativeDevicePushToken() {
  await ensureAndroidChannel();

  const granted = await requestPushPermission();
  if (!granted) {
    return '';
  }

  try {
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    return extractDevicePushToken(tokenResult);
  } catch (error) {
    console.warn('[push] unable to get native device token:', error?.message || error);
    return '';
  }
}

async function registerTokenOnBackend(token) {
  await registerDevicePushTokenOnBackend({
    token,
    platform: resolvePlatform(),
  });
}

export function usePushNotifications({ enabled = true } = {}) {
  const activeTokenRef = useRef('');
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;
    let retryTimer = null;

    async function syncToken(attempt = 0) {
      if (disposed || syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;
      try {
        const token = await fetchNativeDevicePushToken();
        if (!token || disposed) {
          if (!disposed && attempt < 6) {
            retryTimer = setTimeout(() => syncToken(attempt + 1), 2000 * (attempt + 1));
          }
          return;
        }

        if (token === activeTokenRef.current) {
          return;
        }

        await registerTokenOnBackend(token);
        activeTokenRef.current = token;
      } catch (error) {
        console.warn('[push] register token failed:', error?.message || error);
        if (!disposed && attempt < 6) {
          retryTimer = setTimeout(() => syncToken(attempt + 1), 2000 * (attempt + 1));
        }
      } finally {
        syncInFlightRef.current = false;
      }
    }

    syncToken();

    const tokenSubscription = Notifications.addPushTokenListener((tokenResult) => {
      const nextToken = extractDevicePushToken(tokenResult);
      if (!nextToken || nextToken === activeTokenRef.current) {
        return;
      }

      activeTokenRef.current = nextToken;
      registerTokenOnBackend(nextToken).catch((error) => {
        console.warn('[push] refresh token failed:', error?.message || error);
      });
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncToken().catch(() => {});
      }
    });

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      tokenSubscription.remove();
      appStateSubscription.remove();
      const token = activeTokenRef.current;
      activeTokenRef.current = '';
      if (token) {
        removeDevicePushTokenOnBackend(token).catch(() => {});
      }
    };
  }, [enabled]);
}
