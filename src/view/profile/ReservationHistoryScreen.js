import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';

export default function ReservationHistoryScreen({ onBack, onOpenStore }) {
  return (
    <BuyerOrdersScreen embedded={false} onBack={onBack} onOpenStore={onOpenStore} />
  );
}
