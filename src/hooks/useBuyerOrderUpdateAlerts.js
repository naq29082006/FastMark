import { useCallback } from 'react';

import { showBuyerPickupQrOrderAlert } from '../core/utils/buyerOrderUpdateAlert';
import { useOrderSocket } from './useOrderSocket';

/** @deprecated Chỉ dùng alert trực tiếp trên BuyerPickupQrDisplayScreen. */
export function useBuyerOrderUpdateAlerts(enabled = false) {
  const onOrderUpdated = useCallback((payload) => {
    showBuyerPickupQrOrderAlert(payload);
  }, []);

  useOrderSocket({
    enabled,
    onOrderUpdated,
  });
}
