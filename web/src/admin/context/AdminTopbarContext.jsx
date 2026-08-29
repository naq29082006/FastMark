import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminTopbarContext = createContext(null);

/** Mục breadcrumb trên topbar (vd. Người dùng › tên). */
export function AdminTopbarProvider({ children }) {
  const [trail, setTrailState] = useState(null);

  const setTrail = useCallback((next) => {
    setTrailState(next);
  }, []);

  const clearTrail = useCallback(() => {
    setTrailState(null);
  }, []);

  const value = useMemo(
    () => ({ trail, setTrail, clearTrail }),
    [trail, setTrail, clearTrail]
  );

  return <AdminTopbarContext.Provider value={value}>{children}</AdminTopbarContext.Provider>;
}

export function useAdminTopbar() {
  const ctx = useContext(AdminTopbarContext);
  if (!ctx) {
    throw new Error('useAdminTopbar must be used within AdminTopbarProvider');
  }
  return ctx;
}
