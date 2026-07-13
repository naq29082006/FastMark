export function parseTimeString(value, fallback = '08:00') {
  const source = String(value || fallback).trim();
  const match = source.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    const fallbackMatch = String(fallback).match(/^(\d{1,2}):(\d{2})$/);
    return new Date(
      2000,
      0,
      1,
      Number(fallbackMatch?.[1] || 8),
      Number(fallbackMatch?.[2] || 0)
    );
  }

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return new Date(2000, 0, 1, hours, minutes);
}

export function formatTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
