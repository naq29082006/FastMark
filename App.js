import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

import LeafletMap from './src/components/LeafletMap';
import { hasValidLocation, normalizeExpoLocation } from './src/utils/geo';

export default function App() {
  const watcherRef = useRef(null);
  const mountedRef = useRef(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const startLocationTracking = useCallback(async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!mountedRef.current) {
        return;
      }

      if (permission.status !== 'granted') {
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 60000,
        requiredAccuracy: 1000,
      }).catch(() => null);

      if (mountedRef.current && lastKnown) {
        setCurrentLocation(normalizeExpoLocation(lastKnown));
      }

      const preciseLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);

      if (mountedRef.current && preciseLocation) {
        setCurrentLocation(normalizeExpoLocation(preciseLocation));
      }

      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 3,
          timeInterval: 2500,
        },
        (location) => {
          const nextLocation = normalizeExpoLocation(location);

          if (nextLocation) {
            setCurrentLocation(nextLocation);
          }
        }
      );

      if (mountedRef.current) {
        watcherRef.current = watcher;
      } else {
        watcher.remove();
      }
    } catch {
      // Keep the map usable even when the device cannot provide a location.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startLocationTracking();

    return () => {
      mountedRef.current = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [startLocationTracking]);

  function handleRecenterPress() {
    if (hasValidLocation(currentLocation)) {
      setRecenterSignal((value) => value + 1);
      return;
    }

    startLocationTracking();
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LeafletMap
        currentLocation={currentLocation}
        measureEnabled={false}
        clearSignal={0}
        recenterSignal={recenterSignal}
      />

      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.recenterButton,
            pressed && styles.recenterButtonPressed,
          ]}
          onPress={handleRecenterPress}
        >
          <Text style={styles.recenterButtonText}>Về vị trí của tôi</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f0',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 16,
    paddingBottom: 16,
  },
  recenterButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    boxShadow: '0 10px 24px rgba(14, 165, 233, 0.28)',
  },
  recenterButtonPressed: {
    opacity: 0.78,
  },
  recenterButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
});
