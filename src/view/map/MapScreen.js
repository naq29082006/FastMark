import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import LeafletMap from '../shared/components/LeafletMap';
import { MOCK_STORES } from '../../model/mock/storeMockData';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import { calculateDistanceMeters, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { loadRestaurants } from '../../viewmodel/map/mapViewModel';
import { mapLogger as log } from '../../core/utils/logger';

const TYPE_EMOJI = {
  cafe: '☕',
  food: '🍜',
  milktea: '🧋',
  snack: '🍿',
};

export default function MapScreen({ children, focusStoreRequest }) {
  const watcherRef = useRef(null);
  const mountedRef = useRef(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [recenterRequest, setRecenterRequest] = useState(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(500);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [restaurants, setRestaurants] = useState([]);
  const [storeNav, setStoreNav] = useState(null);
  const lastAcceptedRef = useRef(null);

  const openStore = useCallback((storeId) => {
    log.info('openStore', { storeId });
    setStoreNav({ screen: 'store', storeId: String(storeId) });
  }, []);

  const openProduct = useCallback((productId) => {
    setStoreNav((prev) => ({
      screen: 'product',
      productId: String(productId),
      storeId: prev?.storeId,
    }));
  }, []);

  const closeStoreNav = useCallback(() => {
    setStoreNav(null);
  }, []);

  const goBackStoreNav = useCallback(() => {
    setStoreNav((prev) => {
      if (prev?.screen === 'product' && prev.storeId) {
        return { screen: 'store', storeId: prev.storeId };
      }
      return null;
    });
  }, []);

  const startLocationTracking = useCallback(async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;

    const updateLocationSafely = (loc) => {
      if (!loc || !mountedRef.current) {
        return;
      }

      const prev = lastAcceptedRef.current;
      if (!prev) {
        lastAcceptedRef.current = loc;
        log.ok('location:first-fix', { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy });
        setCurrentLocation(loc);
        return;
      }

      if (loc.accuracy > 150) {
        log.debug('location:skip-low-accuracy', { accuracy: loc.accuracy });
        return;
      }

      const dist = calculateDistanceMeters(prev, loc);
      if (dist !== null && dist < 3) {
        return;
      }

      lastAcceptedRef.current = loc;
      log.debug('location:update', { lat: loc.latitude, lng: loc.longitude, dist });
      setCurrentLocation(loc);
    };

    try {
      log.info('location:request-permission');
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!mountedRef.current || permission.status !== 'granted') {
        log.warn('location:permission-denied', { status: permission.status });
        return;
      }

      log.ok('location:permission-granted');

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 60000,
        requiredAccuracy: 200,
      }).catch(() => null);

      if (mountedRef.current && lastKnown) {
        updateLocationSafely(normalizeExpoLocation(lastKnown));
      }

      const preciseLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);

      if (mountedRef.current && preciseLocation) {
        updateLocationSafely(normalizeExpoLocation(preciseLocation));
      }

      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1,
          timeInterval: 2000,
        },
        (location) => {
          updateLocationSafely(normalizeExpoLocation(location));
        }
      );

      if (mountedRef.current) {
        watcherRef.current = watcher;
      } else {
        watcher.remove();
      }
    } catch (error) {
      log.fail('location:tracking-failed', error);
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

  useEffect(() => {
    if (selectedCategory === 'none') {
      setRestaurants([]);
      return;
    }

    let isCurrent = true;
    log.info('fetchRestaurants:map', { category: selectedCategory });
    loadRestaurants(selectedCategory).then((data) => {
      if (isCurrent) {
        log.ok('fetchRestaurants:map-loaded', { category: selectedCategory, count: data.length });
        setRestaurants(data);
      }
    }).catch((error) => {
      log.fail('fetchRestaurants:map-failed', error);
    });

    return () => {
      isCurrent = false;
    };
  }, [selectedCategory]);

  useEffect(() => {
    const targetStoreId = focusStoreRequest?.storeId;
    if (!targetStoreId) {
      return;
    }

    const targetStore = MOCK_STORES.find((store) => String(store.id) === String(targetStoreId));
    if (!targetStore?.latitude || !targetStore?.longitude) {
      return;
    }

    setMenuVisible(false);
    setSelectedCategory('all');
    setSelectedRadius(null);
    setStoreNav(null);
    setRecenterRequest({
      location: {
        latitude: targetStore.latitude,
        longitude: targetStore.longitude,
      },
      at: focusStoreRequest.at || Date.now(),
    });
    log.info('focusStoreRequest', { storeId: targetStoreId });
  }, [focusStoreRequest]);

  const visibleRestaurants = useMemo(() => {
    if (!hasValidLocation(currentLocation) || restaurants.length === 0) {
      return restaurants;
    }
    if (!selectedRadius) {
      return restaurants;
    }
    return restaurants.filter((r) => {
      if (!r.latitude || !r.longitude) return false;
      const dist = calculateDistanceMeters(currentLocation, {
        latitude: r.latitude,
        longitude: r.longitude,
      });
      return dist !== null && dist <= selectedRadius;
    });
  }, [restaurants, currentLocation, selectedRadius]);

  const radiusCircleProp =
    selectedRadius && hasValidLocation(currentLocation)
      ? { center: currentLocation, radius: selectedRadius }
      : null;

  function requestRecenter(location) {
    lastAcceptedRef.current = location;
    setCurrentLocation(location);
    setRecenterRequest({ location, at: Date.now() });
  }

  function handleRecenterPress() {
    log.info('recenter:pressed');

    const cached = lastAcceptedRef.current || currentLocation;
    if (hasValidLocation(cached)) {
      requestRecenter(cached);
      log.info('recenter:instant', { lat: cached.latitude, lng: cached.longitude });
    }

    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (permission.status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync();
          if (requested.status !== 'granted') {
            return null;
          }
        }

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 30000,
          requiredAccuracy: 500,
        }).catch(() => null);

        if (lastKnown) {
          return normalizeExpoLocation(lastKnown);
        }

        return Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).then(normalizeExpoLocation);
      })
      .then((loc) => {
        if (loc && hasValidLocation(loc)) {
          requestRecenter(loc);
          log.debug('recenter:gps-refined', { lat: loc.latitude, lng: loc.longitude });
        } else if (!hasValidLocation(cached)) {
          log.warn('recenter:no-location-restart-tracking');
          startLocationTracking();
        }
      })
      .catch((error) => {
        log.fail('recenter:gps-failed', error);
        if (!hasValidLocation(cached)) {
          startLocationTracking();
        }
      });
  }

  const handleMapEvent = useCallback((payload) => {
    log.debug('mapEvent', payload?.type, payload);
    if (payload?.type === 'restaurantTap' && payload.restaurant?.id != null) {
      openStore(payload.restaurant.id);
    }
  }, [openStore]);

  const radiusOptions = [
    { key: null, label: '🚫 Tắt bán kính' },
    { key: 100, label: '📍 100 m' },
    { key: 500, label: '📍 500 m' },
    { key: 1000, label: '📍 1 km' },
    { key: 2000, label: '📍 2 km' },
  ];

  const restaurantCategories = [
    { key: 'none', label: '🚫 Ẩn tất cả' },
    { key: 'all', label: '🌐 Tất cả quán' },
    { key: 'cafe', label: '☕ Cà phê' },
    { key: 'food', label: '🍜 Quán ăn' },
    { key: 'milktea', label: '🧋 Trà sữa' },
    { key: 'snack', label: '🍿 Ăn vặt' },
  ];

  const showNearbyPanel =
    selectedCategory !== 'none' && visibleRestaurants.length > 0 && !storeNav;

  if (storeNav?.screen === 'store') {
    return (
      <StoreDetailScreen
        storeId={storeNav.storeId}
        onBack={closeStoreNav}
        onProductPress={openProduct}
      />
    );
  }

  if (storeNav?.screen === 'product') {
    return (
      <ProductDetailScreen
        productId={storeNav.productId}
        onBack={goBackStoreNav}
        onStorePress={openStore}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea} pointerEvents="box-none">
        <LeafletMap
          currentLocation={currentLocation}
          radiusCircle={radiusCircleProp}
          recenterRequest={recenterRequest}
          restaurants={visibleRestaurants}
          onEvent={handleMapEvent}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bộ lọc bản đồ"
          pointerEvents="auto"
          style={({ pressed }) => [
            styles.mapFab,
            styles.settingsFab,
            pressed && styles.mapFabPressed,
            menuVisible && styles.settingsFabActive,
          ]}
          onPress={() => setMenuVisible(!menuVisible)}
        >
          <Text style={[styles.settingsFabIcon, menuVisible && styles.settingsFabIconActive]}>
            {menuVisible ? '✕' : '⚙️'}
          </Text>
        </Pressable>

        {menuVisible && (
          <View style={styles.filterPanel} pointerEvents="auto">
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.menuHeader}>Bộ lọc bản đồ</Text>

              <Text style={styles.menuSubHeader}>Bán kính hiển thị</Text>
              {radiusOptions.map((opt) => {
                const isSelected = selectedRadius === opt.key;
                return (
                  <Pressable
                    key={String(opt.key)}
                    style={[styles.categoryItem, isSelected && styles.categoryItemActive]}
                    onPress={() => setSelectedRadius(opt.key)}
                  >
                    <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                );
              })}

              <View style={styles.divider} />

              <Text style={styles.menuSubHeader}>Loại quán</Text>
              {restaurantCategories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    style={[styles.categoryItem, isSelected && styles.categoryItemActive]}
                    onPress={() => setSelectedCategory(cat.key)}
                  >
                    <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                      {cat.label}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Về vị trí của tôi"
          pointerEvents="auto"
          style={({ pressed }) => [
            styles.recenterButton,
            pressed && styles.mapFabPressed,
          ]}
          onPress={handleRecenterPress}
        >
          <Text style={styles.recenterButtonText}>Về vị trí của tôi</Text>
        </Pressable>

        {children}
      </View>

      <View style={styles.nearbyPanel}>
        <Text style={styles.nearbyTitle}>
          {showNearbyPanel ? `${visibleRestaurants.length} quán gần bạn — chạm để xem` : 'Chọn loại quán để xem danh sách'}
        </Text>
        {showNearbyPanel ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nearbyList}
          >
            {visibleRestaurants.map((restaurant) => (
              <Pressable
                key={String(restaurant.id)}
                style={({ pressed }) => [
                  styles.nearbyCard,
                  pressed && styles.nearbyCardPressed,
                ]}
                onPress={() => openStore(restaurant.id)}
              >
                <Text style={styles.nearbyEmoji}>
                  {TYPE_EMOJI[restaurant.type] || '🏪'}
                </Text>
                <Text style={styles.nearbyName} numberOfLines={2}>
                  {restaurant.name}
                </Text>
                <Text style={styles.nearbyAction}>Xem gian hàng →</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
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
    minHeight: 260,
    position: 'relative',
  },
  nearbyPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  nearbyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  nearbyList: {
    paddingHorizontal: 12,
    gap: 10,
  },
  nearbyCard: {
    width: 140,
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  nearbyCardPressed: {
    opacity: 0.8,
    backgroundColor: '#ccfbf1',
  },
  nearbyEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  nearbyName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    minHeight: 34,
    marginBottom: 6,
  },
  nearbyAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
  },
  mapFab: {
    position: 'absolute',
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 20,
  },
  mapFabPressed: {
    opacity: 0.85,
  },
  settingsFab: {
    top: '42%',
  },
  settingsFabActive: {
    backgroundColor: '#0f766e',
  },
  settingsFabIcon: {
    fontSize: 20,
    color: '#0f172a',
  },
  settingsFabIconActive: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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
  filterPanel: {
    position: 'absolute',
    right: 66,
    top: '24%',
    width: 240,
    maxHeight: '52%',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 25,
  },
  menuHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  menuSubHeader: {
    fontSize: 12,
    fontWeight: '750',
    color: '#64748b',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryItemActive: {
    backgroundColor: '#f1f5f9',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#0f766e',
    fontWeight: '800',
  },
  checkmark: {
    fontSize: 13,
    color: '#0f766e',
    fontWeight: 'bold',
  },
});
