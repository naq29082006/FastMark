import { useCallback, useEffect, useRef } from 'react';

/** Tránh mở lại picker ngay sau khi bấm Hủy / đóng (touch “rơi” xuống nút mở). */
const DISMISS_LOCK_MS = 450;

export function usePickerDismissGuard() {
  const lockedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const guardOpen = useCallback((openFn) => {
    if (lockedRef.current) {
      return;
    }
    openFn();
  }, []);

  const closeWithGuard = useCallback((closeFn) => {
    lockedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    closeFn();
    timerRef.current = setTimeout(() => {
      lockedRef.current = false;
      timerRef.current = null;
    }, DISMISS_LOCK_MS);
  }, []);

  return { guardOpen, closeWithGuard };
}
