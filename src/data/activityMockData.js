export const MOCK_RESERVATIONS = [
  {
    id: 'r1',
    storeId: '1',
    productName: 'Cà phê sữa đá',
    storeName: 'Cà phê Vy',
    quantity: 2,
    reservedAt: '2026-07-05T10:30:00',
    expiresAt: '2026-07-05T11:30:00',
    status: 'active',
  },
  {
    id: 'r2',
    storeId: '4',
    productName: 'Trà sữa trân châu đường đen',
    storeName: 'Trà Sữa Gong Cha',
    quantity: 1,
    reservedAt: '2026-07-04T15:00:00',
    expiresAt: '2026-07-04T16:00:00',
    status: 'picked_up',
  },
  {
    id: 'r3',
    storeId: '2',
    productName: 'Bánh mì thịt nướng',
    storeName: 'Bánh Mì Huỳnh Hoa',
    quantity: 3,
    reservedAt: '2026-07-03T12:00:00',
    expiresAt: '2026-07-03T13:00:00',
    status: 'expired',
  },
];

export const MOCK_VISITED_STORES = [
  {
    id: 'v1',
    storeId: '1',
    storeName: 'Cà phê Vy',
    address: '277 Phan Xích Long, Q. Phú Nhuận',
    type: 'cafe',
    visitedAt: '2026-07-06T14:20:00',
  },
  {
    id: 'v2',
    storeId: '2',
    storeName: 'Bánh Mì Huỳnh Hoa',
    address: '26 Lê Thị Riêng, Q.1',
    type: 'food',
    visitedAt: '2026-07-05T11:45:00',
  },
  {
    id: 'v3',
    storeId: '4',
    storeName: 'Trà Sữa Gong Cha',
    address: '79 Hồ Tùng Mậu, Q.1',
    type: 'milktea',
    visitedAt: '2026-07-04T16:30:00',
  },
  {
    id: 'v4',
    storeId: '3',
    storeName: 'Phở Lệ',
    address: '415 Nguyễn Trãi, Q.5',
    type: 'food',
    visitedAt: '2026-07-02T07:15:00',
  },
];

export const MOCK_PURCHASES = [
  {
    id: 'pur1',
    orderCode: '#FM-88301',
    storeId: '1',
    productName: 'Cà phê sữa đá',
    storeName: 'Cà phê Vy',
    price: 35000,
    quantity: 2,
    purchasedAt: '2026-07-04T08:15:00',
    imageEmoji: '☕',
  },
  {
    id: 'pur2',
    orderCode: '#FM-88302',
    storeId: '2',
    productName: 'Bánh mì thịt nướng',
    storeName: 'Bánh Mì Huỳnh Hoa',
    price: 65000,
    quantity: 1,
    purchasedAt: '2026-07-03T12:30:00',
    imageEmoji: '🥖',
  },
  {
    id: 'pur3',
    orderCode: '#FM-88303',
    storeId: '4',
    productName: 'Trà sữa trân châu đường đen',
    storeName: 'Trà Sữa Gong Cha',
    price: 55000,
    quantity: 1,
    purchasedAt: '2026-07-01T17:00:00',
    imageEmoji: '🧋',
  },
  {
    id: 'pur4',
    orderCode: '#FM-88304',
    storeId: '3',
    productName: 'Phở bò tái',
    storeName: 'Phở Lệ',
    price: 75000,
    quantity: 1,
    purchasedAt: '2026-06-28T07:30:00',
    imageEmoji: '🍜',
  },
];

const STORE_TYPE_EMOJI = {
  cafe: '☕',
  food: '🍜',
  milktea: '🧋',
  snack: '🍿',
};

const RESERVATION_STATUS_LABEL = {
  active: 'Đang giữ',
  picked_up: 'Đã nhận',
  expired: 'Hết hạn',
};

export function getStoreTypeEmoji(type) {
  return STORE_TYPE_EMOJI[type] || '🏪';
}

export function getReservationStatusLabel(status) {
  return RESERVATION_STATUS_LABEL[status] || status;
}
