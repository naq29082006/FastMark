import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { calculateDistanceMeters, hasValidLocation, normalizeExpoLocation } from '../core/utils/geo';

const MODE_CONFIG = {
  discovery: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 1,
    timeInterval: 2000,
    minMovementMeters: 3,
    maxAccuracyMeters: 150,
    lastKnownMaxAge: 60000,
    lastKnownRequiredAccuracy: 200,
  },
  navigation: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 1,
    timeInterval: 500,
    minMovementMeters: 0,
    maxAccuracyMeters: 2000,
    lastKnownMaxAge: null,
    lastKnownRequiredAccuracy: null,
  },
};

export default function useLocationWatcher({
  mode = 'discovery',
  enabled = true,
  seedLocation = null,
  onError,
} = {}) {
  const [location, setLocation] = useState(() =>
    hasValidLocation(seedLocation) ? seedLocation : null
  );
  const watcherRef = useRef(null);
  const mountedRef = useRef(false);
  const lastAcceptedRef = useRef(null);
  const seedLocationRef = useRef(seedLocation);

  seedLocationRef.current = seedLocation;

  const config = MODE_CONFIG[mode] || MODE_CONFIG.discovery;

  const updateLocationSafely = useCallback(
    (loc) => {
      if (!loc || !mountedRef.current) {
        return;
      }

      const prev = lastAcceptedRef.current;
      if (!prev) {
        lastAcceptedRef.current = loc;
        setLocation(loc);
        return;
      }

      const dist = calculateDistanceMeters(prev, loc);
      const movedEnough =
        dist === null || dist >= config.minMovementMeters;
      const prevHeading = Number(prev.heading);
      const nextHeading = Number(loc.heading);
      const headingChanged =
        Number.isFinite(nextHeading) &&
        nextHeading >= 0 &&
        (!Number.isFinite(prevHeading) || Math.abs(nextHeading - prevHeading) >= 6);

      if (
        Number.isFinite(loc.accuracy) &&
        loc.accuracy > config.maxAccuracyMeters &&
        !movedEnough &&
        !headingChanged
      ) {
        return;
      }

      if (!movedEnough && !headingChanged) {
        return;
      }

      lastAcceptedRef.current = loc;
      setLocation(loc);
    },
    [config.maxAccuracyMeters, config.minMovementMeters]
  );

  useEffect(() => {
    mountedRef.current = true;
    lastAcceptedRef.current = null;

    if (!enabled) {
      setLocation(null);
      return () => {
        mountedRef.current = false;
      };
    }

    const seed = seedLocationRef.current;
    if (hasValidLocation(seed)) {
      lastAcceptedRef.current = seed;
      setLocation(seed);
    }

    let active = true;

    async function startTracking() {
      watcherRef.current?.remove();
      watcherRef.current = null;

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') {
          return;
        }

        const lastKnownOptions =
          config.lastKnownMaxAge != null
            ? { maxAge: config.lastKnownMaxAge, requiredAccuracy: config.lastKnownRequiredAccuracy }
            : undefined;

        const lastKnown = await Location.getLastKnownPositionAsync(lastKnownOptions).catch(() => null);
        if (active && lastKnown) {
          updateLocationSafely(normalizeExpoLocation(lastKnown));
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: config.accuracy,
        }).catch(() => null);

        if (active && current) {
          updateLocationSafely(normalizeExpoLocation(current));
        }

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: config.accuracy,
            distanceInterval: config.distanceInterval,
            timeInterval: config.timeInterval,
          },
          (position) => {
            updateLocationSafely(normalizeExpoLocation(position));
          }
        );

        if (active && mountedRef.current) {
          watcherRef.current = watcher;
        } else {
          watcher.remove();
        }
      } catch (error) {
        if (active) {
          onError?.(error);
        }
      }
    }

    startTracking();

    return () => {
      active = false;
      mountedRef.current = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [config, enabled, onError, updateLocationSafely]);

  return location;
}
