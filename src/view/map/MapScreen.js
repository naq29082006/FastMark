import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import LeafletMap from '../shared/components/LeafletMap';
import AddressSearchBar from './AddressSearchBar';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import { calculateDistanceMeters, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { loadRestaurants, loadNearbyRegisteredShops } from '../../viewmodel/map/mapViewModel';
import { loadStoreById } from '../../viewmodel/store/storeViewModel';
import { mapLogger as log } from '../../core/utils/logger';

const TYPE_EMOJI = {
  cafe: '☕',
  food: '🍜',
  milktea: '🧋',
  snack: '🍿',
  shop: '🏪',
};

export default function MapScreen({ children, focusStoreRequest, onOpenChat }) {
  const watcherRef = useRef(null);
  const mountedRef = useRef(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [recenterRequest, setRecenterRequest] = useState(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(2000);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [restaurants, setRestaurants] = useState([]);
  const [registeredShops, setRegisteredShops] = useState([]);
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
    if (selectedCategory === 'none' || selectedCategory === 'shop') {
      setRestaurants([]);
      return undefined;
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
    if (selectedCategory === 'none') {
      setRegisteredShops([]);
      return undefined;
    }

    if (!hasValidLocation(currentLocation)) {
      return undefined;
    }

    let isCurrent = true;
    const effectiveRadius = selectedRadius ?? 20000;

    log.info('fetchRegisteredShops:map', {
      lat: currentLocation.latitude,
      lng: currentLocation.longitude,
      radiusMeters: effectiveRadius,
    });

    loadNearbyRegisteredShops({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      radiusMeters: effectiveRadius,
    })
      .then((data) => {
        if (isCurrent) {
          log.ok('fetchRegisteredShops:map-loaded', { count: data.length });
          setRegisteredShops(data);
        }
      })
      .catch((error) => {
        log.fail('fetchRegisteredShops:map-failed', error);
      });

    return () => {
      isCurrent = false;
    };
  }, [currentLocation, selectedRadius, selectedCategory]);

  useEffect(() => {
    const targetStoreId = focusStoreRequest?.storeId;
    const targetLocation = focusStoreRequest?.location;

    if (targetLocation?.latitude && targetLocation?.longitude) {
      setMenuVisible(false);
      setRecenterRequest({
        location: {
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
        },
        at: focusStoreRequest.at || Date.now(),
      });
      log.info('focusLocationRequest', targetLocation);
      return undefined;
    }

    if (!targetStoreId) {
      return undefined;
    }

    let isCurrent = true;

    function applyFocus(targetStore) {
      if (!isCurrent || !targetStore?.latitude || !targetStore?.longitude) {
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
    }

    const cachedStore = [...restaurants, ...registeredShops].find(
      (store) => String(store.id) === String(targetStoreId)
    );

    if (cachedStore) {
      applyFocus(cachedStore);
      return () => {
        isCurrent = false;
      };
    }

    loadStoreById(targetStoreId)
      .then((store) => applyFocus(store))
      .catch((error) => log.fail('focusStoreRequest:load-failed', error));

    return () => {
      isCurrent = false;
    };
  }, [focusStoreRequest, restaurants, registeredShops]);

  const mapItems = useMemo(() => {
    if (selectedCategory === 'none') {
      return [];
    }

    if (selectedCategory === 'shop') {
      return registeredShops;
    }

    if (selectedCategory === 'all') {
      const registeredIds = new Set(registeredShops.map((shop) => String(shop.id)));
      const demoItems = restaurants.filter((item) => !registeredIds.has(String(item.id)));
      return [...registeredShops, ...demoItems];
    }

    return restaurants;
  }, [restaurants, registeredShops, selectedCategory]);

  const visibleRestaurants = useMemo(() => {
    if (!hasValidLocation(currentLocation) || mapItems.length === 0) {
      return mapItems;
    }
    if (!selectedRadius) {
      return mapItems;
    }
    return mapItems.filter((r) => {
      if (!r.latitude || !r.longitude) return false;
      const dist = calculateDistanceMeters(currentLocation, {
        latitude: r.latitude,
        longitude: r.longitude,
      });
      return dist !== null && dist <= selectedRadius;
    });
  }, [mapItems, currentLocation, selectedRadius]);

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

  function handleSearchSelect(result) {
    if (!result?.latitude || !result?.longitude) {
      return;
    }

    setMenuVisible(false);
    setRecenterRequest({
      location: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
      at: Date.now(),
    });
    log.info('search:select', { label: result.label });
  }

  const radiusOptions = [
    { key: null, label: '🚫 Tắt bán kính' },
    { key: 100, label: '📍 100 m' },
    { key: 500, label: '📍 500 m' },
    { key: 1000, label: '📍 1 km' },
    { key: 2000, label: '📍 2 km' },
  ];

  const restaurantCategories = [
    { key: 'none', label: '🚫 Ẩn tất cả' },
    { key: 'all', label: '🌐 Tất cả' },
    { key: 'shop', label: '🏪 Gian hàng đăng ký' },
    { key: 'cafe', label: '☕ Cà phê' },
    { key: 'food', label: '🍜 Quán ăn' },
    { key: 'milktea', label: '🧋 Trà sữa' },
    { key: 'snack', label: '🍿 Ăn vặt' },
  ];

  const selectedRadiusLabel =
    radiusOptions.find((opt) => opt.key === selectedRadius)?.label || 'Tắt';

  const showNearbyPanel =
    selectedCategory !== 'none' && visibleRestaurants.length > 0 && !storeNav;

  if (storeNav?.screen === 'store') {
    return (
      <StoreDetailScreen
        storeId={storeNav.storeId}
        onBack={closeStoreNav}
        onProductPress={openProduct}
        onOpenChat={onOpenChat}
      />
    );
  }

  if (storeNav?.screen === 'product') {
    return (
      <ProductDetailScreen
        productId={storeNav.productId}
        onBack={goBackStoreNav}
        onStorePress={openStore}
        onOpenChat={onOpenChat}
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

        <View style={styles.searchOverlay} pointerEvents="box-none">
          <AddressSearchBar
            placeholder="Tìm đường Phúc Diễn, địa điểm..."
            onSelectResult={handleSearchSelect}
          />
        </View>

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
              <Text style={styles.menuSummary}>
                Danh mục: {restaurantCategories.find((c) => c.key === selectedCategory)?.label || 'Tất cả'}
                {' · '}
                Bán kính: {selectedRadiusLabel}
              </Text>

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

              <Text style={styles.menuSubHeader}>Loại hiển thị</Text>
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
          {showNearbyPanel
            ? `${visibleRestaurants.length} điểm trong ${selectedRadiusLabel} — chạm để xem`
            : selectedCategory === 'none'
              ? 'Chọn loại hiển thị để xem danh sách'
              : !hasValidLocation(currentLocation)
                ? 'Đang lấy vị trí để quét gian hàng gần bạn...'
                : `Không có điểm nào trong bán kính ${selectedRadiusLabel}`}
        </Text>
        {showNearbyPanel ? (
          <FlatList
            data={visibleRestaurants}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.nearbyList}
            columnWrapperStyle={styles.nearbyRow}
            renderItem={({ item: restaurant }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.nearbyCard,
                  pressed && styles.nearbyCardPressed,
                ]}
                onPress={() => openStore(restaurant.id)}
              >
                {restaurant.image_url ? (
                  <Image
                    source={{ uri: restaurant.image_url }}
                    style={styles.nearbyThumb}
                  />
                ) : (
                  <View style={styles.nearbyThumbPlaceholder}>
                    <Text style={styles.nearbyThumbEmoji}>
                      {TYPE_EMOJI[restaurant.type] || '🏪'}
                    </Text>
                  </View>
                )}
                <Text style={styles.nearbyName} numberOfLines={2}>
                  {restaurant.name}
                </Text>
              </Pressable>
            )}
          />
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
    position: 'relative',
  },
  searchOverlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  nearbyPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  nearbyRow: {
    gap: 8,
    marginBottom: 8,
  },
  nearbyCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    minHeight: 56,
  },
  nearbyCardPressed: {
    opacity: 0.85,
    backgroundColor: '#f0fdfa',
  },
  nearbyThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  nearbyThumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyThumbEmoji: {
    fontSize: 20,
  },
  nearbyName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 16,
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
    marginBottom: 4,
  },
  menuSummary: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '600',
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
