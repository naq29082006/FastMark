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

      .leaflet-bottom.leaflet-right {
        margin-bottom: 154px;
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
      .marker-snack { background: #10b981; }

      .fastmark-restaurant-icon {
        background: transparent !important;
        border: none !important;
      }

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
        background: #0f766e;
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

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
      }).setView(getLatLng(startLocation), 18);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

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
          color: '#0f766e',
          weight: 2,
          opacity: 0.85,
          fillColor: '#14b8a6',
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
          const emoji = getRestaurantEmoji(r.type);
          
          const icon = L.divIcon({
            className: 'fastmark-restaurant-icon',
            html: '<div class="restaurant-marker marker-' + (r.type || 'food') + '">' + emoji + '</div>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
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
            '<b style="font-size: 14px; color: #0f172a;">' + restaurantData.name + '</b><br>' +
            '<span style="font-size: 12px; color: #475569;">' + restaurantData.address + '</span>' +
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
      }

      window.FastmarkMap = { receive, openRestaurant };

      window.addEventListener('message', function(event) {
        const data = event.data || {};
        const command = data.source === 'fastmark-map-command' ? data.payload : data;
        receive(command);
      });

      map.on('click', function(event) {
        postToApp({
          type: 'mapTap',
          location: toLocation(event.latlng),
        });
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
