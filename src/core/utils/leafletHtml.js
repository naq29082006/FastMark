const DEFAULT_LOCATION = {
  latitude: 10.7769,
  longitude: 106.7009,
};

const MAP_EVENT_SOURCE = 'fastmark-map';
export const LEAFLET_HTML_REVISION = 44;

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function createLeafletHtml({ currentLocation = null, navigationMode = false } = {}) {
  const initialLocation = currentLocation || DEFAULT_LOCATION;
  const initialData = safeJson({ currentLocation: initialLocation, navigationMode: Boolean(navigationMode) });

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    <style>
      html,
      body,
      #map {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #f2efe9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #f2efe9;
      }

      .leaflet-control-attribution,
      .leaflet-control-scale {
        display: none !important;
      }

      .user-marker {
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #076F32;
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

      .nav-user-marker {
        position: relative;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #2563eb;
        border: 4px solid #ffffff;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
      }

      .nav-user-marker::after {
        content: "";
        position: absolute;
        inset: 5px;
        border-radius: 999px;
        background: #60a5fa;
      }

      .location-pin {
        position: relative;
        width: 28px;
        height: 36px;
        filter: drop-shadow(0 4px 8px rgba(220, 38, 38, 0.35));
      }

      .location-pin svg,
      .scan-marker svg {
        width: 28px;
        height: 36px;
        display: block;
      }

      .scan-marker {
        position: relative;
        width: 28px;
        height: 36px;
        filter: drop-shadow(0 4px 8px rgba(37, 99, 235, 0.35));
      }

      .shop-marker {
        position: relative;
        width: 28px;
        height: 36px;
        box-sizing: border-box;
      }

      .shop-marker svg {
        width: 28px;
        height: 36px;
        display: block;
        overflow: visible;
        filter: drop-shadow(0 3px 8px rgba(13, 115, 119, 0.35));
      }

      .shop-marker-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: max-content;
        max-width: 118px;
        pointer-events: auto;
        touch-action: manipulation;
        filter: drop-shadow(0 4px 9px rgba(15, 23, 42, 0.16));
      }

      .shop-marker-card-inner {
        display: flex;
        align-items: center;
        width: 112px;
        min-height: 42px;
        box-sizing: border-box;
        padding: 5px 8px;
        border-radius: 13px;
        background: #ffffff;
        border: 1px solid rgba(15, 23, 42, 0.06);
      }

      .shop-marker-meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .shop-marker-name {
        font-size: 11px;
        font-weight: 800;
        line-height: 1.18;
        color: #0f172a;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        max-width: 96px;
      }

      .shop-marker-rating {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.2;
        color: #64748b;
      }

      .shop-marker-star {
        color: #f59e0b;
        font-size: 10px;
        line-height: 1;
      }

      .shop-marker-distance {
        color: #16a34a;
        font-weight: 800;
      }

      .shop-marker-pointer {
        position: relative;
        width: 9px;
        height: 9px;
        margin-top: 7px;
        border-radius: 999px;
        background: #16a34a;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(7, 111, 50, 0.35);
      }

      .shop-marker-pointer::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -11px;
        width: 0;
        height: 0;
        transform: translateX(-50%);
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 10px solid #ffffff;
        filter: drop-shadow(0 2px 1px rgba(15, 23, 42, 0.08));
      }

      .shop-marker-pointer-closed {
        background: #94a3b8;
        box-shadow: 0 2px 6px rgba(100, 116, 139, 0.3);
      }

      .fastmark-restaurant-icon {
        background: transparent !important;
        border: none !important;
      }

      .fastmark-restaurant-icon .gm-shop-marker {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 3px;
        pointer-events: auto;
        touch-action: manipulation;
        max-width: 148px;
      }

      .gm-shop-dot-wrap {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
      }

      .gm-shop-dot {
        width: 28px;
        height: 28px;
        display: block;
        filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
      }

      .gm-shop-label {
        font-family: Roboto, system-ui, -apple-system, sans-serif;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.25;
        color: #202124;
        max-width: 112px;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        overflow: visible;
        text-overflow: clip;
        padding-bottom: 3px;
        text-shadow:
          1px 0 #fff,
          -1px 0 #fff,
          0 1px #fff,
          0 -1px #fff;
      }

      .gm-shop-marker--closed .gm-shop-dot {
        opacity: 0.55;
        filter: grayscale(0.35) drop-shadow(0 2px 3px rgba(15, 23, 42, 0.12));
      }

      .gm-shop-marker--closed .gm-shop-label {
        opacity: 0.65;
      }

      .fastmark-restaurant-icon .shop-marker-card {
        pointer-events: auto;
        touch-action: manipulation;
      }

      .leaflet-bottom.leaflet-right {
        margin-bottom: 154px;
      }

      .leaflet-bottom.leaflet-left {
        margin-bottom: 72px;
      }

      .leaflet-control-zoom {
        border: none;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
      }

      .destination-marker {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 3px solid #ffffff;
        background: #dc2626;
        color: #ffffff;
        font-size: 18px;
        box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
      }

      .restaurant-marker {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 2px solid #ffffff;
        color: #ffffff;
        font-size: 16px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
      }
      .marker-cafe { background: #d97706; }
      .marker-food { background: #e11d48; }
      .marker-milktea { background: #8b5cf6; }
      .marker-snack { background: #076F32; }

      .fastmark-restaurant-icon .restaurant-marker {
        pointer-events: auto;
        touch-action: manipulation;
      }

      .view-store-btn {
        display: block;
        width: 100%;
        margin-top: 10px;
        padding: 10px 12px;
        border: none;
        border-radius: 8px;
        background: #076F32;
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
        font-family: sans-serif;
        cursor: pointer;
        touch-action: manipulation;
      }

      .view-store-btn:active {
        opacity: 0.85;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.js"></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <script>
      const EVENT_SOURCE = '${MAP_EVENT_SOURCE}';
      const initialData = ${initialData};
      const fallbackLocation = ${safeJson(DEFAULT_LOCATION)};

      let currentMarker = null;
      let accuracyCircle = null;
      let radiusCircleLayer = null;
      let activeRadiusMeters = null;
      let activeRadiusCenter = null;
      let activeScanLocation = null;
      let lastCurrentLocation = null;
      let overlaySvgRenderer = null;
      let geoOverlaySyncTimer = null;
      let userMovedMap = false;
      const restaurantMarkerById = {};
      let drawRestaurantsFrame = null;
      let pendingRestaurantList = null;
      let lastRestaurantListSignature = '';
      let routeLayer = null;
      let destinationMarker = null;
      let lastRoutePolylineKey = '';
      let lastRouteLatLngs = [];
      let lastNavLocation = null;
      let navigationActive = Boolean(initialData.navigationMode);
      let lastNavPanAt = 0;
      let activeRouteDestination = null;
      let scanMarker = null;
      let lastMapTap = null;
      let mapRotating = false;
      let pendingRoutePolylinePayload = null;
      let routeRedrawFrame = null;

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

      function postToApp(payload) {
        const message = { source: EVENT_SOURCE, payload };

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
          return;
        }

        window.parent.postMessage(message, '*');
      }

      function openRestaurant(restaurant) {
        if (!restaurant || restaurant.id == null) {
          return;
        }

        postToApp({
          type: 'restaurantTap',
          restaurant: {
            id: String(restaurant.id),
            name: restaurant.name || '',
          },
        });
      }

      const startLocation = hasLocation(initialData.currentLocation)
        ? initialData.currentLocation
        : fallbackLocation;

      function escapeHtmlAttr(value) {
        return String(value)
          .split('&').join('&amp;')
          .split('"').join('&quot;')
          .split('<').join('&lt;');
      }

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        rotate: true,
        touchRotate: true,
        touchGestures: true,
        shiftKeyRotate: false,
        bearing: 0,
        bounceAtRotationLimits: false,
        preferCanvas: true,
        fadeAnimation: false,
        zoomAnimation: true,
      }).setView(getLatLng(startLocation), 18);

      overlaySvgRenderer = L.svg({ padding: 0.5 });

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      /** Giống bản đồ trên nominatim.openstreetmap.org — OSM chuẩn, dễ đọc. */
      const TILE_PROVIDERS = [
        {
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          options: {
            maxZoom: 19,
            detectRetina: false,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2,
            noWrap: true,
          },
        },
        {
          url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
          options: {
            maxZoom: 18,
            detectRetina: false,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2,
          },
        },
        {
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          options: {
            subdomains: 'abcd',
            maxZoom: 20,
            detectRetina: false,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2,
          },
        },
      ];

      let baseTileLayerIndex = 0;
      let baseTileErrorCount = 0;
      let baseTileLayer = null;

      function refreshMapLayout() {
        if (typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: false });
        }
      }

      function installBaseTileLayer() {
        if (baseTileLayer) {
          map.removeLayer(baseTileLayer);
        }

        const provider = TILE_PROVIDERS[baseTileLayerIndex];
        baseTileLayer = L.tileLayer(provider.url, {
          ...provider.options,
          attribution: '',
        });
        baseTileErrorCount = 0;

        baseTileLayer.on('tileerror', function () {
          baseTileErrorCount += 1;
          if (baseTileErrorCount >= 8 && baseTileLayerIndex < TILE_PROVIDERS.length - 1) {
            baseTileLayerIndex += 1;
            installBaseTileLayer();
          }
        });

        baseTileLayer.on('load', function () {
          refreshMapLayout();
        });

        baseTileLayer.addTo(map);
      }

      installBaseTileLayer();

      function createRestaurantLayerGroup() {
        if (typeof L.markerClusterGroup === 'function') {
          return L.markerClusterGroup({
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 42,
            disableClusteringAtZoom: 16,
            chunkedLoading: true,
            chunkInterval: 72,
            chunkDelay: 32,
            spiderfyOnMaxZoom: true,
            removeOutsideVisibleBounds: true,
            animate: false,
          });
        }
        return L.layerGroup();
      }

      let restaurantClusterGroup = createRestaurantLayerGroup();
      map.addLayer(restaurantClusterGroup);

      const RED_PIN_SVG =
        '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="#dc2626" stroke="#ffffff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>' +
        '<circle cx="12" cy="12" r="4.5" fill="#ffffff" opacity="0.95"/>' +
        '</svg>';

      const BLUE_PIN_SVG =
        '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="#2563eb" stroke="#ffffff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>' +
        '<circle cx="12" cy="12" r="4.5" fill="#ffffff" opacity="0.95"/>' +
        '</svg>';

      const userIcon = L.divIcon({
        className: '',
        html: '<div class="location-pin">' + RED_PIN_SVG + '</div>',
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const navUserIcon = L.divIcon({
        className: '',
        html: '<div class="nav-user-marker"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const scanIcon = L.divIcon({
        className: '',
        html: '<div class="scan-marker">' + BLUE_PIN_SVG + '</div>',
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      function isNearLocation(left, right) {
        return (
          Math.abs(Number(left.latitude) - Number(right.latitude)) < 0.0003 &&
          Math.abs(Number(left.longitude) - Number(right.longitude)) < 0.0003
        );
      }

      function drawScanLocation(location) {
        activeScanLocation =
          location && hasLocation(location)
            ? {
                latitude: Number(location.latitude),
                longitude: Number(location.longitude),
              }
            : null;

        if (!activeScanLocation) {
          if (scanMarker) {
            map.removeLayer(scanMarker);
            scanMarker = null;
          }
          return;
        }

        const latLng = getLatLng(activeScanLocation);

        if (!scanMarker) {
          scanMarker = L.marker(latLng, { icon: scanIcon, interactive: false }).addTo(map);
        } else {
          scanMarker.setLatLng(latLng);
        }
      }

      function refreshMarkerPositions() {
        if (lastCurrentLocation && hasLocation(lastCurrentLocation)) {
          if (navigationActive) {
            drawNavigationUserMarker(lastCurrentLocation);
          } else {
            const latLng = getLatLng(lastCurrentLocation);
            if (!currentMarker) {
              currentMarker = L.marker(latLng, { icon: userIcon, interactive: false }).addTo(map);
            } else {
              currentMarker.setLatLng(latLng);
            }
          }
        }

        if (activeScanLocation && hasLocation(activeScanLocation)) {
          const latLng = getLatLng(activeScanLocation);
          if (!scanMarker) {
            scanMarker = L.marker(latLng, { icon: scanIcon, interactive: false }).addTo(map);
          } else {
            scanMarker.setLatLng(latLng);
          }
        }
      }

      function applyRadiusCircleLayer() {
        if (radiusCircleLayer) {
          map.removeLayer(radiusCircleLayer);
          radiusCircleLayer = null;
        }

        if (!activeRadiusCenter || !hasLocation(activeRadiusCenter) || !activeRadiusMeters) {
          return;
        }

        const latLng = getLatLng(activeRadiusCenter);
        radiusCircleLayer = L.circle(latLng, {
          radius: activeRadiusMeters,
          color: '#076F32',
          weight: 2,
          opacity: 0.85,
          fillColor: '#076F32',
          fillOpacity: 0.14,
          dashArray: '8, 6',
          interactive: false,
          renderer: overlaySvgRenderer,
        }).addTo(map);
      }

      function syncGeoOverlays() {
        applyRadiusCircleLayer();
        refreshMarkerPositions();
        if (routeLayer && typeof routeLayer.redraw === 'function') {
          routeLayer.redraw();
        }
      }

      function scheduleGeoOverlaySync() {
        if (mapRotating) {
          return;
        }
        if (geoOverlaySyncTimer) {
          return;
        }
        geoOverlaySyncTimer = setTimeout(function() {
          geoOverlaySyncTimer = null;
          syncGeoOverlays();
        }, 48);
      }

      function hideAccuracyCircle() {
        if (accuracyCircle) {
          map.removeLayer(accuracyCircle);
          accuracyCircle = null;
        }
      }

      function hideCurrentMarker() {
        if (currentMarker) {
          map.removeLayer(currentMarker);
          currentMarker = null;
        }
      }

      function drawNavigationUserMarker(location) {
        if (!hasLocation(location)) {
          return;
        }

        lastCurrentLocation = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        };

        const latLng = getLatLng(lastCurrentLocation);

        if (!currentMarker) {
          currentMarker = L.marker(latLng, {
            icon: navUserIcon,
            interactive: false,
            zIndexOffset: 2000,
          }).addTo(map);
        } else {
          currentMarker.setLatLng(latLng);
          currentMarker.setIcon(navUserIcon);
        }
      }

      function fitMapToRadius(center, radiusMeters) {
        if (!hasLocation(center) || !radiusMeters) {
          return;
        }
        const bounds = L.circle(getLatLng(center), { radius: radiusMeters }).getBounds();
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18, animate: true });
      }

      function resetMapBearing() {
        if (typeof map.setBearing === 'function' && Math.abs(Number(map.getBearing?.() ?? 0)) > 0.5) {
          map.setBearing(0);
        }
      }

      function recenterMap(latLng) {
        resetMapBearing();
        map.flyTo(latLng, 18, { duration: 1.2, easeLinearity: 0.22 });
      }

      function drawCurrentLocation(location, options) {
        if (!hasLocation(location)) {
          return;
        }

        lastCurrentLocation = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        };

        if (navigationActive) {
          drawNavigationUserMarker(location);
          if (options && options.recenter) {
            userMovedMap = false;
            const latLng = getLatLng(lastCurrentLocation);
            if (activeRadiusMeters) {
              fitMapToRadius(location, activeRadiusMeters);
            } else {
              map.setView(latLng, 18, { animate: false });
            }
          }
          return;
        }

        const latLng = getLatLng(lastCurrentLocation);

        if (!currentMarker) {
          currentMarker = L.marker(latLng, { icon: userIcon, interactive: false }).addTo(map);
        } else {
          currentMarker.setLatLng(latLng);
        }

        hideAccuracyCircle();

        if (options && options.recenter) {
          userMovedMap = false;
          if (activeRadiusMeters) {
            fitMapToRadius(location, activeRadiusMeters);
          } else {
            map.setView(latLng, 18, { animate: false });
          }
        }
      }

      function drawRadiusCircle(center, radiusMeters) {
        activeRadiusMeters = radiusMeters || null;
        activeRadiusCenter =
          center && hasLocation(center)
            ? {
                latitude: Number(center.latitude),
                longitude: Number(center.longitude),
              }
            : null;

        if (!activeRadiusCenter || !activeRadiusMeters) {
          if (radiusCircleLayer) {
            map.removeLayer(radiusCircleLayer);
            radiusCircleLayer = null;
          }
          if (lastCurrentLocation && hasLocation(lastCurrentLocation)) {
            drawCurrentLocation(lastCurrentLocation, { recenter: !userMovedMap });
          }
          return;
        }

        hideAccuracyCircle();
        applyRadiusCircleLayer();

        if (!userMovedMap) {
          fitMapToRadius(activeRadiusCenter, activeRadiusMeters);
        }
      }

      function clearLayerList(layers) {
        layers.forEach(function(layer) {
          map.removeLayer(layer);
        });
        layers.length = 0;
      }

      function getRestaurantEmoji(type) {
        switch (type) {
          case 'cafe': return '☕';
          case 'food': return '🍜';
          case 'milktea': return '🧋';
          case 'snack': return '🍿';
          default: return '📍';
        }
      }

      function clearRoute() {
        pendingRoutePolylinePayload = null;
        if (routeLayer) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        if (destinationMarker) {
          map.removeLayer(destinationMarker);
          destinationMarker = null;
        }
        activeRouteDestination = null;
        lastRoutePolylineKey = '';
        lastRouteLatLngs = [];
        lastNavLocation = null;
        navigationActive = false;
      }

      function rebuildRouteLayer() {
        if (!lastRouteLatLngs.length) {
          return;
        }
        if (routeLayer) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        routeLayer = createRoutePolyline(lastRouteLatLngs).addTo(map);
        scheduleRouteRedraw();
      }

      function scheduleRouteRedraw() {
        if (!routeLayer) {
          return;
        }
        if (routeRedrawFrame) {
          return;
        }
        routeRedrawFrame = requestAnimationFrame(function() {
          routeRedrawFrame = null;
          if (routeLayer && typeof routeLayer.redraw === 'function') {
            routeLayer.redraw();
          }
          if (destinationMarker && typeof destinationMarker.update === 'function') {
            destinationMarker.update();
          }
        });
      }

      function createRoutePolyline(coords) {
        return L.polyline(coords, {
          color: '#2563eb',
          weight: 6,
          opacity: 0.92,
          lineJoin: 'round',
          lineCap: 'round',
          interactive: false,
        });
      }

      function routePolylineKey(coords) {
        if (!coords.length) {
          return '';
        }
        const first = coords[0];
        const last = coords[coords.length - 1];
        return (
          coords.length +
          ':' +
          Number(first[0]).toFixed(5) +
          ',' +
          Number(first[1]).toFixed(5) +
          ':' +
          Number(last[0]).toFixed(5) +
          ',' +
          Number(last[1]).toFixed(5)
        );
      }

      function isNavMoveSignificant(left, right) {
        return (
          Math.abs(Number(left.latitude) - Number(right.latitude)) >= 0.000006 ||
          Math.abs(Number(left.longitude) - Number(right.longitude)) >= 0.000006
        );
      }

      function drawDestinationMarker(to) {
        if (!hasLocation(to)) {
          return;
        }

        const destIcon = L.divIcon({
          className: 'fastmark-restaurant-icon',
          html: getShopPinIconOnly(true),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        if (!destinationMarker) {
          destinationMarker = L.marker(getLatLng(to), {
            icon: destIcon,
            interactive: false,
            zIndexOffset: 1000,
          }).addTo(map);
        } else {
          destinationMarker.setLatLng(getLatLng(to));
          destinationMarker.setIcon(destIcon);
        }

        activeRouteDestination = to;
      }

      function setRoutePolyline(payload) {
        const coords = Array.isArray(payload?.coordinates) ? payload.coordinates : [];
        const destination = payload?.destination || null;

        if (!coords.length || !hasLocation(destination)) {
          clearRoute();
          return;
        }

        navigationActive = true;

        if (mapRotating && !payload?.fitBounds) {
          pendingRoutePolylinePayload = payload;
          return;
        }

        const nextKey = routePolylineKey(coords);
        if (!payload.fitBounds && nextKey === lastRoutePolylineKey && routeLayer) {
          drawDestinationMarker(destination);
          scheduleRouteRedraw();
          if (lastNavLocation) {
            drawNavigationUserMarker(lastNavLocation);
          }
          return;
        }
        lastRoutePolylineKey = nextKey;
        lastRouteLatLngs = coords.slice();

        drawDestinationMarker(destination);

        if (!routeLayer) {
          routeLayer = createRoutePolyline(lastRouteLatLngs).addTo(map);
        } else {
          routeLayer.setLatLngs(lastRouteLatLngs);
          scheduleRouteRedraw();
        }

        if (payload.fitBounds) {
          map.fitBounds(routeLayer.getBounds(), { padding: [100, 48], maxZoom: 17, animate: true });
        }

        if (lastNavLocation) {
          drawNavigationUserMarker(lastNavLocation);
        }
      }

      function panToNavigationLocation(location, followUser) {
        if (!hasLocation(location)) {
          return;
        }

        const latLng = getLatLng(location);
        const markerMoved = !lastNavLocation || isNavMoveSignificant(lastNavLocation, location);
        lastNavLocation = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        };

        navigationActive = true;
        drawNavigationUserMarker(location);
        hideAccuracyCircle();

        if (!followUser || !markerMoved) {
          return;
        }

        const zoom = map.getZoom();
        const targetPoint = map.project(latLng, zoom).subtract([0, 120]);
        const targetLatLng = map.unproject(targetPoint, zoom);
        const center = map.getCenter();
        const centerShiftMeters = center.distanceTo(targetLatLng);
        const now = Date.now();

        if (centerShiftMeters < 6 && now - lastNavPanAt < 220) {
          return;
        }

        lastNavPanAt = now;
        const animate = centerShiftMeters > 3;
        map.panTo(targetLatLng, {
          animate,
          duration: animate ? (centerShiftMeters > 45 ? 0.32 : 0.22) : 0,
          easeLinearity: 0.28,
        });
      }

      function updateNavigationLocation(command) {
        panToNavigationLocation(command.location, Boolean(command.followUser));
      }

      async function showRoute(from, to) {
        clearRoute();

        if (!hasLocation(from) || !hasLocation(to)) {
          postToApp({ type: 'routeError', message: 'Thiếu vị trí để chỉ đường.' });
          return;
        }

        activeRouteDestination = to;

        const destIcon = L.divIcon({
          className: 'fastmark-restaurant-icon',
          html: getShopPinIconOnly(true),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        destinationMarker = L.marker(getLatLng(to), {
          icon: destIcon,
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map);

        try {
          const url =
            'https://router.project-osrm.org/route/v1/driving/' +
            Number(from.longitude) + ',' + Number(from.latitude) + ';' +
            Number(to.longitude) + ',' + Number(to.latitude) +
            '?overview=full&geometries=geojson';

          const response = await fetch(url);
          const data = await response.json();

          if (!data || !data.routes || !data.routes[0]) {
            throw new Error('Không tìm được lộ trình.');
          }

          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(function(point) {
            return [point[1], point[0]];
          });

          routeLayer = createRoutePolyline(coords);
          routeLayer.setStyle({ color: '#076F32' });
          lastRouteLatLngs = coords.slice();
          routeLayer.addTo(map);

          map.fitBounds(routeLayer.getBounds(), { padding: [100, 48], maxZoom: 17, animate: true });

          postToApp({
            type: 'routeReady',
            distance: route.distance || 0,
            duration: route.duration || 0,
            destination: to,
          });
        } catch (error) {
          clearRoute();
          map.setView(getLatLng(to), 16, { animate: true });
          postToApp({
            type: 'routeError',
            message: error && error.message ? error.message : 'Không vẽ được lộ trình.',
          });
        }
      }


      function buildShopDotHtml(open) {
        const innerFill = open ? '#64748b' : '#94a3b8';
        return (
          '<svg class="gm-shop-dot" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="14" cy="14" r="13" fill="#ffffff" stroke="rgba(15,23,42,0.1)" stroke-width="1"/>' +
          '<circle cx="14" cy="14" r="9" fill="' + innerFill + '"/>' +
          '<circle cx="14" cy="14" r="3" fill="#ffffff"/>' +
          '</svg>'
        );
      }

      /** Marker tròn (route destination, không nhãn). */
      function getShopPinIconOnly(open) {
        return (
          '<div class="gm-shop-marker">' +
          '<div class="gm-shop-dot-wrap">' + buildShopDotHtml(open !== false) + '</div>' +
          '</div>'
        );
      }

      function getShopPinIcon() {
        return getShopPinIconOnly(true);
      }

      function getShopDisplayName(restaurant) {
        return String(
          restaurant.shop_name ||
          restaurant.shopName ||
          restaurant.name ||
          'Gian hàng'
        ).trim().replace(/^@+/, '') || 'Gian hàng';
      }

      function getShopCategoryLabel(restaurant) {
        return String(
          restaurant.category_name ||
          restaurant.categoryName ||
          ''
        ).trim();
      }

      function getShopRatingLabel(restaurant) {
        const rating = Number(
          restaurant.rating_avg ??
          restaurant.averageRating ??
          restaurant.rating ??
          0
        );
        if (!Number.isFinite(rating) || rating <= 0) {
          return 'Mới';
        }
        return rating.toFixed(1);
      }

      function getShopDistanceLabel(restaurant) {
        const distance = Number(
          restaurant.distance_meters ??
          restaurant.distanceMeters ??
          0
        );
        if (!Number.isFinite(distance) || distance <= 0) {
          return '';
        }
        if (distance >= 1000) {
          return (distance / 1000).toFixed(1) + 'km';
        }
        return Math.round(distance) + 'm';
      }

      function isShopOpen(restaurant) {
        return restaurant.is_open !== false &&
          restaurant.is_open !== 0 &&
          restaurant.isOpen !== 0;
      }

      function estimateShopMarkerSize(displayName) {
        const labelMaxWidth = 112;
        const dotWidth = 28;
        const gap = 3;
        const totalWidth = dotWidth + gap + labelMaxWidth;
        const charsPerLine = 14;
        const lineCount = Math.max(1, Math.ceil(String(displayName || '').length / charsPerLine));
        const labelHeight = 14 + (lineCount - 1) * 14;
        const totalHeight = Math.max(dotWidth, labelHeight + 6);
        return { totalWidth: totalWidth, totalHeight: Math.min(totalHeight, 72), lineCount: lineCount };
      }

      function getShopMarkerIcon(restaurant) {
        const name = escapeHtmlAttr(getShopDisplayName(restaurant));
        const open = isShopOpen(restaurant);
        const dotHtml = buildShopDotHtml(open);

        return (
          '<div class="gm-shop-marker' + (open ? '' : ' gm-shop-marker--closed') + '">' +
          '<div class="gm-shop-dot-wrap">' + dotHtml + '</div>' +
          '<div class="gm-shop-label">' + name + '</div>' +
          '</div>'
        );
      }

      function buildShopMarkerIconObject(restaurant) {
        const displayName = getShopDisplayName(restaurant);
        const size = estimateShopMarkerSize(displayName);
        return L.divIcon({
          className: 'fastmark-restaurant-icon',
          html: getShopMarkerIcon(restaurant),
          iconSize: [size.totalWidth, size.totalHeight],
          iconAnchor: [14, Math.round(size.totalHeight / 2)],
        });
      }

      function buildShopPopupContent(restaurant) {
        return (
          '<div class="restaurant-popup" style="font-family: sans-serif; padding: 2px; min-width: 180px;">' +
          '<b style="font-size: 14px; color: #0f172a;">' + escapeHtmlAttr(restaurant.name || '') + '</b><br>' +
          '<span style="font-size: 12px; color: #475569;">' + escapeHtmlAttr(restaurant.address || '') + '</span>' +
          '<button type="button" class="view-store-btn">Xem gian hàng</button>' +
          '</div>'
        );
      }

      /** Chữ ký nội dung marker — chỉ vẽ lại khi thật sự đổi để bản đồ không nháy. */
      function getShopMarkerSignature(restaurant) {
        return [
          Number(restaurant.latitude).toFixed(6),
          Number(restaurant.longitude).toFixed(6),
          getShopDisplayName(restaurant),
          isShopOpen(restaurant) ? 'open' : 'closed',
        ].join('|');
      }

      function getRestaurantListSignature(items) {
        if (!Array.isArray(items) || !items.length) {
          return '';
        }
        return items
          .map(function(r) {
            return String(r.id);
          })
          .sort()
          .join(',');
      }

      function scheduleDrawRestaurants(restaurantsList) {
        pendingRestaurantList = restaurantsList;
        const nextSignature = getRestaurantListSignature(restaurantsList);
        if (nextSignature === lastRestaurantListSignature) {
          return;
        }
        if (drawRestaurantsFrame) {
          cancelAnimationFrame(drawRestaurantsFrame);
        }
        drawRestaurantsFrame = requestAnimationFrame(function() {
          drawRestaurantsFrame = null;
          lastRestaurantListSignature = getRestaurantListSignature(pendingRestaurantList);
          drawRestaurants(pendingRestaurantList);
          pendingRestaurantList = null;
        });
      }

      function drawRestaurants(restaurantsList) {
        const items = Array.isArray(restaurantsList) ? restaurantsList : [];
        const nextIds = {};

        items.forEach(function(r) {
          if (!hasLocation(r) || r.id == null) {
            return;
          }

          const id = String(r.id);
          nextIds[id] = true;

          const latLng = [Number(r.latitude), Number(r.longitude)];
          const signature = getShopMarkerSignature(r);
          const existing = restaurantMarkerById[id];

          if (existing) {
            if (existing.signature === signature) {
              return;
            }

            existing.data.name = r.name || '';
            existing.data.address = r.address || '';
            existing.marker.setLatLng(latLng);
            existing.marker.setIcon(buildShopMarkerIconObject(r));
            existing.marker.setPopupContent(buildShopPopupContent(r));
            existing.signature = signature;
            return;
          }

          const marker = L.marker(latLng, {
            icon: buildShopMarkerIconObject(r),
            bubblingMouseEvents: true,
            riseOnHover: true,
          });

          const restaurantData = {
            id: id,
            name: r.name || '',
            address: r.address || '',
          };

          marker.bindPopup(buildShopPopupContent(r), { closeOnClick: true, autoPan: true });

          marker.on('click', function() {
            openRestaurant(restaurantData);
          });

          marker.on('popupopen', function(event) {
            const popupEl = event.popup.getElement();
            if (!popupEl) {
              return;
            }

            const button = popupEl.querySelector('.view-store-btn');
            if (!button) {
              return;
            }

            button.onclick = function(clickEvent) {
              if (clickEvent) {
                clickEvent.preventDefault();
                clickEvent.stopPropagation();
              }
              openRestaurant(restaurantData);
            };
          });

          restaurantClusterGroup.addLayer(marker);

          restaurantMarkerById[id] = {
            marker: marker,
            data: restaurantData,
            signature: signature,
          };
        });

        Object.keys(restaurantMarkerById).forEach(function(id) {
          if (nextIds[id]) {
            return;
          }
          restaurantClusterGroup.removeLayer(restaurantMarkerById[id].marker);
          delete restaurantMarkerById[id];
        });
      }

      function receive(command) {
        if (!command || !command.type) {
          return;
        }

        if (command.type === 'location') {
          drawCurrentLocation(command.location, { recenter: command.recenter });
        }

        if (command.type === 'recenter' && hasLocation(command.location)) {
          userMovedMap = false;
          const latLng = getLatLng(command.location);

          if (lastNavLocation || navigationActive) {
            lastNavLocation = {
              latitude: Number(command.location.latitude),
              longitude: Number(command.location.longitude),
            };
            navigationActive = true;
            drawNavigationUserMarker(command.location);
            hideAccuracyCircle();
            recenterMap(latLng);
            return;
          }

          if (currentMarker) {
            currentMarker.setLatLng(latLng);
            currentMarker.setIcon(userIcon);
          } else {
            currentMarker = L.marker(latLng, {
              icon: userIcon,
              interactive: false,
            }).addTo(map);
          }

          hideAccuracyCircle();
          recenterMap(latLng);
        }

        if (command.type === 'invalidateSize') {
          refreshMapLayout();
        }

        if (command.type === 'showRestaurants') {
          scheduleDrawRestaurants(command.restaurants);
        }

        if (command.type === 'radiusCircle') {
          drawRadiusCircle(command.center, command.radius);
        }

        if (command.type === 'scanLocation') {
          drawScanLocation(command.location);
        }

        if (command.type === 'showRoute') {
          showRoute(command.from, command.to);
        }

        if (command.type === 'setRoutePolyline') {
          setRoutePolyline(command);
        }

        if (command.type === 'updateNavigationLocation') {
          updateNavigationLocation(command);
        }

        if (command.type === 'clearRoute') {
          clearRoute();
        }
      }

      window.FastmarkMap = { receive, openRestaurant };

      window.addEventListener('message', function(event) {
        const data = event.data || {};
        const command = data.source === 'fastmark-map-command' ? data.payload : data;
        receive(command);
      });

      map.on('click', function(event) {
        const location = toLocation(event.latlng);
        const now = Date.now();

        postToApp({
          type: 'mapTap',
          location: location,
        });

        if (lastMapTap && now - lastMapTap.time < 450 && isNearLocation(lastMapTap.location, location)) {
          postToApp({
            type: 'mapDoubleTap',
            location: location,
          });
          lastMapTap = null;
          return;
        }

        lastMapTap = { time: now, location: location };
      });

      map.on('dblclick', function(event) {
        L.DomEvent.preventDefault(event);
      });

      function markUserMovedMap() {
        if (userMovedMap) {
          return;
        }
        userMovedMap = true;
        postToApp({ type: 'userMovedMap' });
      }

      map.on('dragstart zoomstart rotatestart', markUserMovedMap);

      map.on('rotatestart', function() {
        mapRotating = true;
        if (routeLayer) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        if (radiusCircleLayer) {
          map.removeLayer(radiusCircleLayer);
          radiusCircleLayer = null;
        }
      });

      map.on('rotateend', function() {
        mapRotating = false;
        rebuildRouteLayer();
        syncGeoOverlays();
        if (pendingRoutePolylinePayload) {
          const pending = pendingRoutePolylinePayload;
          pendingRoutePolylinePayload = null;
          setRoutePolyline(pending);
        }
      });

      map.on('move zoom', scheduleGeoOverlaySync);
      map.on('moveend zoomend', syncGeoOverlays);

      if (navigationActive && hasLocation(startLocation)) {
        lastNavLocation = {
          latitude: Number(startLocation.latitude),
          longitude: Number(startLocation.longitude),
        };
        drawNavigationUserMarker(startLocation);
        map.setView(getLatLng(startLocation), 18, { animate: false });
      } else {
        drawCurrentLocation(startLocation, { recenter: true });
      }
      refreshMapLayout();
      postToApp({ type: 'ready' });
    </script>
  </body>
</html>`;
}

export { MAP_EVENT_SOURCE };
