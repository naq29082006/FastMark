const DEFAULT_LOCATION = {
  latitude: 10.7769,
  longitude: 106.7009,
};

const MAP_EVENT_SOURCE = 'fastmark-map';

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function createLeafletHtml({ currentLocation = null } = {}) {
  const initialLocation = currentLocation || DEFAULT_LOCATION;
  const initialData = safeJson({ currentLocation: initialLocation });

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html,
      body,
      #map {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #eef2f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #eef2f0;
      }

      .leaflet-control-attribution {
        border-radius: 8px 0 0 0;
        color: #50615c;
        font-size: 10px;
      }

      .user-marker {
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #0f766e;
        border: 4px solid #ffffff;
        box-shadow: 0 8px 24px rgba(15, 118, 110, 0.3);
      }

      .user-marker::after {
        content: "";
        position: absolute;
        inset: 7px;
        border-radius: 999px;
        background: #f7c948;
      }

      .measure-marker {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #f97316;
        border: 3px solid #ffffff;
        color: #ffffff;
        font-weight: 800;
        font-size: 13px;
        box-shadow: 0 8px 18px rgba(249, 115, 22, 0.32);
      }

      .measure-label {
        display: inline-flex;
        white-space: nowrap;
        transform: translate(-50%, -50%);
        padding: 5px 8px;
        border-radius: 8px;
        background: rgba(17, 24, 39, 0.86);
        color: #ffffff;
        font-size: 12px;
        font-weight: 750;
        box-shadow: 0 8px 20px rgba(17, 24, 39, 0.22);
      }

      .leaflet-bottom.leaflet-right {
        margin-bottom: 154px;
      }

      .hint {
        position: absolute;
        top: 72px;
        left: 16px;
        right: 16px;
        z-index: 600;
        display: none;
        justify-content: center;
        pointer-events: none;
      }

      .hint span {
        max-width: 320px;
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.94);
        color: #182421;
        font-size: 13px;
        font-weight: 650;
        text-align: center;
        box-shadow: 0 10px 30px rgba(24, 36, 33, 0.16);
      }

      .hint.visible {
        display: flex;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="hint" class="hint">
      <span>Cham tren ban do de them diem do khoang cach</span>
    </div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const EVENT_SOURCE = '${MAP_EVENT_SOURCE}';
      const initialData = ${initialData};
      const fallbackLocation = ${safeJson(DEFAULT_LOCATION)};

      let currentMarker = null;
      let accuracyCircle = null;
      let measureEnabled = false;
      let measurePoints = [];
      let measureMarkers = [];
      let measureLabels = [];
      let measureLine = null;
      let userMovedMap = false;

      function hasLocation(value) {
        return (
          value &&
          Number.isFinite(Number(value.latitude)) &&
          Number.isFinite(Number(value.longitude))
        );
      }

      function getLatLng(location) {
        return [Number(location.latitude), Number(location.longitude)];
      }

      function toLocation(latLng) {
        return {
          latitude: Number(latLng.lat),
          longitude: Number(latLng.lng),
        };
      }

      function formatDistance(distanceMeters) {
        const distance = Number(distanceMeters);

        if (!Number.isFinite(distance)) {
          return '--';
        }

        if (distance >= 1000) {
          return (distance / 1000).toFixed(distance >= 10000 ? 1 : 2) + ' km';
        }

        return Math.round(distance) + ' m';
      }

      function postToApp(payload) {
        const message = { source: EVENT_SOURCE, payload };

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
          return;
        }

        window.parent.postMessage(message, '*');
      }

      const startLocation = hasLocation(initialData.currentLocation)
        ? initialData.currentLocation
        : fallbackLocation;

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
      }).setView(getLatLng(startLocation), 15);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const userIcon = L.divIcon({
        className: '',
        html: '<div class="user-marker"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      function drawCurrentLocation(location, options) {
        if (!hasLocation(location)) {
          return;
        }

        const latLng = getLatLng(location);
        const accuracy = Number(location.accuracy);

        if (!currentMarker) {
          currentMarker = L.marker(latLng, { icon: userIcon, interactive: false }).addTo(map);
        } else {
          currentMarker.setLatLng(latLng);
        }

        if (Number.isFinite(accuracy) && accuracy > 0) {
          if (!accuracyCircle) {
            accuracyCircle = L.circle(latLng, {
              radius: accuracy,
              color: '#0f766e',
              weight: 1,
              opacity: 0.55,
              fillColor: '#14b8a6',
              fillOpacity: 0.12,
              interactive: false,
            }).addTo(map);
          } else {
            accuracyCircle.setLatLng(latLng);
            accuracyCircle.setRadius(accuracy);
          }
        }

        if (options && options.recenter) {
          userMovedMap = false;
          map.setView(latLng, Math.max(map.getZoom(), 16), { animate: true });
        }
      }

      function getMeasureDistance() {
        return measurePoints.reduce(function(total, point, index) {
          if (index === 0) {
            return 0;
          }

          return total + point.distanceTo(measurePoints[index - 1]);
        }, 0);
      }

      function makeMeasureIcon(index) {
        return L.divIcon({
          className: '',
          html: '<div class="measure-marker">' + index + '</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
      }

      function clearLayerList(layers) {
        layers.forEach(function(layer) {
          map.removeLayer(layer);
        });
        layers.length = 0;
      }

      function renderMeasurements() {
        clearLayerList(measureMarkers);
        clearLayerList(measureLabels);

        if (measureLine) {
          map.removeLayer(measureLine);
          measureLine = null;
        }

        measurePoints.forEach(function(point, index) {
          measureMarkers.push(
            L.marker(point, {
              icon: makeMeasureIcon(index + 1),
              zIndexOffset: 600,
            }).addTo(map)
          );

          if (index > 0) {
            const previousPoint = measurePoints[index - 1];
            const middlePoint = L.latLng(
              (previousPoint.lat + point.lat) / 2,
              (previousPoint.lng + point.lng) / 2
            );
            const segmentDistance = point.distanceTo(previousPoint);

            measureLabels.push(
              L.marker(middlePoint, {
                interactive: false,
                icon: L.divIcon({
                  className: '',
                  html: '<span class="measure-label">' + formatDistance(segmentDistance) + '</span>',
                  iconSize: [1, 1],
                  iconAnchor: [0, 0],
                }),
              }).addTo(map)
            );
          }
        });

        if (measurePoints.length > 1) {
          measureLine = L.polyline(measurePoints, {
            color: '#f97316',
            weight: 5,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
        }

        const totalDistance = getMeasureDistance();
        const lastPoint = measurePoints.length ? toLocation(measurePoints[measurePoints.length - 1]) : null;

        postToApp({
          type: 'measurement',
          pointCount: measurePoints.length,
          distance: totalDistance,
          formattedDistance: formatDistance(totalDistance),
          lastPoint,
        });
      }

      function addMeasurePoint(latLng) {
        measurePoints.push(L.latLng(latLng.lat, latLng.lng));
        renderMeasurements();
      }

      function clearMeasurements() {
        measurePoints = [];
        renderMeasurements();
      }

      function setMeasureEnabled(enabled) {
        measureEnabled = Boolean(enabled);
        document.getElementById('hint').classList.toggle('visible', measureEnabled);
        postToApp({ type: 'measureMode', enabled: measureEnabled });
      }

      function receive(command) {
        if (!command || !command.type) {
          return;
        }

        if (command.type === 'location') {
          drawCurrentLocation(command.location, { recenter: command.recenter });
        }

        if (command.type === 'measureMode') {
          setMeasureEnabled(command.enabled);
        }

        if (command.type === 'clearMeasure') {
          clearMeasurements();
        }

        if (command.type === 'recenter' && hasLocation(command.location)) {
          drawCurrentLocation(command.location, { recenter: true });
        }
      }

      window.FastmarkMap = { receive };

      window.addEventListener('message', function(event) {
        const data = event.data || {};
        const command = data.source === 'fastmark-map-command' ? data.payload : data;
        receive(command);
      });

      map.on('click', function(event) {
        if (measureEnabled) {
          addMeasurePoint(event.latlng);
          return;
        }

        postToApp({
          type: 'mapTap',
          location: toLocation(event.latlng),
        });
      });

      map.on('dragstart zoomstart', function() {
        userMovedMap = true;
      });

      drawCurrentLocation(startLocation, { recenter: false });
      postToApp({ type: 'ready' });
      renderMeasurements();
    </script>
  </body>
</html>`;
}

export { MAP_EVENT_SOURCE };
