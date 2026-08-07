import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

/** Đọc query string từ URL cho filter sidebar submenu. */
export function useUrlQueryString(key) {
  const [params] = useSearchParams();
  return useMemo(() => {
    const value = params.get(key);
    return value === null || value === '' ? undefined : value;
  }, [params, key]);
}

export function useUrlQueryNumber(key) {
  const raw = useUrlQueryString(key);
  if (raw === undefined) return undefined;
  const num = Number(raw);
  return Number.isNaN(num) ? undefined : num;
}
