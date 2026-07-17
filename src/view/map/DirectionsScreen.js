import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { formatDistanceMeters, formatDurationSeconds } from '../../core/utils/pickupDateTime';
import { calculateDistanceMeters, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import LeafletMap from '../shared/components/LeafletMap';
import CircularBackButton from '../shared/components/CircularBackButton';

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export default function DirectionsScreen({
  session,
  onStop,
}) {
  const watcherRef = useRef(null);
  const mountedRef = useRef(true);
  const insets = useScreenInsets();
  const [liveLocation, setLiveLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [recenterRequest, setRecenterRequest] = useState(null);
  const [routeRequest, setRouteRequest] = useState(null);

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
    let active = true;

    async function startNavigationTracking() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') {
          return;
        }

        const last = await Location.getLastKnownPositionAsync();
        if (last && active) {
          setLiveLocation(normalizeExpoLocation(last));
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        if (current && active) {
          setLiveLocation(normalizeExpoLocation(current));
        }

        watcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 2,
            timeInterval: 2000,
          },
          (position) => {
            if (!mountedRef.current) {
              return;
            }
            setLiveLocation(normalizeExpoLocation(position));
          }
        );
      } catch (error) {
        Alert.alert('Vị trí', error.message || 'Không theo dõi được vị trí hiện tại.');
      }
    }

    startNavigationTracking();

    return () => {
      active = false;
      mountedRef.current = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (routeRequest || !hasValidLocation(liveLocation) || !hasValidLocation(destinationWithIcon)) {
      return;
    }

    setRouteRequest({
      from: liveLocation,
      to: destinationWithIcon,
      at: Date.now(),
    });
  }, [liveLocation, destinationWithIcon, routeRequest]);

  const handleMapEvent = useCallback((payload) => {
    if (payload?.type === 'routeReady') {
      setRouteInfo({
        distance: payload.distance,
        duration: payload.duration,
      });
      return;
    }
    if (payload?.type === 'routeError') {
      setRouteInfo(null);
      Alert.alert('Chỉ đường', payload.message || 'Không vẽ được lộ trình.');
    }
  }, []);

  const handleRecenterPress = useCallback(() => {
    if (!hasValidLocation(liveLocation)) {
      return;
    }
    setRecenterRequest({
      location: liveLocation,
      at: Date.now(),
    });
  }, [liveLocation]);

  const remainingDistance = useMemo(() => {
    if (!hasValidLocation(liveLocation) || !hasValidLocation(destinationWithIcon)) {
      return null;
    }
    return calculateDistanceMeters(liveLocation, destinationWithIcon);
  }, [liveLocation, destinationWithIcon]);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <LeafletMap
          currentLocation={liveLocation}
          recenterRequest={recenterRequest}
          routeRequest={routeRequest}
          restaurants={[]}
          navigationMode
          onEvent={handleMapEvent}
        />

        <View style={styles.topBar} pointerEvents="box-none">
          <CircularBackButton
            onPress={onStop}
            variant="surface"
            accessibilityLabel="Thoát chỉ đường"
          />
        </View>

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
        <View style={styles.directionsCardHeader}>
          {isRemoteIcon(storeAvatar) ? (
            <Image source={{ uri: storeAvatar }} style={styles.directionsCardImage} />
          ) : (
            <View style={styles.directionsCardImagePlaceholder}>
              <Text style={styles.directionsCardIcon}>🏪</Text>
            </View>
          )}
          <View style={styles.directionsCardTitles}>
            <Text style={styles.directionsTitle}>Chỉ đường đến {session?.storeName || 'Gian hàng'}</Text>
            {routeInfo ? (
              <Text style={styles.directionsMeta}>
                {formatDistanceMeters(routeInfo.distance)} • {formatDurationSeconds(routeInfo.duration)}
              </Text>
            ) : (
              <Text style={styles.directionsMeta}>Đang tính lộ trình...</Text>
            )}
            {remainingDistance != null ? (
              <Text style={styles.directionsLiveMeta}>
                Còn khoảng {formatDistanceMeters(remainingDistance)} từ vị trí hiện tại
              </Text>
            ) : null}
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
  recenterButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
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
  directionsMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f766e',
  },
  directionsLiveMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
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
    backgroundColor: '#0f766e',
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
