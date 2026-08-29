const inflight = new Map();
const pending = new Map();

/**
 * Gom nhiều yêu cầu tải cùng một đơn (realtime / socket) thành một lần gọi API.
 */
export function coalesceReservationFetch(
  role,
  reservationId,
  fetchFn,
  { debounceMs = 500 } = {}
) {
  const id = String(reservationId || '').trim();
  if (!id || typeof fetchFn !== 'function') {
    return Promise.resolve(undefined);
  }

  const key = `${String(role || 'unknown').trim()}:${id}`;

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  return new Promise((resolve, reject) => {
    let bucket = pending.get(key);
    if (!bucket) {
      bucket = { resolvers: [], timer: null };
      pending.set(key, bucket);
    }

    bucket.resolvers.push({ resolve, reject });

    if (bucket.timer) {
      clearTimeout(bucket.timer);
    }

    bucket.timer = setTimeout(async () => {
      const current = pending.get(key);
      pending.delete(key);
      const resolvers = current?.resolvers || [];

      const run = (async () => {
        try {
          return await fetchFn();
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, run);

      try {
        const result = await run;
        resolvers.forEach(({ resolve: done }) => done(result));
      } catch (error) {
        resolvers.forEach(({ reject: fail }) => fail(error));
      }
    }, debounceMs);
  });
}
