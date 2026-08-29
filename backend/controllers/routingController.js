const routingService = require("../services/routingService");
const { success, fail } = require("../utils/apiResponse");

function readCoordinate(query, latKey, lngKey) {
  return {
    lat: Number(query[latKey] ?? query.latitude),
    lng: Number(query[lngKey] ?? query.longitude),
  };
}

exports.getRoute = async (req, res) => {
  const from = readCoordinate(req.query, "fromLat", "fromLng");
  const to = readCoordinate(req.query, "toLat", "toLng");

  const geometry = await routingService.fetchRouteGeometry({
    fromLat: from.lat,
    fromLng: from.lng,
    toLat: to.lat,
    toLng: to.lng,
    profile: req.query.profile,
  });

  if (!geometry?.coordinates?.length) {
    return fail(res, { status: 502, message: "Không tính được lộ trình." });
  }

  return success(res, { data: geometry });
};

exports.getRouteDistance = async (req, res) => {
  const from = readCoordinate(req.query, "fromLat", "fromLng");
  const to = readCoordinate(req.query, "toLat", "toLng");

  const distanceMeters = await routingService.fetchRouteDistanceMeters({
    fromLat: from.lat,
    fromLng: from.lng,
    toLat: to.lat,
    toLng: to.lng,
  });

  if (!Number.isFinite(distanceMeters)) {
    return fail(res, { status: 502, message: "Không tính được khoảng cách." });
  }

  return success(res, { data: { distanceMeters } });
};

exports.getRouteTable = async (req, res) => {
  const from = readCoordinate(req.query, "fromLat", "fromLng");
  let destinations = [];

  try {
    destinations = JSON.parse(String(req.query.destinations || "[]"));
  } catch {
    destinations = [];
  }

  const distances = await routingService.fetchRouteDistancesFromOrigin({
    fromLat: from.lat,
    fromLng: from.lng,
    destinations: Array.isArray(destinations) ? destinations : [],
  });

  return success(res, { data: { distances } });
};
