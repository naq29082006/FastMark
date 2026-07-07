import * as Location from 'expo-location';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_USER_AGENT = 'Fastmark/1.0 (mobile app)';

function normalizeResult(item) {
  return {
    id: String(item.id),
    label: item.label,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
  };
}

function normalizeNominatimResult(item) {
  return normalizeResult({
    id: item.place_id,
    label: item.display_name,
    latitude: item.lat,
    longitude: item.lon,
  });
}

async function searchWithNominatim(query, limit = 6) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: String(limit),
    addressdetails: '1',
    countrycodes: 'vn',
  });

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
    headers: {
      'Accept-Language': 'vi',
      'User-Agent': SEARCH_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error('Không tìm được địa chỉ.');
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map(normalizeNominatimResult);
}

async function searchWithDeviceGeocoder(query) {
  const results = await Location.geocodeAsync(query);

  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results.map((item, index) =>
    normalizeResult({
      id: `device-${index}-${item.latitude}-${item.longitude}`,
      label: query,
      latitude: item.latitude,
      longitude: item.longitude,
    })
  );
}

export async function searchAddressesRemote(query, { limit = 6 } = {}) {
  const trimmed = query?.trim();

  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  try {
    const nominatimResults = await searchWithNominatim(trimmed, limit);

    if (nominatimResults.length > 0) {
      return nominatimResults;
    }
  } catch {
    // Fall back to the device geocoder when Nominatim is unavailable.
  }

  try {
    return await searchWithDeviceGeocoder(trimmed);
  } catch {
    throw new Error('Không tìm được địa chỉ. Thử nhập rõ hơn.');
  }
}
