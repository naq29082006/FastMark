import { useCallback, useEffect, useState } from 'react';

import { getMyReviewsOnBackend } from '../api/reviewApi';
import { getCurrentUserIdToken } from '../repository/authRepository';

const sessionReviewedOrderCodes = new Set();

export function getOrderReviewKey(order) {
  return String(order?.orderCode || order?.id || '').trim();
}

export async function loadReviewedOrderCodes() {
  const codes = new Set(sessionReviewedOrderCodes);

  try {
    const idToken = await getCurrentUserIdToken();
    if (idToken) {
      const reviews = await getMyReviewsOnBackend(idToken);
      (reviews || []).forEach((review) => {
        const key = String(review.orderCode || '').trim();
        if (key) {
          codes.add(key);
        }
      });
    }
  } catch {
    // Keep session-only codes when API is unavailable.
  }

  return codes;
}

export function markOrderAsReviewed(order) {
  const key = getOrderReviewKey(order);
  if (key) {
    sessionReviewedOrderCodes.add(key);
  }
}

export function isOrderAlreadyReviewed(order, reviewedOrderCodes) {
  const key = getOrderReviewKey(order);
  return Boolean(key && reviewedOrderCodes?.has(key));
}

export function useReviewedOrderCodes(refreshKey = 0) {
  const [reviewedOrderCodes, setReviewedOrderCodes] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadReviewedOrderCodes()
      .then((codes) => {
        if (active) {
          setReviewedOrderCodes(codes);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const markReviewed = useCallback((order) => {
    markOrderAsReviewed(order);
    const key = getOrderReviewKey(order);
    if (!key) {
      return;
    }
    setReviewedOrderCodes((current) => new Set([...current, key]));
  }, []);

  return { reviewedOrderCodes, isLoading, markReviewed };
}
