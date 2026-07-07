import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createLeafletHtml, MAP_EVENT_SOURCE } from '../../../core/utils/leafletHtml';
import { hasValidLocation } from '../../../core/utils/geo';
import { createLogger } from '../../../core/utils/logger';

const MAP_COMMAND_SOURCE = 'fastmark-map-command';
const log = createLogger('LeafletMap');

export default function LeafletMap({
  currentLocation,
  radiusCircle,
  recenterRequest,
  restaurants,
  onEvent,
}) {
  const iframeRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const initialLocationRef = useRef(currentLocation);
  const hasCenteredRef = useRef(false);
  const pendingCommandsRef = useRef([]);
  const [ready, setReady] = useState(false);

  onEventRef.current = onEvent;

  const html = useMemo(
    () => createLeafletHtml({ currentLocation: initialLocationRef.current }),
    []
  );

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

  useEffect(() => {
    if (!ready || !hasValidLocation(currentLocation)) {
      return;
    }

    sendCommand({
      type: 'location',
      location: currentLocation,
      recenter: !hasCenteredRef.current,
    });

    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
    }
  }, [currentLocation, ready]);

  useEffect(() => {
    sendCommand({ type: 'showRestaurants', restaurants });
  }, [restaurants, ready]);

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

    sendCommand({
      type: 'recenter',
      location,
      radius: radiusCircle?.radius ?? null,
    });
  }, [recenterRequest, radiusCircle?.radius, ready]);

  return (
    <View style={styles.container}>
      {React.createElement('iframe', {
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
