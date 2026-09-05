import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createLeafletHtml, LEAFLET_HTML_REVISION, MAP_EVENT_SOURCE } from '../../../core/utils/leafletHtml';
import { hasValidLocation } from '../../../core/utils/geo';
import { createLogger } from '../../../core/utils/logger';
import { useDebouncedMapRestaurants } from '../../../hooks/useDebouncedMapRestaurants';
import { useThrottledCallback } from '../../../hooks/useThrottledCallback';

const MAP_COMMAND_SOURCE = 'fastmark-map-command';
const log = createLogger('LeafletMap');
const NAV_LOCATION_THROTTLE_MS = 80;
const NAV_ROUTE_THROTTLE_MS = 500;

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
  const iframeRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const initialLocationRef = useRef(currentLocation);
  const hasCenteredRef = useRef(false);
  const pendingCommandsRef = useRef([]);
  const routePolylineRef = useRef(routePolyline);
  const [ready, setReady] = useState(false);

  onEventRef.current = onEvent;
  routePolylineRef.current = routePolyline;

  const html = useMemo(
    () =>
      createLeafletHtml({
        currentLocation: initialLocationRef.current,
        navigationMode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [LEAFLET_HTML_REVISION, navigationMode]
  );

  useEffect(() => {
    setReady(false);
    hasCenteredRef.current = false;
    pendingCommandsRef.current = [];
  }, [LEAFLET_HTML_REVISION]);

  function sendCommand(command) {
    if (!ready || !iframeRef.current?.contentWindow) {
      log.debug('sendCommand:queue-not-ready', command?.type);
      pendingCommandsRef.current.push(command);
      return;
    }

    log.debug('sendCommand', command?.type, command);
    iframeRef.current.contentWindow.postMessage(
      { source: MAP_COMMAND_SOURCE, payload: command },
      '*'
    );
  }

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

  useEffect(() => {
    if (!ready || pendingCommandsRef.current.length === 0) {
      return;
    }

    const queued = [...pendingCommandsRef.current];
    pendingCommandsRef.current = [];
    queued.forEach((command) => sendCommand(command));
  }, [ready]);

  useEffect(() => {
    function handleMessage(event) {
      const message = event.data;

      if (message?.source === MAP_EVENT_SOURCE) {
        log.debug('iframe:event', message.payload?.type, message.payload);
        onEventRef.current?.(message.payload);
      }
    }

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [onEvent]);

  useDebouncedMapRestaurants(restaurants, ready, sendCommand);

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
    if (!ready || !shouldAutoRecenter || navigationMode) {
      return;
    }

    sendCommand({ type: 'invalidateSize' });
  }, [shouldAutoRecenter, navigationMode, ready]);

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
      {React.createElement('iframe', {
        key: LEAFLET_HTML_REVISION,
        title: 'Fastmark map',
        ref: iframeRef,
        srcDoc: html,
        style: styles.iframe,
        onLoad: () => {
          log.ok('iframe:ready');
          setReady(true);
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iframe: {
    borderWidth: 0,
    width: '100%',
    height: '100%',
  },
});
