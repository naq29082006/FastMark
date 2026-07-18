import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { SELLER_VERIFICATION_STATUS } from '../constants/sellerVerification';
import { ROLE_SELLER } from '../model/profileModel';
import {
  selectCanPostProducts,
  selectSellerAccessStatus,
  selectSellerAccessSyncedAt,
  selectSellerVerification,
  selectUserRole,
} from '../viewmodel/auth/authSelectors';
import { syncSellerAccess } from '../viewmodel/auth/authSlice';

const PENDING_POLL_INTERVAL_MS = 15000;

export function useSellerAccessSync({
  enabled = true,
  pollIntervalMs = PENDING_POLL_INTERVAL_MS,
} = {}) {
  const dispatch = useDispatch();
  const role = useSelector(selectUserRole);
  const canPost = useSelector(selectCanPostProducts);
  const verification = useSelector(selectSellerVerification);
  const accessStatus = useSelector(selectSellerAccessStatus);
  const syncedAt = useSelector(selectSellerAccessSyncedAt);
  const isSyncingRef = useRef(false);
  const lastActiveRefreshRef = useRef(0);
  const shouldPoll =
    enabled && verification?.status === SELLER_VERIFICATION_STATUS.PENDING;

  const refresh = useCallback(async () => {
    if (!enabled || isSyncingRef.current) {
      return null;
    }

    isSyncingRef.current = true;
    try {
      const result = await dispatch(syncSellerAccess()).unwrap();
      return result;
    } catch {
      return null;
    } finally {
      isSyncingRef.current = false;
    }
  }, [dispatch, enabled]);

  // Chỉ sync seller khi cần — tránh đua token/API ngay sau login.
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const timer = setTimeout(() => {
      refresh();
    }, 4000);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }
      const now = Date.now();
      if (now - lastActiveRefreshRef.current < 60000) {
        return;
      }
      lastActiveRefreshRef.current = now;
      refresh();
    });

    return () => {
      clearTimeout(timer);
      appStateSubscription.remove();
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!shouldPoll) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      refresh();
    }, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [pollIntervalMs, refresh, shouldPoll]);

  const isInitialLoading = enabled && !syncedAt;
  const isRefreshing = enabled && accessStatus === 'loading' && Boolean(syncedAt);

  return {
    role: Number(role),
    canPost: Number(role) === ROLE_SELLER && canPost,
    verification,
    isInitialLoading,
    isRefreshing,
    isReady: Boolean(syncedAt),
    refresh,
  };
}
