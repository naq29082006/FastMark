import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const fetchSeqRef = useRef(0);

  const depsKey = useMemo(() => JSON.stringify(deps ?? []), [deps]);

  const reload = useCallback(async ({ silent = false, page: pageOverride, limit: limitOverride } = {}) => {
    const activePage = pageOverride ?? page;
    const activeLimit = limitOverride ?? limit;
    const fetchSeq = ++fetchSeqRef.current;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const payload = await fetcher({ page: activePage, limit: activeLimit });
      if (fetchSeq !== fetchSeqRef.current) {
        return;
      }
      const data = payload?.data || payload || {};
      setItems(data.items || data.rows || data.list || data.withdraws || []);
      setPagination(
        data.pagination || {
          page: data.page ?? activePage,
          limit: data.limit ?? activeLimit,
          total: data.total ?? 0,
          totalPages:
            data.totalPages ??
            Math.max(1, Math.ceil((data.total || 0) / (data.limit || activeLimit || 1))),
        }
      );
      if (data.stats || data.summary) {
        setStats(data.stats || data.summary);
      }
      if (pageOverride != null && pageOverride !== page) {
        setPage(pageOverride);
      }
      if (limitOverride != null && limitOverride !== limit) {
        setLimit(limitOverride);
      }
    } catch (err) {
      if (fetchSeq !== fetchSeqRef.current) {
        return;
      }
      if (!silent) {
        setError(err.message || 'Không tải được dữ liệu.');
        setItems([]);
      }
    } finally {
      if (fetchSeq === fetchSeqRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [fetcher, page, limit]);

  useEffect(() => {
    reload();
  }, [page, limit, depsKey, fetcher]);

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
