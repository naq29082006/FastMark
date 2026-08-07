import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { createLeafletHtml, LEAFLET_HTML_REVISION, MAP_EVENT_SOURCE } from '../../../core/utils/leafletHtml';
import { hasValidLocation } from '../../../core/utils/geo';
import { createLogger } from '../../../core/utils/logger';
import { useDebouncedMapRestaurants } from '../../../hooks/useDebouncedMapRestaurants';
import { useThrottledCallback } from '../../../hooks/useThrottledCallback';

const log = createLogger('LeafletMap');
const NAV_LOCATION_THROTTLE_MS = 180;
const NAV_ROUTE_THROTTLE_MS = 350;

function parseMapMessage(data) {
  try {
    const message = JSON.parse(data);
    return message?.source === MAP_EVENT_SOURCE ? message.payload : null;
  } catch {
    return null;
  }
}

export default function LeafletMap({
  currentLocation,
  radiusCircle,
  recenterRequest,
  routeRequest,
  routePolyline,
  scanLocation,
  restaurants,
  onEvent,
  navigationMode = false,
  followUser = false,
  interactive = true,
  shouldAutoRecenter = true,
}) {
  const webViewRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const initialLocationRef = useRef(currentLocation);
  const hasCenteredRef = useRef(false);
  const pendingCommandsRef = useRef([]);
  const [ready, setReady] = useState(false);

  onEventRef.current = onEvent;

  const html = useMemo(
    () => createLeafletHtml({ currentLocation: initialLocationRef.current }),
    // Revision forces WebView HTML rebuild when marker styles change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [LEAFLET_HTML_REVISION]
  );

  useEffect(() => {
    setReady(false);
    hasCenteredRef.current = false;
    pendingCommandsRef.current = [];
  }, [LEAFLET_HTML_REVISION]);

  function flushPendingCommands() {
    if (!ready || !webViewRef.current || pendingCommandsRef.current.length === 0) {
      return;
    }

    const queued = [...pendingCommandsRef.current];
    pendingCommandsRef.current = [];
    queued.forEach((command) => {
      webViewRef.current.injectJavaScript(
        `window.FastmarkMap && window.FastmarkMap.receive(${JSON.stringify(command)}); true;`
      );
    });
  }

  function sendCommand(command) {
    if (!ready || !webViewRef.current) {
      log.debug('sendCommand:queue-not-ready', command?.type);
      pendingCommandsRef.current.push(command);
      return;
    }

    log.debug('sendCommand', command?.type, command);
    webViewRef.current.injectJavaScript(
      `window.FastmarkMap && window.FastmarkMap.receive(${JSON.stringify(command)}); true;`
    );
  }

  useDebouncedMapRestaurants(restaurants, ready, sendCommand);

  const sendNavLocationUpdate = useThrottledCallback((location, follow) => {
    sendCommand({
      type: 'updateNavigationLocation',
      location,
      followUser: follow,
    });
  }, NAV_LOCATION_THROTTLE_MS);

  const sendNavRouteUpdate = useThrottledCallback((polyline) => {
    if (!polyline?.coordinates?.length || !hasValidLocation(polyline?.destination)) {
      sendCommand({ type: 'clearRoute' });
      return;
    }

    sendCommand({
      type: 'setRoutePolyline',
      coordinates: polyline.coordinates,
      destination: polyline.destination,
      fitBounds: Boolean(polyline.fitBounds),
    });
  }, NAV_ROUTE_THROTTLE_MS);

  const routePolylineRef = useRef(routePolyline);
  routePolylineRef.current = routePolyline;

  useEffect(() => {
    flushPendingCommands();
  }, [ready]);

  useEffect(() => {
    if (!ready || !hasValidLocation(currentLocation)) {
      return;
    }

    if (navigationMode) {
      sendNavLocationUpdate(currentLocation, followUser);
      return;
    }

    sendCommand({
      type: 'location',
      location: currentLocation,
      recenter: false,
    });
  }, [currentLocation, followUser, navigationMode, ready, sendNavLocationUpdate]);

  useEffect(() => {
    if (!shouldAutoRecenter || navigationMode || !ready || !hasValidLocation(currentLocation)) {
      return;
    }
    if (hasCenteredRef.current) {
      return;
    }

    hasCenteredRef.current = true;
    sendCommand({
      type: 'recenter',
      location: currentLocation,
    });
  }, [shouldAutoRecenter, currentLocation, navigationMode, ready]);

  useEffect(() => {
    if (!navigationMode) {
      return;
    }

    const polyline = routePolylineRef.current;
    if (polyline?.fitBounds) {
      sendCommand({
        type: 'setRoutePolyline',
        coordinates: polyline.coordinates,
        destination: polyline.destination,
        fitBounds: true,
      });
      return;
    }

    sendNavRouteUpdate(polyline);
  }, [navigationMode, routePolyline, ready, sendNavRouteUpdate]);

  useEffect(() => {
    sendCommand({
      type: 'radiusCircle',
      center: radiusCircle?.center ?? null,
      radius: radiusCircle?.radius ?? null,
    });
  }, [radiusCircle, ready]);

  useEffect(() => {
    const location = recenterRequest?.location;
    if (!recenterRequest || !hasValidLocation(location)) {
      return;
    }

    hasCenteredRef.current = true;
    sendCommand({
      type: 'recenter',
      location,
      radius: radiusCircle?.radius ?? null,
    });
  }, [recenterRequest, radiusCircle?.radius, ready]);

  useEffect(() => {
    sendCommand({
      type: 'scanLocation',
      location: hasValidLocation(scanLocation) ? scanLocation : null,
    });
  }, [scanLocation, ready]);

  useEffect(() => {
    if (navigationMode) {
      return undefined;
    }

    if (!routeRequest?.to || !hasValidLocation(routeRequest.to)) {
      sendCommand({ type: 'clearRoute' });
      return undefined;
    }

    if (!hasValidLocation(routeRequest.from)) {
      return undefined;
    }

    sendCommand({
      type: 'showRoute',
      from: routeRequest.from,
      to: routeRequest.to,
    });

    return undefined;
  }, [navigationMode, routeRequest, ready]);

  useEffect(() => {
    if (!navigationMode) {
      return undefined;
    }

    return () => {
      sendCommand({ type: 'clearRoute' });
    };
  }, [navigationMode, ready]);

  return (
    <View style={styles.container} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        key={LEAFLET_HTML_REVISION}
        ref={webViewRef}
        style={styles.webView}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        pointerEvents={interactive ? 'auto' : 'none'}
        onLoadEnd={() => {
          log.ok('webview:ready');
          setReady(true);
        }}
        onMessage={(event) => {
          const payload = parseMapMessage(event.nativeEvent.data);

          if (payload) {
            log.debug('webview:event', payload?.type, payload);
            onEventRef.current?.(payload);
          }
        }}
        onError={(event) => {
          log.fail('webview:error', event.nativeEvent);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#eef2f0',
  },
});
