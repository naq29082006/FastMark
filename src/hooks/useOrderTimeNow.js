import { useEffect, useRef, useState } from 'react';

import { RESERVATION_STATUS } from '../constants/sellerOrders';

const MINUTE_MS = 60_000;
/** Không lên lịch quá xa — tránh timer treo quá lâu khi user mở app sớm. */
const MAX_SCHEDULE_MS = 24 * 60 * 60 * 1000;

function findNextPickupBoundaryMs(items, now) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  let nextMs = null;
  for (const item of items) {
    if (item?.status !== RESERVATION_STATUS.WAITING_PICKUP || !item?.pickupTime) {
      continue;
    }
    const pickupMs = new Date(item.pickupTime).getTime();
    if (!Number.isFinite(pickupMs) || pickupMs <= now) {
      continue;
    }
    if (nextMs == null || pickupMs < nextMs) {
      nextMs = pickupMs;
    }
  }
  return nextMs;
}

/**
 * Thời gian hiện tại cho màn đơn hàng: cập nhật mỗi phút (countdown)
 * và lên lịch chính xác tại giờ nhận hàng tiếp theo (chuyển sang "quá giờ nhận").
 */
export function useOrderTimeNow({ enabled = true, items = [], onPickupBoundary = null } = {}) {
  const onPickupBoundaryRef = useRef(onPickupBoundary);
  onPickupBoundaryRef.current = onPickupBoundary;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const tick = () => setNow(Date.now());
    const minuteTimer = setInterval(tick, MINUTE_MS);
    let boundaryTimer = null;

    function scheduleNextPickupBoundary() {
      if (boundaryTimer) {
        clearTimeout(boundaryTimer);
        boundaryTimer = null;
      }

      const current = Date.now();
      const nextMs = findNextPickupBoundaryMs(items, current);
      if (nextMs == null) {
        return;
      }

      const delay = nextMs - current;
      if (delay <= 0) {
        tick();
        onPickupBoundaryRef.current?.();
        scheduleNextPickupBoundary();
        return;
      }
      if (delay > MAX_SCHEDULE_MS) {
        return;
      }

      boundaryTimer = setTimeout(() => {
        tick();
        onPickupBoundaryRef.current?.();
        scheduleNextPickupBoundary();
      }, delay + 50);
    }

    scheduleNextPickupBoundary();

    return () => {
      clearInterval(minuteTimer);
      if (boundaryTimer) {
        clearTimeout(boundaryTimer);
      }
    };
  }, [enabled, items]);

  return now;
}
