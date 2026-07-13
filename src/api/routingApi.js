import { hasValidLocation } from '../core/utils/geo';

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const ROUTE_CACHE_TTL_MS = 60 * 1000;
const routeDistanceCache = new Map();

function formatCoordinate(point) {
  return `${Number(point.longitude)},${Number(point.latitude)}`;
}

function buildCacheKey(origin, destination) {
  return [
    Number(origin.longitude).toFixed(4),
    Number(origin.latitude).toFixed(4),
    Number(destination.longitude).toFixed(4),
    Number(destination.latitude).toFixed(4),
  ].join(':');
}

function readCachedDistance(cacheKey) {
  const cached = routeDistanceCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > ROUTE_CACHE_TTL_MS) {
    routeDistanceCache.delete(cacheKey);
    return null;
  }

  return cached.distanceMeters;
}

function writeCachedDistance(cacheKey, distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return;
  }

  routeDistanceCache.set(cacheKey, {
    distanceMeters,
    cachedAt: Date.now(),
  });
}

export async function fetchRouteDistanceMeters(origin, destination) {
  if (!hasValidLocation(origin) || !hasValidLocation(destination)) {
    return null;
  }

  const cacheKey = buildCacheKey(origin, destination);
  const cachedDistance = readCachedDistance(cacheKey);
  if (cachedDistance != null) {
    return cachedDistance;
  }

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${formatCoordinate(origin)};${formatCoordinate(destination)}?overview=false`;

  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.code !== 'Ok' || !payload.routes?.[0]) {
    return null;
  }

  const distanceMeters = Number(payload.routes[0].distance);
  if (!Number.isFinite(distanceMeters)) {
    return null;
  }

  writeCachedDistance(cacheKey, distanceMeters);
  return distanceMeters;
}

export async function fetchRouteDistancesFromOrigin(origin, destinations = []) {
  if (!hasValidLocation(origin)) {
    return {};
  }

  const validDestinations = destinations.filter(
    (destination) => destination?.id && hasValidLocation(destination)
  );

  if (validDestinations.length === 0) {
    return {};
  }

  if (validDestinations.length === 1) {
    const destination = validDestinations[0];
    const distanceMeters = await fetchRouteDistanceMeters(origin, destination);
    return distanceMeters == null ? {} : { [String(destination.id)]: distanceMeters };
  }

  const uncachedDestinations = [];
  const result = {};

  validDestinations.forEach((destination) => {
    const cacheKey = buildCacheKey(origin, destination);
    const cachedDistance = readCachedDistance(cacheKey);
    if (cachedDistance != null) {
      result[String(destination.id)] = cachedDistance;
      return;
    }
    uncachedDestinations.push(destination);
  });

  if (uncachedDestinations.length === 0) {
    return result;
  }

  const coordinates = [formatCoordinate(origin), ...uncachedDestinations.map(formatCoordinate)].join(
    ';'
  );
  const destinationIndices = uncachedDestinations.map((_, index) => index + 1).join(';');
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coordinates}` +
    `?sources=0&destinations=${destinationIndices}&annotations=distance`;

  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.code !== 'Ok' || !Array.isArray(payload.distances?.[0])) {
    await Promise.all(
      uncachedDestinations.map(async (destination) => {
        const distanceMeters = await fetchRouteDistanceMeters(origin, destination);
        if (distanceMeters != null) {
          result[String(destination.id)] = distanceMeters;
        }
      })
    );
    return result;
  }

  uncachedDestinations.forEach((destination, index) => {
    const distanceMeters = Number(payload.distances[0][index]);
    if (!Number.isFinite(distanceMeters)) {
      return;
    }

    result[String(destination.id)] = distanceMeters;
    writeCachedDistance(buildCacheKey(origin, destination), distanceMeters);
  });

  return result;
}
