import { useEffect, useRef, useState } from 'react';

import { discoverProductsOnBackend } from '../api/productApi';
import { fetchSearchShopsFromNode } from '../api/storeNodeApi';
import { searchUsersOnBackend } from '../api/userDiscoveryApi';
import { hasValidLocation } from '../core/utils/geo';
import { normalizeProduct } from '../model/productModel';
import { getCurrentUserIdToken } from '../repository/authRepository';
import {
  SEARCH_SUGGESTION_LIMIT,
  SEARCH_SUGGEST_MIN_LENGTH,
  buildSearchSuggestions,
  filterSuggestionCandidates,
} from '../core/utils/searchSuggestions';

const SUGGEST_DEBOUNCE_MS = 300;
const FETCH_POOL_SIZE = 12;

export function useSearchSuggestions({
  query,
  location,
  enabled = true,
  limit = SEARCH_SUGGESTION_LIMIT,
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const trimmed = String(query || '').trim();
  const locationReady = hasValidLocation(location);
  const canSuggest =
    enabled && locationReady && trimmed.length >= SEARCH_SUGGEST_MIN_LENGTH;

  useEffect(() => {
    if (!canSuggest) {
      requestIdRef.current += 1;
      setItems([]);
      setIsLoading(false);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const idToken = await getCurrentUserIdToken().catch(() => null);
        const [productPage, shopResult, userResult] = await Promise.all([
          discoverProductsOnBackend({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: 0,
            search: trimmed,
            page: 1,
            limit: FETCH_POOL_SIZE,
          }),
          fetchSearchShopsFromNode({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: 0,
            shopQuery: trimmed,
            identityOnly: true,
            page: 1,
            limit: FETCH_POOL_SIZE,
          }),
          idToken
            ? searchUsersOnBackend(idToken, {
                search: trimmed,
                page: 1,
                limit: FETCH_POOL_SIZE,
              }).catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] }),
        ]);

        if (requestIdRef.current !== requestId) {
          return;
        }

        const rawProducts = (productPage.items || []).map((row) => normalizeProduct(row));
        const rawShops = Array.isArray(shopResult?.items)
          ? shopResult.items
          : Array.isArray(shopResult?.shops)
            ? shopResult.shops
            : [];
        const rawUsers = Array.isArray(userResult?.items) ? userResult.items : [];

        const filtered = filterSuggestionCandidates({
          products: rawProducts,
          shops: rawShops,
          users: rawUsers,
          keyword: trimmed,
        });

        const merged = buildSearchSuggestions({
          ...filtered,
          keyword: trimmed,
          limit,
        });

        setItems(merged);
      } catch {
        if (requestIdRef.current === requestId) {
          setItems([]);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [canSuggest, trimmed, location?.latitude, location?.longitude, limit]);

  return {
    items,
    isLoading,
    canSuggest,
    minLength: SEARCH_SUGGEST_MIN_LENGTH,
  };
}
