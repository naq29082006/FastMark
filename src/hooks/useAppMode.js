import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const APP_MODE_BUYER = 'buyer';
export const APP_MODE_SELLER = 'seller';

const STORAGE_KEY = 'fastmark:app-mode';

export function useAppMode(isSeller) {
  const [appMode, setAppModeState] = useState(APP_MODE_BUYER);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const readyFallback = setTimeout(() => {
      if (isCurrent) {
        setIsReady(true);
      }
    }, 2000);

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!isCurrent) {
          return;
        }

        if (value === APP_MODE_SELLER && isSeller) {
          setAppModeState(APP_MODE_SELLER);
        } else {
          setAppModeState(APP_MODE_BUYER);
        }
        setIsReady(true);
      })
      .catch(() => {
        if (isCurrent) {
          setIsReady(true);
        }
      })
      .finally(() => {
        clearTimeout(readyFallback);
      });

    return () => {
      isCurrent = false;
      clearTimeout(readyFallback);
    };
  }, [isSeller]);

  useEffect(() => {
    if (!isSeller && appMode === APP_MODE_SELLER) {
      setAppModeState(APP_MODE_BUYER);
      AsyncStorage.setItem(STORAGE_KEY, APP_MODE_BUYER).catch(() => {});
    }
  }, [isSeller, appMode]);

  const setAppMode = useCallback(
    async (nextMode) => {
      if (nextMode === APP_MODE_SELLER && !isSeller) {
        return false;
      }

      setAppModeState(nextMode);
      await AsyncStorage.setItem(STORAGE_KEY, nextMode);
      return true;
    },
    [isSeller]
  );

  return {
    appMode,
    setAppMode,
    isReady,
    isBuyerMode: appMode === APP_MODE_BUYER,
    isSellerMode: appMode === APP_MODE_SELLER,
  };
}
