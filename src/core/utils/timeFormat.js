export function parseTimeString(value, fallback = '08:00') {
  const source = String(value || fallback).trim();
  const match = source.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    const fallbackMatch = String(fallback).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
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

export function snapTimeToMinuteInterval(date, minuteInterval = 1) {
  const step = Math.max(1, Math.min(30, Number(minuteInterval) || 1));
  if (step <= 1) {
    return new Date(date);
  }
  const minuteOptions = [];
  for (let minute = 0; minute < 60; minute += step) {
    minuteOptions.push(minute);
  }
  const snappedMinute = minuteOptions.reduce((best, candidate) =>
    Math.abs(candidate - date.getMinutes()) < Math.abs(best - date.getMinutes())
      ? candidate
      : best
  );
  return new Date(2000, 0, 1, date.getHours(), snappedMinute);
}
