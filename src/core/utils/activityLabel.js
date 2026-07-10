export function formatActivityLabel(isOnline, lastActiveAt) {
  if (isOnline) {
    return 'Đang hoạt động';
  }

  if (!lastActiveAt) {
    return 'Không rõ';
  }

  const value = new Date(lastActiveAt);
  if (Number.isNaN(value.getTime())) {
    return 'Không rõ';
  }

  const diffMs = Date.now() - value.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return 'Vừa hoạt động';
  }
  if (minutes < 60) {
    return `Hoạt động ${minutes} phút trước`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Hoạt động ${hours} giờ trước`;
  }

  const days = Math.floor(hours / 24);
  return `Hoạt động ${days} ngày trước`;
}
