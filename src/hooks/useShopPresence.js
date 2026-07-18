import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';

import {
  setShopPresenceOfflineOnBackend,
  setShopPresenceOnlineOnBackend,
} from '../api/presenceApi';
import { selectAuthStatus, selectIsSeller } from '../viewmodel/auth/authSelectors';

export function useShopPresence(_appMode) {
  const authStatus = useSelector(selectAuthStatus);
  const isSeller = useSelector(selectIsSeller);
  const appStateRef = useRef(AppState.currentState);
  // Seller đã duyệt: shop presence online khi app foreground (không còn seller mode riêng).
  const isSellerMode = isSeller;

  useEffect(() => {
    if (authStatus !== 'authenticated' || !isSeller) {
      return undefined;
    }

    let isActive = true;

    async function markShopOnline() {
      if (!isSellerMode || appStateRef.current !== 'active') {
        return;
      }

      try {
        await setShopPresenceOnlineOnBackend();
      } catch {
        // Shop presence is best-effort.
      }
    }

    async function markShopOffline() {
      try {
        await setShopPresenceOfflineOnBackend();
      } catch {
        // Shop presence is best-effort.
      }
    }

    if (isSellerMode) {
      markShopOnline();
    } else {
      markShopOffline();
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!isActive || !isSellerMode) {
        return;
      }

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        markShopOnline();
      } else if (nextState.match(/inactive|background/)) {
        markShopOffline();
      }
    });

    return () => {
      isActive = false;
      if (isSellerMode) {
        markShopOffline();
      }
      subscription.remove();
    };
  }, [authStatus, isSeller, isSellerMode]);
}
