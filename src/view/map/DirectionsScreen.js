import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchRouteGeometry } from '../../api/routingApi';
import {
  formatDistanceLabel,
  getDistanceFromCurrentLocation,
  hasValidLocation,
  calculateDistanceMeters,
} from '../../core/utils/geo';
import { ROUTING_PROFILE } from '../../constants/routingProfile';
import {
  computeRemainingRouteStats,
  findNearestSegmentIndex,
  hasArrivedAtDestination,
  shouldRerouteRoute,
} from '../../core/utils/routeNavigation';
import useLocationWatcher from '../../hooks/useLocationWatcher';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import LeafletMap from '../shared/components/LeafletMap';
import CircularBackButton from '../shared/components/CircularBackButton';

const ROUTE_PROFILE = ROUTING_PROFILE.MOTORBIKE;
const REROUTE_THRESHOLD_METERS = 30;
const ARRIVAL_THRESHOLD_METERS = 20;
const REROUTE_COOLDOWN_MS = 10000;
const ROUTE_TRIM_MIN_MOVE_METERS = 12;
const ROUTE_TRIM_MIN_INTERVAL_MS = 800;
const DISPLAY_DISTANCE_THROTTLE_MS = 700;

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export default function DirectionsScreen({
  session,
  onStop,
}) {
  const mountedRef = useRef(true);
  const fullRouteRef = useRef(null);
  const routeFetchInFlightRef = useRef(false);
  const routeFetchFailedRef = useRef(false);
  const hasArrivedRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const lastSegmentIndexRef = useRef(0);
  const lastRouteTrimAtRef = useRef(0);
  const lastRouteTrimLocationRef = useRef(null);
  const insets = useScreenInsets();

  const liveLocation = useLocationWatcher({
    mode: 'navigation',
    enabled: true,
    seedLocation: session?.initialLocation ?? null,
  });

  const [routePolyline, setRoutePolyline] = useState(null);
  const [recenterRequest, setRecenterRequest] = useState(null);
  const [followUser, setFollowUser] = useState(true);
  const [displayDistanceMeters, setDisplayDistanceMeters] = useState(null);

  const destination = session?.destination ?? null;
  const storeAvatar = String(session?.storeAvatar || '').trim();

  const destinationWithIcon = useMemo(() => {
    if (!destination) {
      return null;
    }
    return {
      ...destination,
      image_url: storeAvatar || destination.image_url || '',
      type: 'shop',
    };
  }, [destination, storeAvatar]);

  useEffect(() => {
    mountedRef.current = true;
    fullRouteRef.current = null;
    routeFetchInFlightRef.current = false;
    routeFetchFailedRef.current = false;
    hasArrivedRef.current = false;
    lastRerouteAtRef.current = 0;
    lastSegmentIndexRef.current = 0;
    lastRouteTrimAtRef.current = 0;
    lastRouteTrimLocationRef.current = null;
    setRoutePolyline(null);
    setFollowUser(true);
    setDisplayDistanceMeters(null);

    return () => {
      mountedRef.current = false;
      fullRouteRef.current = null;
      routeFetchInFlightRef.current = false;
    };
  }, [destinationWithIcon?.latitude, destinationWithIcon?.longitude]);

  const applyRemainingRoute = useCallback(
    (origin, fullRoute, { fitBounds = false } = {}) => {
      const remaining = computeRemainingRouteStats(
        origin,
        fullRoute.coordinates,
        fullRoute.distanceMeters,
        fullRoute.durationSeconds
      );

      setRoutePolyline({
        coordinates: remaining.coordinates,
        destination: destinationWithIcon,
        fitBounds,
      });
    },
    [destinationWithIcon]
  );

  const markRouteTrimmed = useCallback((origin) => {
    lastRouteTrimAtRef.current = Date.now();
    lastRouteTrimLocationRef.current = origin ? { ...origin } : null;
  }, []);

  const updateDisplayDistance = useThrottledCallback((origin) => {
    setDisplayDistanceMeters(getDistanceFromCurrentLocation(origin, destinationWithIcon));
  }, DISPLAY_DISTANCE_THROTTLE_MS);

  const fetchAndApplyRoute = useCallback(
    async (origin, { fitBounds = false } = {}) => {
      if (
        !mountedRef.current ||
        !hasValidLocation(origin) ||
        !hasValidLocation(destinationWithIcon) ||
        routeFetchInFlightRef.current
      ) {
        return null;
      }

      routeFetchInFlightRef.current = true;

      try {
        const geometry = await fetchRouteGeometry(origin, destinationWithIcon, { profile: ROUTE_PROFILE });
        if (!mountedRef.current) {
          return null;
        }

        if (!geometry?.coordinates?.length) {
          if (!routeFetchFailedRef.current) {
            routeFetchFailedRef.current = true;
            Alert.alert('Chỉ đường', 'Không tính được lộ trình.');
          }
          return null;
        }

        routeFetchFailedRef.current = false;
        fullRouteRef.current = geometry;
        applyRemainingRoute(origin, geometry, { fitBounds });
        markRouteTrimmed(origin);
        return geometry;
      } catch (error) {
        if (mountedRef.current && !routeFetchFailedRef.current) {
          routeFetchFailedRef.current = true;
          Alert.alert(
            'Chỉ đường',
            'Không kết nối được máy chủ lộ trình. Kiểm tra backend đang chạy.'
          );
        }
        return null;
      } finally {
        routeFetchInFlightRef.current = false;
      }
    },
    [applyRemainingRoute, destinationWithIcon, markRouteTrimmed]
  );

  const hasRoutePolyline = Boolean(routePolyline?.coordinates?.length);

  const shouldTrimRouteNow = useCallback((origin) => {
    const now = Date.now();
    const lastAt = lastRouteTrimAtRef.current;
    const lastLocation = lastRouteTrimLocationRef.current;

    if (!lastLocation || !lastAt) {
      return true;
    }

    if (now - lastAt >= ROUTE_TRIM_MIN_INTERVAL_MS) {
      return true;
    }

    const movedMeters = calculateDistanceMeters(lastLocation, origin);
    return movedMeters != null && movedMeters >= ROUTE_TRIM_MIN_MOVE_METERS;
  }, []);

  const processNavigationUpdate = useCallback(
    (origin) => {
      if (!mountedRef.current || !hasValidLocation(origin) || !hasValidLocation(destinationWithIcon)) {
        return;
      }

      if (hasArrivedAtDestination(origin, destinationWithIcon, ARRIVAL_THRESHOLD_METERS)) {
        if (!hasArrivedRef.current) {
          hasArrivedRef.current = true;
          Alert.alert(
            'Đã đến nơi',
            `Bạn đã đến gần ${session?.storeName || 'điểm đích'}.`,
            [{ text: 'OK' }]
          );
        }
        return;
      }

      const fullRoute = fullRouteRef.current;
      if (!fullRoute?.coordinates?.length) {
        fetchAndApplyRoute(origin, { fitBounds: true });
        return;
      }

      const progress = findNearestSegmentIndex(
        origin,
        fullRoute.coordinates,
        lastSegmentIndexRef.current
      );
      lastSegmentIndexRef.current = progress.segmentIndex;
      const offRouteMeters = progress.distanceMeters;

      if (shouldRerouteRoute(offRouteMeters, REROUTE_THRESHOLD_METERS)) {
        const now = Date.now();
        if (now - lastRerouteAtRef.current >= REROUTE_COOLDOWN_MS) {
          lastRerouteAtRef.current = now;
          fetchAndApplyRoute(origin, { fitBounds: false });
        } else if (shouldTrimRouteNow(origin)) {
          markRouteTrimmed(origin);
          applyRemainingRoute(origin, fullRoute, { fitBounds: false });
        }
        return;
      }

      if (!shouldTrimRouteNow(origin)) {
        return;
      }

      markRouteTrimmed(origin);
      applyRemainingRoute(origin, fullRoute, { fitBounds: false });
    },
    [
      applyRemainingRoute,
      destinationWithIcon,
      fetchAndApplyRoute,
      markRouteTrimmed,
      session?.storeName,
      shouldTrimRouteNow,
    ]
  );

  useEffect(() => {
    if (!hasValidLocation(liveLocation)) {
      return undefined;
    }

    updateDisplayDistance(liveLocation);
    processNavigationUpdate(liveLocation);
    return undefined;
  }, [liveLocation, processNavigationUpdate, updateDisplayDistance]);

  const handleMapEvent = useCallback((payload) => {
    if (payload?.type === 'userMovedMap') {
      setFollowUser(false);
    }
  }, []);

  const handleRecenterPress = useCallback(() => {
    if (!hasValidLocation(liveLocation)) {
      return;
    }
    setFollowUser(false);
    setRecenterRequest({
      location: liveLocation,
      at: Date.now(),
    });
  }, [liveLocation]);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <LeafletMap
          currentLocation={liveLocation}
          recenterRequest={recenterRequest}
          routePolyline={routePolyline}
          restaurants={[]}
          navigationMode
          followUser={followUser}
          onEvent={handleMapEvent}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Về vị trí của tôi"
          style={({ pressed }) => [styles.recenterButton, pressed && styles.pressed]}
          onPress={handleRecenterPress}
        >
          <Text style={styles.recenterButtonText}>Về vị trí của tôi</Text>
        </Pressable>
      </View>

      <View style={[styles.directionsCard, { paddingBottom: 12 + insets.bottomSpacing }]}>
        <View style={styles.directionsTopRow}>
          <CircularBackButton
            onPress={onStop}
            variant="surface"
            accessibilityLabel="Thoát chỉ đường"
          />
          <View style={styles.directionsCardHeader}>
            {isRemoteIcon(storeAvatar) ? (
              <Image source={{ uri: storeAvatar }} style={styles.directionsCardImage} />
            ) : (
              <View style={styles.directionsCardImagePlaceholder}>
                <Text style={styles.directionsCardIcon}>🏪</Text>
              </View>
            )}
            <View style={styles.directionsCardTitles}>
              <Text style={styles.directionsTitle}>
                Chỉ đường đến: {session?.storeName || 'Gian hàng'}
              </Text>
              {Number.isFinite(displayDistanceMeters) ? (
                <Text style={styles.directionsLiveMeta}>
                  Còn khoảng {formatDistanceLabel(displayDistanceMeters)} phía trước
                </Text>
              ) : (
                <Text style={styles.directionsLiveMeta}>
                  {!hasValidLocation(liveLocation)
                    ? 'Đang lấy vị trí GPS...'
                    : hasRoutePolyline
                      ? 'Đang cập nhật khoảng cách...'
                      : 'Đang tính lộ trình...'}
                </Text>
              )}
            </View>
          </View>
        </View>
        <View style={styles.directionsActions}>
          <Pressable style={[styles.directionsSecondaryBtn, styles.directionsSecondaryBtnFull]} onPress={onStop}>
            <Text style={styles.directionsSecondaryText}>Tắt chỉ đường</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f0',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
  },
  topBar: {
    position: 'absolute',
    top: 8,
    left: 14,
    zIndex: 20,
  },
  directionsTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  recenterButton: {
    position: 'absolute',
    right: 14,
    bottom: 20,
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 20,
  },
  recenterButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  directionsCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  directionsCardHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  directionsCardIcon: {
    fontSize: 22,
  },
  directionsCardImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  directionsCardImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  directionsCardTitles: {
    flex: 1,
    gap: 4,
  },
  directionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  directionsLiveMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#076F32',
  },
  directionsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  directionsSecondaryBtnFull: {
    flex: 1,
  },
  directionsSecondaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  directionsPrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  directionsPrimaryBtnDisabled: {
    opacity: 0.7,
  },
  directionsPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
