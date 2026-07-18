const DEFAULT_LOCATION = {
  latitude: 10.7769,
  longitude: 106.7009,
};

const MAP_EVENT_SOURCE = 'fastmark-map';
export const LEAFLET_HTML_REVISION = 16;

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
        max-width: 148px;
        pointer-events: auto;
        touch-action: manipulation;
        filter: drop-shadow(0 4px 10px rgba(15, 23, 42, 0.18));
      }

      .shop-marker-card-inner {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 5px 8px 5px 5px;
        border-radius: 10px;
        background: #ffffff;
        border: 1px solid rgba(15, 23, 42, 0.06);
      }

      .shop-marker-avt {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        overflow: hidden;
        background: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .shop-marker-avt img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .shop-marker-avt-fallback {
        width: 16px;
        height: 16px;
        color: #ffffff;
      }

      .shop-marker-meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .shop-marker-name {
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 104px;
      }

      .shop-marker-rating {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.2;
        color: #0f172a;
      }

      .shop-marker-star {
        color: #076F32;
        font-size: 10px;
        line-height: 1;
      }

      .shop-marker-cat {
        font-size: 9px;
        font-weight: 600;
        line-height: 1.2;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 104px;
      }

      .shop-marker-pointer {
        width: 10px;
        height: 10px;
        margin-top: -5px;
        border-radius: 999px;
        background: #2563eb;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
      }

      .fastmark-restaurant-icon {
        background: transparent !important;
        border: none !important;
      }

      .fastmark-restaurant-icon .shop-marker,
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
    <script>
      const EVENT_SOURCE = '${MAP_EVENT_SOURCE}';
      const initialData = ${initialData};
      const fallbackLocation = ${safeJson(DEFAULT_LOCATION)};

      let currentMarker = null;
      let accuracyCircle = null;
      let radiusCircleLayer = null;
      let activeRadiusMeters = null;
      let userMovedMap = false;
      let restaurantMarkers = [];
      let routeLayer = null;
      let destinationMarker = null;
      let activeRouteDestination = null;
      let scanMarker = null;
      let lastMapTap = null;

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
      }).setView(getLatLng(startLocation), 18);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '',
      }).addTo(map);

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
        if (!hasLocation(location)) {
          if (scanMarker) {
            map.removeLayer(scanMarker);
            scanMarker = null;
          }
          return;
        }

        const latLng = getLatLng(location);

        if (!scanMarker) {
          scanMarker = L.marker(latLng, { icon: scanIcon, interactive: false }).addTo(map);
        } else {
          scanMarker.setLatLng(latLng);
        }
      }

      function hideAccuracyCircle() {
        if (accuracyCircle) {
          map.removeLayer(accuracyCircle);
          accuracyCircle = null;
        }
      }

      function fitMapToRadius(center, radiusMeters) {
        if (!hasLocation(center) || !radiusMeters) {
          return;
        }
        const bounds = L.circle(getLatLng(center), { radius: radiusMeters }).getBounds();
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18, animate: true });
      }

      function recenterMap(latLng) {
        map.flyTo(latLng, 18, { duration: 1.2, easeLinearity: 0.22 });
      }

      function drawCurrentLocation(location, options) {
        if (!hasLocation(location)) {
          return;
        }

        const latLng = getLatLng(location);

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

        if (radiusCircleLayer) {
          map.removeLayer(radiusCircleLayer);
          radiusCircleLayer = null;
        }

        if (!center || !hasLocation(center) || !radiusMeters) {
          if (currentMarker) {
            const latLng = currentMarker.getLatLng();
            drawCurrentLocation(
              { latitude: latLng.lat, longitude: latLng.lng },
              { recenter: !userMovedMap }
            );
          }
          return;
        }

        hideAccuracyCircle();

        const latLng = getLatLng(center);
        radiusCircleLayer = L.circle(latLng, {
          radius: radiusMeters,
          color: '#076F32',
          weight: 2,
          opacity: 0.85,
          fillColor: '#076F32',
          fillOpacity: 0.14,
          dashArray: '8, 6',
          interactive: false,
        }).addTo(map);

        if (!userMovedMap) {
          fitMapToRadius(center, radiusMeters);
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
        if (routeLayer) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        if (destinationMarker) {
          map.removeLayer(destinationMarker);
          destinationMarker = null;
        }
        activeRouteDestination = null;
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
          html: getShopPinIcon({
            image_url: to.image_url || to.storeAvatar || '',
            type: to.type || 'shop',
          }),
          iconSize: [28, 36],
          iconAnchor: [14, 36],
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

          routeLayer = L.polyline(coords, {
            color: '#076F32',
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round',
          }).addTo(map);

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

      function isRemoteIconUrl(value) {
        return value.indexOf('http://') === 0 || value.indexOf('https://') === 0;
      }

      const SHOP_PIN_PATH =
        'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z';

      function getShopNameInitial(restaurant) {
        const name = String(
          restaurant.shop_name ||
          restaurant.shopName ||
          restaurant.name ||
          ''
        ).trim().replace(/^@+/, '');
        if (!name) {
          return '?';
        }
        return name.charAt(0).toLocaleUpperCase('vi-VN');
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

      function getShopAvatarUrl(restaurant) {
        const avatarUrl = String(
          restaurant.image_url ||
          restaurant.imageUrl ||
          restaurant.storeAvatar ||
          restaurant.cover_image_url ||
          restaurant.coverImageUrl ||
          ''
        ).trim();
        return isRemoteIconUrl(avatarUrl) ? avatarUrl : '';
      }

      function getShopFallbackIconHtml() {
        return (
          '<svg class="shop-marker-avt-fallback" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M4 9.5L5.2 4.8A1.5 1.5 0 0 1 6.66 3.7h10.68a1.5 1.5 0 0 1 1.46 1.1L20 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M4 9.5h16v2.2a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 11.7V9.5z" fill="currentColor" opacity="0.22"/>' +
          '<path d="M6.2 13.9V19a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1v-5.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
          '<path d="M10 20v-4.2h4V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>'
        );
      }

      function getShopPinIcon(restaurant) {
        const imageUrl = getShopAvatarUrl(restaurant);
        const initial = escapeHtmlAttr(getShopNameInitial(restaurant));
        const clipId = 'shop-avt-' + String(restaurant.id || Math.random()).replace(/[^a-zA-Z0-9_-]/g, '');

        const avatarLayer = imageUrl
          ? '<defs><clipPath id="' + clipId + '">' +
            '<circle cx="12" cy="11" r="10.85"/></clipPath></defs>' +
            '<circle cx="12" cy="11" r="10.85" fill="#f1f5f9"/>' +
            '<g clip-path="url(#' + clipId + ')">' +
            '<image href="' + escapeHtmlAttr(imageUrl) + '" ' +
            'xlink:href="' + escapeHtmlAttr(imageUrl) + '" ' +
            'x="1.15" y="0.15" width="21.7" height="21.7" ' +
            'preserveAspectRatio="xMidYMid slice"/>' +
            '</g>'
          : '<circle cx="12" cy="11" r="10.85" fill="#0a5c5f"/>' +
            '<text x="12" y="11.5" text-anchor="middle" dominant-baseline="central" ' +
            'fill="#ffffff" font-size="12" font-weight="800" font-family="sans-serif">' +
            initial +
            '</text>';

        return (
          '<div class="shop-marker">' +
          '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
          '<path fill="#076F32" stroke="#ffffff" stroke-width="2.25" d="' + SHOP_PIN_PATH + '"/>' +
          avatarLayer +
          '</svg>' +
          '</div>'
        );
      }

      function getShopMarkerIcon(restaurant) {
        const imageUrl = getShopAvatarUrl(restaurant);
        const name = escapeHtmlAttr(getShopDisplayName(restaurant));
        const rating = escapeHtmlAttr(getShopRatingLabel(restaurant));
        const category = escapeHtmlAttr(getShopCategoryLabel(restaurant));

        const avatarHtml = imageUrl
          ? '<img src="' + escapeHtmlAttr(imageUrl) + '" alt="" />'
          : getShopFallbackIconHtml();

        const categoryHtml = category
          ? '<div class="shop-marker-cat">' + category + '</div>'
          : '';

        return (
          '<div class="shop-marker-card">' +
          '<div class="shop-marker-card-inner">' +
          '<div class="shop-marker-avt">' + avatarHtml + '</div>' +
          '<div class="shop-marker-meta">' +
          '<div class="shop-marker-name">' + name + '</div>' +
          '<div class="shop-marker-rating"><span class="shop-marker-star">★</span>' + rating + '</div>' +
          categoryHtml +
          '</div>' +
          '</div>' +
          '<div class="shop-marker-pointer"></div>' +
          '</div>'
        );
      }

      function drawRestaurants(restaurantsList) {
        clearLayerList(restaurantMarkers);
        
        if (!Array.isArray(restaurantsList)) {
          return;
        }

        restaurantsList.forEach(function(r) {
          if (!hasLocation(r)) {
            return;
          }

          const latLng = [Number(r.latitude), Number(r.longitude)];
          
          const icon = L.divIcon({
            className: 'fastmark-restaurant-icon',
            html: getShopMarkerIcon(r),
            iconSize: [148, 62],
            iconAnchor: [74, 62],
          });

          const marker = L.marker(latLng, {
            icon: icon,
            bubblingMouseEvents: true,
            riseOnHover: true,
          }).addTo(map);

          const restaurantData = {
            id: String(r.id),
            name: r.name || '',
            address: r.address || '',
          };

          const popupContent =
            '<div class="restaurant-popup" style="font-family: sans-serif; padding: 2px; min-width: 180px;">' +
            '<b style="font-size: 14px; color: #0f172a;">' + escapeHtmlAttr(restaurantData.name) + '</b><br>' +
            '<span style="font-size: 12px; color: #475569;">' + escapeHtmlAttr(restaurantData.address) + '</span>' +
            '<button type="button" class="view-store-btn">Xem gian hàng</button>' +
            '</div>';

          marker.bindPopup(popupContent, { closeOnClick: true, autoPan: true });

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

          restaurantMarkers.push(marker);
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

          if (currentMarker) {
            currentMarker.setLatLng(latLng);
          } else {
            currentMarker = L.marker(latLng, { icon: userIcon, interactive: false }).addTo(map);
          }

          hideAccuracyCircle();
          recenterMap(latLng);
        }

        if (command.type === 'showRestaurants') {
          drawRestaurants(command.restaurants);
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

      map.on('dragstart zoomstart', function() {
        userMovedMap = true;
      });

      drawCurrentLocation(startLocation, { recenter: true });
      postToApp({ type: 'ready' });
    </script>
  </body>
</html>`;
}

export { MAP_EVENT_SOURCE };
