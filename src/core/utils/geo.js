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
