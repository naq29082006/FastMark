import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePaginatedQuery({ fetcher, deps = [], initialPage = 1, initialLimit = 10 }) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState(null);

  const depsKey = useMemo(() => JSON.stringify(deps ?? []), [deps]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetcher({ page, limit });
      const data = payload?.data || payload || {};
      setItems(data.items || data.rows || data.list || data.withdraws || []);
      setPagination(
        data.pagination || {
          page: data.page ?? page,
          limit: data.limit ?? limit,
          total: data.total ?? 0,
          totalPages:
            data.totalPages ??
            Math.max(1, Math.ceil((data.total || 0) / (data.limit || limit || 1))),
        }
      );
      if (data.stats || data.summary) {
        setStats(data.stats || data.summary);
      }
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, limit]);

  useEffect(() => {
    reload();
  }, [reload, depsKey]);

  return {
    page,
    setPage,
    limit,
    setLimit,
    loading,
    error,
    items,
    pagination,
    stats,
    reload,
  };
}
