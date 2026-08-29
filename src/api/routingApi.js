import { apiRequest } from './client';
import {
  estimateTravelDurationSeconds,
  getDistanceFromCurrentLocation,
  hasValidLocation,
} from '../core/utils/geo';
import {
  normalizeRoutingProfile,
  ROUTING_PROFILE,
  ROUTING_PROFILE_SPEED_KMH,
} from '../constants/routingProfile';

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const ROUTE_CACHE_TTL_MS = 60 * 1000;
const routeDistanceCache = new Map();
const routeGeometryCache = new Map();

function formatCoordinate(point) {
  return `${Number(point.longitude)},${Number(point.latitude)}`;
}

function buildCacheKey(origin, destination, profile = ROUTING_PROFILE.MOTORBIKE) {
  return [
    normalizeRoutingProfile(profile),
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

function readCachedGeometry(cacheKey) {
  const cached = routeGeometryCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > ROUTE_CACHE_TTL_MS) {
    routeGeometryCache.delete(cacheKey);
    return null;
  }

  return cached.geometry;
}

function writeCachedGeometry(cacheKey, geometry) {
  if (!geometry) {
    return;
  }

  routeGeometryCache.set(cacheKey, {
    geometry,
    cachedAt: Date.now(),
  });
}

function buildStraightLineGeometry(origin, destination, profile = ROUTING_PROFILE.MOTORBIKE) {
  const distanceMeters = getDistanceFromCurrentLocation(origin, destination) || 0;
  const speedKmh = ROUTING_PROFILE_SPEED_KMH[normalizeRoutingProfile(profile)];

  return {
    coordinates: [
      [Number(origin.latitude), Number(origin.longitude)],
      [Number(destination.latitude), Number(destination.longitude)],
    ],
    distanceMeters,
    durationSeconds: estimateTravelDurationSeconds(distanceMeters, speedKmh),
    profile: normalizeRoutingProfile(profile),
    isFallback: true,
  };
}

function normalizeGeometry(raw) {
  if (!raw?.coordinates?.length) {
    return null;
  }

  return {
    coordinates: raw.coordinates,
    distanceMeters: Number(raw.distanceMeters) || 0,
    durationSeconds: Number(raw.durationSeconds) || 0,
    isFallback: Boolean(raw.isFallback),
  };
}

async function parseApiPayload(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    return null;
  }
  return payload?.data || null;
}

async function fetchRouteGeometryFromBackend(origin, destination, profile) {
  const params = new URLSearchParams({
    fromLat: String(origin.latitude),
    fromLng: String(origin.longitude),
    toLat: String(destination.latitude),
    toLng: String(destination.longitude),
    profile: normalizeRoutingProfile(profile),
  });

  const response = await apiRequest(`/api/routing/route?${params.toString()}`, { method: 'GET' });
  const data = await parseApiPayload(response);
  return normalizeGeometry(data);
}

async function fetchRouteGeometryFromOsrm(origin, destination, profile) {
  const osrmProfile = normalizeRoutingProfile(profile) === ROUTING_PROFILE.CAR ? 'driving' : 'driving';
  const url =
    `${OSRM_BASE_URL}/route/v1/${osrmProfile}/` +
    `${formatCoordinate(origin)};${formatCoordinate(destination)}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.code !== 'Ok' || !payload.routes?.[0]) {
    return null;
  }

  const route = payload.routes[0];
  const coordinates = Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates.map((point) => [Number(point[1]), Number(point[0])])
    : [];

  if (coordinates.length < 2) {
    return null;
  }

  return normalizeGeometry({
    coordinates,
    distanceMeters: Number(route.distance) || 0,
    durationSeconds: Number(route.duration) || 0,
    profile: normalizeRoutingProfile(profile),
  });
}

function applyMotorbikeDuration(geometry, profile) {
  if (!geometry || normalizeRoutingProfile(profile) !== ROUTING_PROFILE.MOTORBIKE) {
    return geometry;
  }
  const durationSeconds = Number(geometry.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return geometry;
  }
  return {
    ...geometry,
    durationSeconds: Math.max(60, Math.round(durationSeconds * 0.76)),
  };
}

export async function fetchRouteGeometry(origin, destination, options = {}) {
  if (!hasValidLocation(origin) || !hasValidLocation(destination)) {
    return null;
  }

  const profile = normalizeRoutingProfile(options.profile);
  const cacheKey = buildCacheKey(origin, destination, profile);
  const cachedGeometry = readCachedGeometry(cacheKey);
  if (cachedGeometry) {
    return cachedGeometry;
  }

  let geometry = null;

  try {
    geometry = await fetchRouteGeometryFromBackend(origin, destination, profile);
  } catch {
    geometry = null;
  }

  if (!geometry) {
    try {
      geometry = applyMotorbikeDuration(
        await fetchRouteGeometryFromOsrm(origin, destination, profile),
        profile
      );
    } catch {
      geometry = null;
    }
  }

  if (!geometry) {
    geometry = buildStraightLineGeometry(origin, destination, profile);
  }

  writeCachedGeometry(cacheKey, geometry);
  writeCachedDistance(cacheKey, geometry.distanceMeters);
  return geometry;
}

async function fetchRouteDistanceFromBackend(origin, destination) {
  const params = new URLSearchParams({
    fromLat: String(origin.latitude),
    fromLng: String(origin.longitude),
    toLat: String(destination.latitude),
    toLng: String(destination.longitude),
  });

  const response = await apiRequest(`/api/routing/distance?${params.toString()}`, { method: 'GET' });
  const data = await parseApiPayload(response);
  const distanceMeters = Number(data?.distanceMeters);
  return Number.isFinite(distanceMeters) ? distanceMeters : null;
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

  let distanceMeters = null;

  try {
    distanceMeters = await fetchRouteDistanceFromBackend(origin, destination);
  } catch {
    distanceMeters = null;
  }

  if (distanceMeters == null) {
    try {
      const url =
        `${OSRM_BASE_URL}/route/v1/driving/` +
        `${formatCoordinate(origin)};${formatCoordinate(destination)}?overview=false`;

      const response = await fetch(url);
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.code === 'Ok' && payload.routes?.[0]) {
        distanceMeters = Number(payload.routes[0].distance);
      }
    } catch {
      distanceMeters = null;
    }
  }

  if (!Number.isFinite(distanceMeters)) {
    distanceMeters = getDistanceFromCurrentLocation(origin, destination);
  }

  if (Number.isFinite(distanceMeters)) {
    writeCachedDistance(cacheKey, distanceMeters);
  }

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

  try {
    const params = new URLSearchParams({
      fromLat: String(origin.latitude),
      fromLng: String(origin.longitude),
      destinations: JSON.stringify(
        uncachedDestinations.map((destination) => ({
          id: String(destination.id),
          lat: Number(destination.latitude),
          lng: Number(destination.longitude),
        }))
      ),
    });

    const response = await apiRequest(`/api/routing/table?${params.toString()}`, { method: 'GET' });
    const data = await parseApiPayload(response);
    const distances = data?.distances || {};

    uncachedDestinations.forEach((destination) => {
      const distanceMeters = Number(distances[String(destination.id)]);
      if (!Number.isFinite(distanceMeters)) {
        return;
      }
      result[String(destination.id)] = distanceMeters;
      writeCachedDistance(buildCacheKey(origin, destination), distanceMeters);
    });

    if (Object.keys(distances).length > 0) {
      return result;
    }
  } catch {
    // Fallback per destination below.
  }

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
