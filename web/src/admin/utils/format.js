export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

export function formatCurrency(value) {
  return `${formatNumber(value)} ₫`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN');
}

export function roleLabel(role) {
  const map = { 1: 'Người mua', 2: 'Người bán', 3: 'Admin' };
  return map[Number(role)] || 'Không rõ';
}

export function statusTagColor(status) {
  if (status === 1 || status === true || status === 'active') return 'success';
  if (status === 0 || status === false || status === 'blocked') return 'error';
  if (status === 2 || status === 'pending') return 'warning';
  return 'default';
}

export function reservationStatusLabel(status) {
  const map = {
    0: 'Chờ xác nhận',
    1: 'Giữ hàng',
    2: 'Giữ hàng',
    3: 'Hoàn thành',
    4: 'Tranh chấp',
    5: 'Hoàn thành',
    6: 'Đã hủy',
  };
  return map[Number(status)] || 'Không rõ';
}

export function disputeStatusLabel(status) {
  const map = {
    0: 'Chờ xử lý',
    1: 'Chấp nhận buyer',
    2: 'Chấp nhận seller',
    3: 'Từ chối',
    4: 'Đóng',
  };
  return map[Number(status)] || 'Không rõ';
}

export function walletTxTypeLabel(type) {
  const map = {
    1: 'Nạp tiền',
    2: 'Thanh toán',
    3: 'Hoàn tiền',
    4: 'Rút tiền',
    5: 'Giữ cọc',
    6: 'Hoàn cọc',
    7: 'Giải ngân cọc',
  };
  return map[Number(type)] || `Loại ${type}`;
}

export function verificationStatusLabel(status) {
  const map = { 0: 'Chờ duyệt', 1: 'Đã duyệt', 2: 'Từ chối' };
  return map[Number(status)] || 'Không rõ';
}
