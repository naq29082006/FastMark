export const ADMIN_PENDING_COUNTS_EVENT = 'fastmark-admin-pending-counts-changed';

export function notifyAdminPendingCountsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_PENDING_COUNTS_EVENT));
  }
}
