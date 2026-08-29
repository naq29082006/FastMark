import OrderStatusTabBar from './OrderStatusTabBar';
import { DISPUTE_SUB_TABS } from '../../../constants/sellerOrders';

export default function DisputeSubTabBar({ activeSubTab, onChangeSubTab }) {
  return (
    <OrderStatusTabBar
      tabs={DISPUTE_SUB_TABS}
      activeTab={activeSubTab}
      onChangeTab={onChangeSubTab}
      equalWidth
    />
  );
}
