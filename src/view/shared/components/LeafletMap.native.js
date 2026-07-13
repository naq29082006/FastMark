import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { createLeafletHtml, MAP_EVENT_SOURCE } from '../../../core/utils/leafletHtml';
import { hasValidLocation } from '../../../core/utils/geo';
import { createLogger } from '../../../core/utils/logger';

const log = createLogger('LeafletMap');

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
  scanLocation,
  restaurants,
  onEvent,
  navigationMode = false,
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
    []
  );

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

  useEffect(() => {
    flushPendingCommands();
  }, [ready]);

  useEffect(() => {
    if (!ready || !hasValidLocation(currentLocation)) {
      return;
    }

    sendCommand({
      type: 'location',
      location: currentLocation,
      recenter: navigationMode ? false : !hasCenteredRef.current,
    });

    if (!navigationMode && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
    }
  }, [currentLocation, ready, navigationMode]);

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

  useEffect(() => {
    sendCommand({
      type: 'scanLocation',
      location: hasValidLocation(scanLocation) ? scanLocation : null,
    });
  }, [scanLocation, ready]);

  useEffect(() => {
    if (!routeRequest?.to || !hasValidLocation(routeRequest.to)) {
      sendCommand({ type: 'clearRoute' });
      return;
    }

    if (!hasValidLocation(routeRequest.from)) {
      return;
    }

    sendCommand({
      type: 'showRoute',
      from: routeRequest.from,
      to: routeRequest.to,
    });
  }, [routeRequest, ready]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.webView}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
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
