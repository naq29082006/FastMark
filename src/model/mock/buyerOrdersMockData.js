export const MOCK_BUYER_DEALS = [
  {
    id: 'deal-1',
    productName: 'Cam sành Tiền Giang',
    variantName: 'Loại A - 1kg',
    storeName: 'Nông sản Vy',
    storeId: '1',
    originalPrice: 45000,
    offeredPrice: 40000,
    sellerCounterPrice: 42000,
  },
  {
    id: 'deal-2',
    productName: 'Gạo ST25 túi 5kg',
    variantName: 'Túi 5kg',
    storeName: 'Gian hàng Bắc Bộ',
    storeId: '2',
    originalPrice: 120000,
    offeredPrice: 110000,
    sellerCounterPrice: null,
  },
];

export const MOCK_BUYER_RESERVATIONS = [
  {
    id: 'r-hold-1',
    tab: 'holding',
    storeId: '1',
    productName: 'Cà phê sữa đá',
    storeName: 'Cà phê Vy',
    variantName: 'Size M',
    quantity: 2,
    totalAmount: 70000,
    reservedAt: '2026-07-05T10:30:00',
    expiresAt: '2026-07-05T11:30:00',
    pickupTime: '2026-07-05T11:00:00',
    status: 'holding',
  },
  {
    id: 'r-hold-2',
    tab: 'holding',
    storeId: '4',
    productName: 'Trà sữa trân châu',
    storeName: 'Trà Sữa Gong Cha',
    variantName: 'Size L',
    quantity: 1,
    totalAmount: 55000,
    reservedAt: '2026-07-08T15:00:00',
    expiresAt: '2026-07-08T16:00:00',
    pickupTime: '2026-07-08T15:30:00',
    status: 'holding',
  },
  {
    id: 'r-cancel-1',
    tab: 'cancelled',
    storeId: '2',
    productName: 'Bánh mì thịt nướng',
    storeName: 'Bánh Mì Huỳnh Hoa',
    variantName: 'Đặc biệt',
    quantity: 3,
    totalAmount: 195000,
    reservedAt: '2026-07-03T12:00:00',
    expiresAt: '2026-07-03T13:00:00',
    pickupTime: null,
    status: 'cancelled',
  },
  {
    id: 'r-done-1',
    tab: 'completed',
    storeId: '4',
    productName: 'Trà sữa trân châu đường đen',
    storeName: 'Trà Sữa Gong Cha',
    variantName: 'Size M',
    quantity: 1,
    totalAmount: 55000,
    reservedAt: '2026-07-04T15:00:00',
    expiresAt: '2026-07-04T16:00:00',
    pickupTime: '2026-07-04T15:20:00',
    status: 'completed',
  },
  {
    id: 'r-done-2',
    tab: 'completed',
    storeId: '3',
    productName: 'Phở bò tái',
    storeName: 'Phở Lệ',
    variantName: 'Tái nạm',
    quantity: 1,
    totalAmount: 75000,
    reservedAt: '2026-06-28T07:30:00',
    expiresAt: '2026-06-28T08:30:00',
    pickupTime: '2026-06-28T07:45:00',
    status: 'completed',
  },
];

export function getBuyerOrdersForTab(tab) {
  if (tab === 'pending_price') {
    return { deals: MOCK_BUYER_DEALS, reservations: [] };
  }

  return {
    deals: [],
    reservations: MOCK_BUYER_RESERVATIONS.filter((item) => item.tab === tab),
  };
}
