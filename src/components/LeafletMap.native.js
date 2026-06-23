import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { createLeafletHtml, MAP_EVENT_SOURCE } from '../utils/leafletHtml';
import { hasValidLocation } from '../utils/geo';

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
  measureEnabled,
  clearSignal,
  recenterSignal,
  onEvent,
}) {
  const webViewRef = useRef(null);
  const initialLocationRef = useRef(currentLocation);
  const hasCenteredLocationRef = useRef(hasValidLocation(currentLocation));
  const [ready, setReady] = useState(false);

  const html = useMemo(
    () => createLeafletHtml({ currentLocation: initialLocationRef.current }),
    []
  );

  function sendCommand(command) {
    if (!ready || !webViewRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(
      `window.FastmarkMap && window.FastmarkMap.receive(${JSON.stringify(command)}); true;`
    );
  }

  useEffect(() => {
    if (!hasValidLocation(currentLocation)) {
      return;
    }

    const shouldRecenter = !hasCenteredLocationRef.current;
    hasCenteredLocationRef.current = true;
    sendCommand({
      type: 'location',
      location: currentLocation,
      recenter: shouldRecenter,
    });
  }, [currentLocation, ready]);

  useEffect(() => {
    sendCommand({ type: 'measureMode', enabled: measureEnabled });
  }, [measureEnabled, ready]);

  useEffect(() => {
    if (clearSignal > 0) {
      sendCommand({ type: 'clearMeasure' });
    }
  }, [clearSignal, ready]);

  useEffect(() => {
    if (recenterSignal > 0 && hasValidLocation(currentLocation)) {
      sendCommand({ type: 'recenter', location: currentLocation });
    }
  }, [recenterSignal, currentLocation, ready]);

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
        onLoadEnd={() => setReady(true)}
        onMessage={(event) => {
          const payload = parseMapMessage(event.nativeEvent.data);

          if (payload) {
            onEvent?.(payload);
          }
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
