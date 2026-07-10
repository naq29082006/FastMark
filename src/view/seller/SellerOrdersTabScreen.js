import { useState } from 'react';
import SellerOrdersScreen from '../seller/SellerOrdersScreen';
import SellerOrderDetailScreen from '../seller/SellerOrderDetailScreen';

export default function SellerOrdersTabScreen() {
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);

  if (selectedReservationId) {
    return (
      <SellerOrderDetailScreen
        reservationId={selectedReservationId}
        onBack={() => setSelectedReservationId(null)}
        onChanged={() => setOrdersRefreshKey((value) => value + 1)}
      />
    );
  }

  return (
    <SellerOrdersScreen
      embedded
      onRefreshKey={ordersRefreshKey}
      onOpenReservation={setSelectedReservationId}
    />
  );
}
