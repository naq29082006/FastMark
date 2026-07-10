import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';

import {
  setPresenceOfflineOnBackend,
  setPresenceOnlineOnBackend,
} from '../api/presenceApi';
import { selectAuthStatus } from '../viewmodel/auth/authSelectors';

export function usePresence() {
  const authStatus = useSelector(selectAuthStatus);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return undefined;
    }

    let isActive = true;

    async function markOnline() {
      try {
        await setPresenceOnlineOnBackend();
      } catch {
        // Presence is best-effort.
      }
    }

    async function markOffline() {
      try {
        await setPresenceOfflineOnBackend();
      } catch {
        // Presence is best-effort.
      }
    }

    markOnline();

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!isActive) {
        return;
      }

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        markOnline();
      } else if (nextState.match(/inactive|background/)) {
        markOffline();
      }
    });

    return () => {
      isActive = false;
      markOffline();
      subscription.remove();
    };
  }, [authStatus]);
}
