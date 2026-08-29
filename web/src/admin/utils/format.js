export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

export function formatCurrency(value) {
  return `${formatNumber(value)} ₫`;
}

/** Phần trăm hiển thị đúng số thập phân (vd. 13,35%) — không làm tròn số nguyên. */
export function formatPercent(value, fractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  const formatted = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
  return `${formatted}%`;
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
    2: 'Đã nhận hàng',
    3: 'Tranh chấp',
    4: 'Hoàn thành',
    5: 'Đã hủy',
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

export function walletTxStatusLabel(status) {
  const map = {
    0: 'Chờ xử lý',
    1: 'Thành công',
    2: 'Thất bại',
    3: 'Đã hủy',
  };
  return map[Number(status)] || 'Không rõ';
}

export function verificationStatusLabel(status) {
  const map = { 0: 'Chờ duyệt', 1: 'Đang hoạt động', 2: 'Từ chối' };
  return map[Number(status)] || 'Không rõ';
}

export function sellerAdminStatusLabel(record) {
  const status = Number(record?.status ?? record);
  const shopStatus = record?.shopStatus != null ? Number(record.shopStatus) : null;

  if (status === 0) return 'Chờ duyệt';
  if (status === 2) return 'Từ chối';
  if (status === 1) {
    return shopStatus === 0 ? 'Đã khóa' : 'Đang hoạt động';
  }
  return verificationStatusLabel(status);
}

export function sellerAdminStatusTagColor(record) {
  const label = sellerAdminStatusLabel(record);
  if (label === 'Đang hoạt động') return 'success';
  if (label === 'Đã khóa' || label === 'Từ chối') return 'error';
  if (label === 'Chờ duyệt') return 'warning';
  return 'default';
}

export function sellerAdminStatusBadgeClass(record) {
  const label = sellerAdminStatusLabel(record);
  if (label === 'Đang hoạt động') return 'badge badge-success';
  if (label === 'Đã khóa' || label === 'Từ chối') return 'badge badge-danger';
  return 'badge badge-warning';
}

/** Hồ sơ đã duyệt (kể cả gian hàng bị khóa) → profile gian hàng; còn lại → hồ sơ đăng ký. */
export function resolveSellerAdminDetailPath(record) {
  const verificationId = record?.id || record?._id;
  const shopId = record?.shopId || record?.shop?.id;
  const status = Number(record?.status);

  if (status === 1 && shopId) {
    return `/sellers/shops/${shopId}`;
  }

  if (verificationId) {
    return `/sellers/${verificationId}`;
  }

  return shopId ? `/sellers/shops/${shopId}` : null;
}

export function shopStatusLabel(status) {
  const map = { 0: 'Đã khóa', 1: 'Hoạt động' };
  return map[Number(status)] || '';
}
