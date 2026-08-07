import { RESERVATION_TAB, getReservationTabForStatus } from '../../constants/sellerOrders';
import { hasItemId, removeById, upsertById } from './realtimeList';

/**
 * Cập nhật một dòng đơn sau sự kiện realtime: đúng tab thì ghép lên đầu, sai tab thì gỡ khỏi list.
 */
export function applyReservationRealtimeRow({
  reservation,
  reservationId,
  activeTab,
  search = '',
  currentItems,
  setItems,
  setTotalCount,
}) {
  const id = String(reservationId || reservation?.id || '').trim();
  if (!reservation?.id || !id) {
    return;
  }

  const eventTab = getReservationTabForStatus(reservation.status);
  const belongsToTab = activeTab === RESERVATION_TAB.ALL || eventTab === activeTab;
  const isInList = hasItemId(currentItems, id);
  const hasSearch = String(search || '').trim().length > 0;

  if (!belongsToTab) {
    if (isInList) {
      setItems((current) => removeById(current, id));
      setTotalCount((current) => Math.max(0, current - 1));
    }
    return;
  }

  if (!isInList && hasSearch) {
    return;
  }

  setItems((current) =>
    upsertById(current, reservation, { position: 'start', moveToStartOnUpdate: true })
  );
  if (!isInList) {
    setTotalCount((current) => current + 1);
  }
}

/**
 * Gỡ đơn khỏi list khi payload báo trạng thái không còn thuộc tab (trước khi gọi API).
 */
export function removeReservationIfLeftTab({
  payloadStatus,
  reservationId,
  activeTab,
  currentItems,
  setItems,
  setTotalCount,
}) {
  const id = String(reservationId || '').trim();
  if (!id) {
    return false;
  }

  const eventTab = getReservationTabForStatus(payloadStatus);
  const belongsToTab = activeTab === RESERVATION_TAB.ALL || eventTab === activeTab;
  const isInList = hasItemId(currentItems, id);

  if (!belongsToTab && isInList) {
    setItems((current) => removeById(current, id));
    setTotalCount((current) => Math.max(0, current - 1));
    return true;
  }

  return false;
}

/** Sau thao tác (xác nhận, hủy…): cập nhật dòng tại chỗ rồi tải trang 1 ngầm (không spinner). */
export function syncOrderListAfterMutation({
  reservation,
  reservationId,
  activeTab,
  search = '',
  itemsRef,
  setItems,
  setTotalCount,
  loadOrders,
}) {
  const id = String(reservationId || reservation?.id || '').trim();

  if (reservation?.id) {
    applyReservationRealtimeRow({
      reservation,
      reservationId: id,
      activeTab,
      search,
      currentItems: itemsRef.current,
      setItems,
      setTotalCount,
    });
  } else if (id && hasItemId(itemsRef.current, id)) {
    setItems((current) => removeById(current, id));
    setTotalCount((current) => Math.max(0, current - 1));
  }

  loadOrders({ nextPage: 1, silent: true });
}
