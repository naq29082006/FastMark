function resolveShopLatlong(source = {}) {
  const nested = source?.latlong;
  if (nested && typeof nested === "object") {
    const lat = Number(nested.lat);
    const long = Number(nested.long ?? nested.lng);
    if (Number.isFinite(lat) && Number.isFinite(long)) {
      return { lat, long };
    }
  }

  const lat = Number(source.latitude ?? source.lat);
  const long = Number(source.longitude ?? source.lng ?? source.long);
  if (Number.isFinite(lat) && Number.isFinite(long)) {
    return { lat, long };
  }

  return { lat: null, long: null };
}

function hasShopLatlong(source = {}) {
  const { lat, long } = resolveShopLatlong(source);
  return Number.isFinite(lat) && Number.isFinite(long);
}

/** Mongo filter: shop có tọa độ (latlong lồng hoặc latitude/longitude phẳng). */
function shopHasCoordinatesFilter() {
  return {
    $or: [
      {
        "latlong.lat": { $ne: null },
        "latlong.long": { $ne: null },
      },
      {
        latitude: { $ne: null },
        longitude: { $ne: null },
      },
    ],
  };
}

function applyShopLatlongFromPayload(shop, payload = {}) {
  if (payload.latlong !== undefined) {
    const coords = resolveShopLatlong(payload);
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.long)) {
      const error = new Error("Tọa độ không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }
    shop.latlong = coords;
    shop.markModified("latlong");
    return coords;
  }

  const current = resolveShopLatlong(shop);
  let lat = current.lat;
  let long = current.long;
  let changed = false;

  if (payload.latitude !== undefined || payload.lat !== undefined) {
    const nextLat = Number(payload.latitude ?? payload.lat);
    if (!Number.isFinite(nextLat)) {
      const error = new Error("Tọa độ vĩ độ không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }
    lat = nextLat;
    changed = true;
  }

  if (payload.longitude !== undefined || payload.lng !== undefined || payload.long !== undefined) {
    const nextLong = Number(payload.longitude ?? payload.lng ?? payload.long);
    if (!Number.isFinite(nextLong)) {
      const error = new Error("Tọa độ kinh độ không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }
    long = nextLong;
    changed = true;
  }

  if (changed) {
    shop.latlong = { lat, long };
    shop.markModified("latlong");
  }

  return resolveShopLatlong(shop);
}

module.exports = {
  resolveShopLatlong,
  hasShopLatlong,
  shopHasCoordinatesFilter,
  applyShopLatlongFromPayload,
};
