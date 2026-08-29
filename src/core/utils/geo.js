export function hasValidLocation(location) {
  return (
    location &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
  );
}

export function normalizeExpoLocation(location) {
  if (!location?.coords) {
    return null;
  }

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp || Date.now(),
  };
}

export function calculateDistanceMeters(start, end) {
  if (!hasValidLocation(start) || !hasValidLocation(end)) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const startLat = (Number(start.latitude) * Math.PI) / 180;
  const endLat = (Number(end.latitude) * Math.PI) / 180;
  const deltaLat = ((Number(end.latitude) - Number(start.latitude)) * Math.PI) / 180;
  const deltaLng = ((Number(end.longitude) - Number(start.longitude)) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

/**
 * Khoảng cách chuẩn từ vị trí hiện tại tới điểm đích (Haversine, làm tròn mét).
 * Khám phá, Chỉ đường và chi tiết gian hàng đều dùng hàm này.
 */
export function getDistanceFromCurrentLocation(currentLocation, destination) {
  const meters = calculateDistanceMeters(currentLocation, destination);
  if (!Number.isFinite(meters)) {
    return null;
  }
  return Math.round(meters);
}

export function estimateTravelDurationSeconds(distanceMeters, speedKmh = 30) {
  const meters = Number(distanceMeters);
  if (!Number.isFinite(meters) || meters <= 0) {
    return 0;
  }
  const speed = Number(speedKmh) > 0 ? Number(speedKmh) : 30;
  const metersPerSecond = (speed * 1000) / 3600;
  return Math.max(60, Math.ceil(meters / metersPerSecond));
}

export function computeBearingDegrees(from, to) {
  if (!hasValidLocation(from) || !hasValidLocation(to)) {
    return null;
  }

  const lat1 = (Number(from.latitude) * Math.PI) / 180;
  const lat2 = (Number(to.latitude) * Math.PI) / 180;
  const deltaLng = ((Number(to.longitude) - Number(from.longitude)) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function resolveNavigationHeading(location, previousLocation) {
  const heading = Number(location?.heading);
  if (Number.isFinite(heading) && heading >= 0 && heading <= 360) {
    return heading;
  }

  const bearing = computeBearingDegrees(previousLocation, location);
  return Number.isFinite(bearing) ? bearing : null;
}

export function formatDistanceLabel(distanceMeters) {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance)) {
    return '--';
  }
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1).replace(/\.0$/, '')} km`;
  }
  return `${Math.round(distance)} m`;
}

export function formatNearbyDistanceLabel(distanceMeters) {
  const label = formatDistanceLabel(distanceMeters);
  if (label === '--') {
    return '--';
  }
  return `Cách ${label.replace(' ', '')}`;
}

export function formatDistance(distanceMeters) {
  const distance = Number(distanceMeters);

  if (!Number.isFinite(distance)) {
    return '--';
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(distance >= 10000 ? 1 : 2)} km`;
  }

  return `${Math.round(distance)} m`;
}

export function formatCoordinate(value) {
  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return '--';
  }

  return coordinate.toFixed(6);
}
