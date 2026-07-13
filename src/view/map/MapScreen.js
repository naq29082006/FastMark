import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';

import { getShopCategoriesOnBackend } from '../../api/productApi';
import { fetchRouteDistancesFromOrigin } from '../../api/routingApi';
import {
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { getSellerRegisterButtonLabel } from '../seller/sellerRegistrationFlow';

import LeafletMap from '../shared/components/LeafletMap';
import BuyerQuickMenu from '../shared/components/BuyerQuickMenu';
import DirectionsScreen from './DirectionsScreen';
import AddressSearchBar from './AddressSearchBar';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import DealOfferModal from '../buyer/DealOfferModal';
import ReservationModal from '../buyer/ReservationModal';
import { calculateDistanceMeters, formatDistance, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { loadNearbyRegisteredShops, reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { loadStoreById } from '../../viewmodel/store/storeViewModel';
import { mapLogger as log } from '../../core/utils/logger';

const TYPE_EMOJI = {
  cafe: '☕',
  food: '🍜',
  milktea: '🧋',
  snack: '🍿',
  shop: '🏪',
};

const TYPE_LABEL = {
  cafe: 'Cà phê',
  food: 'Quán ăn',
  milktea: 'Trà sữa',
  snack: 'Ăn vặt',
  shop: 'Gian hàng',
};

const PANEL_HANDLE_HEIGHT = 20;
const MAP_FLEX_HALF = 3;
const SHOP_FLEX_HALF = 3;
const MAP_FLEX_SHOP_COLLAPSED = 5;
const SHOP_FLEX_COLLAPSED = 1;

function formatScanCoords(location) {
  if (!hasValidLocation(location)) {
    return 'Chưa có tọa độ';
  }

  return `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`;
}

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function MapCategoryOption({ category, selected, onPress }) {
  const iconValue = String(category.icon || '').trim();
  const showRemoteImage = isRemoteIcon(iconValue);

  return (
    <Pressable
      style={[styles.categoryItem, selected && styles.categoryItemActive]}
      onPress={onPress}
    >
      <View style={styles.categoryOptionRow}>
        {showRemoteImage ? (
          <Image source={{ uri: iconValue }} style={styles.categoryOptionImage} />
        ) : (
          <View style={styles.categoryOptionImagePlaceholder}>
            <Text style={styles.categoryOptionEmoji}>{iconValue || '🏪'}</Text>
          </View>
        )}
        <Text
          style={[styles.categoryOptionName, selected && styles.categoryTextActive]}
          numberOfLines={1}
        >
          {category.name}
        </Text>
      </View>
      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
    </Pressable>
  );
}

export default function MapScreen({
  children,
  focusStoreRequest,
  onOpenChat,
  onClearFocus,
  onPickupCompleted,
  onNavigationStateChange,
  onEditAccount,
  onSellerAction,
  onLogout,
  isScreenActive = true,
}) {
  const watcherRef = useRef(null);
  const mountedRef = useRef(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [scanLocation, setScanLocation] = useState(null);
  const [scanSystemAddress, setScanSystemAddress] = useState('');
  const [isResolvingScanAddress, setIsResolvingScanAddress] = useState(false);
  const [usingCustomScan, setUsingCustomScan] = useState(false);
  const [recenterRequest, setRecenterRequest] = useState(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(2000);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [registeredShops, setRegisteredShops] = useState([]);
  const [storeNav, setStoreNav] = useState(null);
  const [dealModal, setDealModal] = useState(null);
  const [reserveModal, setReserveModal] = useState(null);
  const [directionsSession, setDirectionsSession] = useState(null);
  const [routeDistanceById, setRouteDistanceById] = useState({});
  const [isShopPanelExpanded, setIsShopPanelExpanded] = useState(false);
  const [shopCategories, setShopCategories] = useState([]);

  const toggleFilterMenu = useCallback(() => {
    setMenuVisible((current) => {
      if (!current) {
        setIsShopPanelExpanded(false);
      }
      return !current;
    });
  }, []);

  const closeFilterMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const role = useSelector(selectUserRole);
  const sellerVerification = useSelector(selectSellerVerification);
  const sellerButtonLabel = getSellerRegisterButtonLabel({ role, verification: sellerVerification });
  const lastAcceptedRef = useRef(null);
  const reverseScanRequestRef = useRef(0);
  const scanFetchTimerRef = useRef(null);
  const lastScanFetchRef = useRef(null);

  const resolveScanAddress = useCallback(async (location) => {
    if (!hasValidLocation(location)) {
      setScanSystemAddress('');
      return;
    }

    const requestId = reverseScanRequestRef.current + 1;
    reverseScanRequestRef.current = requestId;
    setIsResolvingScanAddress(true);

    try {
      const displayName = await reverseGeocodeLocation(
        location.latitude,
        location.longitude
      );

      if (reverseScanRequestRef.current === requestId) {
        setScanSystemAddress(displayName || '');
      }
    } catch {
      if (reverseScanRequestRef.current === requestId) {
        setScanSystemAddress('');
      }
    } finally {
      if (reverseScanRequestRef.current === requestId) {
        setIsResolvingScanAddress(false);
      }
    }
  }, []);

  const applyScanLocation = useCallback((location, { custom = false } = {}) => {
    if (!hasValidLocation(location)) {
      return;
    }

    setUsingCustomScan(custom);
    setScanLocation(location);
    resolveScanAddress(location);
  }, [resolveScanAddress]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(storeNav || directionsSession));
  }, [onNavigationStateChange, storeNav, directionsSession]);

  const openStore = useCallback((storeId) => {
    setMenuVisible(false);
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
    if (!hasValidLocation(currentLocation) || usingCustomScan) {
      return;
    }

    setScanLocation(currentLocation);
    resolveScanAddress(currentLocation);
  }, [currentLocation, usingCustomScan, resolveScanAddress]);

  useEffect(() => {
    if (selectedCategory === 'none') {
      setRegisteredShops([]);
      return undefined;
    }

    if (!hasValidLocation(scanLocation)) {
      return undefined;
    }

    let isCurrent = true;
    const effectiveRadius = selectedRadius ?? 20000;

    if (scanFetchTimerRef.current) {
      clearTimeout(scanFetchTimerRef.current);
    }

    scanFetchTimerRef.current = setTimeout(() => {
      const categoryKey =
        selectedCategory === 'all' || selectedCategory === 'none' ? 'all' : String(selectedCategory);
      const locKey = `${Number(scanLocation.latitude).toFixed(4)},${Number(scanLocation.longitude).toFixed(4)},${effectiveRadius},${categoryKey}`;
      if (lastScanFetchRef.current === locKey) {
        return;
      }
      lastScanFetchRef.current = locKey;

      log.info('fetchRegisteredShops:map', {
        lat: scanLocation.latitude,
        lng: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        categoryId: categoryKey,
        customScan: usingCustomScan,
      });

      loadNearbyRegisteredShops({
        latitude: scanLocation.latitude,
        longitude: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        shopCategoryId: selectedCategory === 'all' || selectedCategory === 'none' ? '' : selectedCategory,
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
    }, 400);

    return () => {
      isCurrent = false;
      if (scanFetchTimerRef.current) {
        clearTimeout(scanFetchTimerRef.current);
      }
    };
  }, [scanLocation, selectedRadius, selectedCategory, usingCustomScan]);

  useEffect(() => {
    let active = true;

    getShopCategoriesOnBackend()
      .then((items) => {
        if (active) {
          setShopCategories(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (active) {
          setShopCategories([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const shopCategoryLookup = useMemo(() => {
    const byId = new Map();
    shopCategories.forEach((category) => {
      if (!category?.id) {
        return;
      }
      byId.set(String(category.id), {
        icon: String(category.icon || '').trim(),
        name: category.name || category.categoryName || '',
      });
    });
    return byId;
  }, [shopCategories]);

  const enrichShopWithCategory = useCallback(
    (shop) => {
      const categoryId = String(shop.category_id || shop.categoryId || '');
      const categoryMeta = shopCategoryLookup.get(categoryId);

      return {
        ...shop,
        category_id: categoryId,
        categoryId,
        category_name: shop.category_name || categoryMeta?.name || '',
        category_icon: String(shop.category_icon || shop.categoryIcon || categoryMeta?.icon || '').trim(),
      };
    },
    [shopCategoryLookup]
  );

  const startDirectionsToStore = useCallback(
    ({ shopId, storeName, latitude, longitude, categoryIcon = '', categoryId = '', storeAvatar = '' }) => {
      const nextLatitude = Number(latitude);
      const nextLongitude = Number(longitude);

      if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
        Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
        return;
      }

      const { category_icon: resolvedIcon } = enrichShopWithCategory({
        category_icon: categoryIcon,
        categoryIcon,
        category_id: categoryId,
        categoryId,
      });

      setStoreNav(null);
      setMenuVisible(false);
      setDirectionsSession({
        storeId: String(shopId),
        reservationId: null,
        storeName: storeName || 'Gian hàng',
        storeAvatar: String(storeAvatar || '').trim(),
        categoryIcon: resolvedIcon,
        destination: {
          latitude: nextLatitude,
          longitude: nextLongitude,
          category_icon: resolvedIcon,
          type: 'shop',
        },
      });
      onClearFocus?.();
    },
    [enrichShopWithCategory, onClearFocus]
  );

  useEffect(() => {
    const targetStoreId = focusStoreRequest?.storeId;
    const targetLocation = focusStoreRequest?.location;
    const showDirections = Boolean(focusStoreRequest?.showDirections);

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
        if (showDirections) {
          Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
        }
        return;
      }

      setMenuVisible(false);
      setSelectedCategory('all');
      setSelectedRadius(null);
      setStoreNav(null);

      if (showDirections) {
        const enrichedStore = enrichShopWithCategory(targetStore);
        setDirectionsSession({
          storeId: String(targetStoreId),
          reservationId: focusStoreRequest?.reservationId || null,
          storeName: focusStoreRequest?.storeName || enrichedStore.name || 'Gian hàng',
          storeAvatar: String(enrichedStore.image_url || enrichedStore.cover_image_url || '').trim(),
          categoryIcon: enrichedStore.category_icon || '',
          destination: {
            latitude: targetStore.latitude,
            longitude: targetStore.longitude,
            category_icon: enrichedStore.category_icon || '',
            type: 'shop',
          },
        });
      }

      setRecenterRequest({
        location: {
          latitude: targetStore.latitude,
          longitude: targetStore.longitude,
        },
        at: focusStoreRequest.at || Date.now(),
      });
      log.info('focusStoreRequest', { storeId: targetStoreId, showDirections });
    }

    const cachedStore = registeredShops.find(
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
  }, [focusStoreRequest, registeredShops, enrichShopWithCategory]);

  const mapItems = useMemo(() => {
    if (selectedCategory === 'none') {
      return [];
    }

    const enrichedShops = registeredShops.map(enrichShopWithCategory);

    if (selectedCategory === 'all') {
      return enrichedShops;
    }

    return enrichedShops.filter(
      (item) => String(item.category_id || item.categoryId || '') === String(selectedCategory)
    );
  }, [registeredShops, selectedCategory, enrichShopWithCategory]);

  const visibleRestaurants = useMemo(() => {
    const distanceOrigin = scanLocation || currentLocation;

    if (!hasValidLocation(distanceOrigin) || mapItems.length === 0) {
      return mapItems;
    }

    const enriched = mapItems.map((item) => {
      const distanceMeters = Number.isFinite(Number(item.distance_meters))
        ? Number(item.distance_meters)
        : calculateDistanceMeters(distanceOrigin, item);

      return {
        ...item,
        distance_meters: distanceMeters,
      };
    });

    const filtered = selectedRadius
      ? enriched.filter(
          (item) =>
            item.distance_meters !== null &&
            Number.isFinite(item.distance_meters) &&
            item.distance_meters <= selectedRadius
        )
      : enriched;

    return [...filtered].sort(
      (left, right) => (left.distance_meters ?? Number.MAX_SAFE_INTEGER) - (right.distance_meters ?? Number.MAX_SAFE_INTEGER)
    );
  }, [mapItems, scanLocation, currentLocation, selectedRadius]);

  const distanceOrigin = scanLocation || currentLocation;
  const visibleRestaurantIds = useMemo(
    () => visibleRestaurants.map((item) => String(item.id)).join('|'),
    [visibleRestaurants]
  );

  useEffect(() => {
    if (!hasValidLocation(distanceOrigin) || visibleRestaurants.length === 0) {
      setRouteDistanceById({});
      return undefined;
    }

    let active = true;
    const timer = setTimeout(() => {
      fetchRouteDistancesFromOrigin(distanceOrigin, visibleRestaurants)
        .then((distances) => {
          if (active) {
            setRouteDistanceById(distances);
          }
        })
        .catch(() => {
          if (active) {
            setRouteDistanceById({});
          }
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    distanceOrigin?.latitude,
    distanceOrigin?.longitude,
    visibleRestaurantIds,
  ]);

  const displayRestaurants = useMemo(() => {
    const enriched = visibleRestaurants.map((item) => {
      const routeDistance = routeDistanceById[String(item.id)];
      return {
        ...item,
        distance_meters: Number.isFinite(routeDistance) ? routeDistance : item.distance_meters,
      };
    });

    return [...enriched].sort(
      (left, right) =>
        (left.distance_meters ?? Number.MAX_SAFE_INTEGER) -
        (right.distance_meters ?? Number.MAX_SAFE_INTEGER)
    );
  }, [visibleRestaurants, routeDistanceById]);

  const originLocation = distanceOrigin;

  const radiusCircleProp =
    selectedRadius && hasValidLocation(scanLocation || currentLocation)
      ? { center: scanLocation || currentLocation, radius: selectedRadius }
      : null;

  function requestRecenter(location) {
    lastAcceptedRef.current = location;
    setCurrentLocation(location);
    setRecenterRequest({ location, at: Date.now() });
  }

  function handleRecenterPress() {
    log.info('recenter:pressed');
    setUsingCustomScan(false);

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

  useEffect(() => {
    if (!isScreenActive) {
      setMenuVisible(false);
    }
  }, [isScreenActive]);

  useEffect(() => {
    if (storeNav) {
      setMenuVisible(false);
    }
  }, [storeNav]);

  const handleMapEvent = useCallback((payload) => {
    log.debug('mapEvent', payload?.type, payload);
    if (payload?.type === 'mapTap') {
      closeFilterMenu();
      return;
    }
    if (payload?.type === 'mapDoubleTap' && hasValidLocation(payload.location)) {
      log.info('scan:double-tap', payload.location);
      applyScanLocation(payload.location, { custom: true });
      return;
    }
    if (payload?.type === 'restaurantTap' && payload.restaurant?.id != null) {
      openStore(payload.restaurant.id);
      return;
    }
  }, [openStore, applyScanLocation, closeFilterMenu]);

  function handleStopDirections() {
    setDirectionsSession(null);
    onClearFocus?.();
  }

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

  const restaurantCategories = useMemo(() => {
    const dynamicCategories = shopCategories.map((category) => ({
      key: String(category.id),
      name: category.name || category.categoryName || 'Danh mục',
      icon: category.icon || '',
      description: category.description || '',
    }));

    return [
      { key: 'none', name: 'Ẩn tất cả', icon: '🚫' },
      { key: 'all', name: 'Tất cả gian hàng', icon: '🌐' },
      ...dynamicCategories,
    ];
  }, [shopCategories]);

  const selectedCategoryLabel =
    restaurantCategories.find((category) => category.key === selectedCategory)?.name || 'Tất cả';

  const selectedRadiusLabel =
    radiusOptions.find((opt) => opt.key === selectedRadius)?.label || 'Tắt';

  const showNearbyPanel =
    selectedCategory !== 'none' && displayRestaurants.length > 0 && !storeNav;

  const scanLocationLabel = useMemo(() => {
    const coords = formatScanCoords(scanLocation || currentLocation);
    const address = isResolvingScanAddress
      ? 'Đang lấy địa chỉ hệ thống...'
      : scanSystemAddress || 'Chưa có địa chỉ hệ thống';

    return `${coords} · ${address}`;
  }, [scanLocation, currentLocation, isResolvingScanAddress, scanSystemAddress]);

  const mapFlex = isShopPanelExpanded ? MAP_FLEX_HALF : MAP_FLEX_SHOP_COLLAPSED;
  const shopFlex = isShopPanelExpanded ? SHOP_FLEX_HALF : SHOP_FLEX_COLLAPSED;


  let screenContent;

  if (directionsSession) {
    screenContent = (
      <DirectionsScreen
        session={directionsSession}
        onStop={handleStopDirections}
      />
    );
  } else if (storeNav?.screen === 'store') {
    screenContent = (
      <StoreDetailScreen
        storeId={storeNav.storeId}
        originLocation={originLocation}
        onBack={closeStoreNav}
        onProductPress={openProduct}
        onOpenChat={onOpenChat}
        onNavigateDirections={startDirectionsToStore}
      />
    );
  } else if (storeNav?.screen === 'product') {
    screenContent = (
      <ProductDetailScreen
        productId={storeNav.productId}
        onBack={goBackStoreNav}
        onStorePress={openStore}
        onOpenChat={onOpenChat}
        onDeal={(product, store, selectedVariant) =>
          setDealModal({
            product: { ...product, id: product.id || storeNav.productId },
            store,
            preselectedVariantId: selectedVariant?.id || null,
          })
        }
        onReserve={(product, store, selectedVariant) =>
          setReserveModal({
            product: { ...product, id: product.id || storeNav.productId },
            store,
            preselectedVariantId: selectedVariant?.id || null,
          })
        }
      />
    );
  } else {
    screenContent = (
      <View style={styles.container}>
      <View
        style={[styles.mapArea, { flex: mapFlex }]}
        pointerEvents="box-none"
      >
        <LeafletMap
          currentLocation={currentLocation}
          radiusCircle={radiusCircleProp}
          recenterRequest={recenterRequest}
          scanLocation={
            usingCustomScan && hasValidLocation(scanLocation) ? scanLocation : null
          }
          restaurants={visibleRestaurants}
          onEvent={handleMapEvent}
        />

        <View style={styles.searchOverlay} pointerEvents="box-none">
          <View style={styles.searchRow}>
            <View style={styles.searchBarWrap}>
              <AddressSearchBar
                placeholder="Tìm đường Phúc Diễn, địa điểm..."
                onSelectResult={handleSearchSelect}
              />
            </View>
            <BuyerQuickMenu
              sellerButtonLabel={sellerButtonLabel}
              onEditAccount={onEditAccount}
              onSellerAction={onSellerAction}
              onLogout={onLogout}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bộ lọc bản đồ"
          pointerEvents="auto"
          style={({ pressed }) => [
            styles.settingsFab,
            pressed && styles.mapFabPressed,
            menuVisible && styles.settingsFabActive,
          ]}
          onPress={toggleFilterMenu}
        >
          <Text style={[styles.settingsFabIcon, menuVisible && styles.settingsFabIconActive]}>
            ⚙️
          </Text>
        </Pressable>

        {menuVisible ? (
          <View style={styles.inlineFilterPanel} pointerEvents="auto">
            <View style={styles.filterPanelHeader}>
              <Text style={styles.menuHeader}>Tọa độ quét & danh mục</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng bộ lọc"
                onPress={closeFilterMenu}
                style={({ pressed }) => [styles.filterCloseButton, pressed && styles.mapFabPressed]}
              >
                <Text style={styles.filterCloseButtonText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.menuSummary}>{scanLocationLabel}</Text>
              <Text style={styles.menuSummary}>
                Danh mục: {selectedCategoryLabel}
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
                    {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </Pressable>
                );
              })}

              <View style={styles.divider} />

              <Text style={styles.menuSubHeader}>Danh mục gian hàng</Text>
              {restaurantCategories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <MapCategoryOption
                    key={cat.key}
                    category={cat}
                    selected={isSelected}
                    onPress={() => setSelectedCategory(cat.key)}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.locationBar} pointerEvents="box-none">
          <Text style={styles.locationBarText} numberOfLines={2}>
            {scanLocationLabel}
          </Text>
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
        </View>

        {children}
      </View>

      <>
          <View style={styles.panelResizeHandleWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isShopPanelExpanded ? 'Thu gọn danh sách gian hàng' : 'Mở rộng danh sách gian hàng'}
              onPress={() => setIsShopPanelExpanded((current) => !current)}
              style={({ pressed }) => [
                styles.panelResizeButton,
                pressed && styles.panelResizeButtonPressed,
              ]}
            >
              <Ionicons
                name={isShopPanelExpanded ? 'chevron-down' : 'chevron-up'}
                size={18}
                color="#64748b"
              />
            </Pressable>
          </View>
          <View style={[styles.nearbyPanel, { flex: shopFlex }]} onTouchStart={closeFilterMenu}>
          <Text style={styles.nearbyTitle}>
            {showNearbyPanel
              ? `${displayRestaurants.length} điểm trong ${selectedRadiusLabel} — chạm để xem`
              : selectedCategory === 'none'
                ? 'Chọn loại hiển thị để xem danh sách'
                : !hasValidLocation(scanLocation || currentLocation)
                  ? 'Đang lấy vị trí để quét gian hàng gần bạn...'
                  : `Không có điểm nào trong bán kính ${selectedRadiusLabel}`}
          </Text>
          {showNearbyPanel ? (
            <FlatList
              data={displayRestaurants}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.nearbyList}
              renderItem={({ item: restaurant }) => {
                const username = restaurant.shop_username
                  ? `@${String(restaurant.shop_username).replace(/^@/, '')}`
                  : '';
                const categoryLabel =
                  restaurant.category_name ||
                  TYPE_LABEL[restaurant.type] ||
                  'Gian hàng';
                const systemAddress =
                  restaurant.system_address || restaurant.address || 'Chưa có địa chỉ hệ thống';
                const productCount = Number(restaurant.total_products ?? restaurant.product_count ?? 0);
                const reviewCount = Number(restaurant.review_count ?? 0);
                const distanceLabel = formatDistance(restaurant.distance_meters);

                return (
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
                    <View style={styles.nearbyCardBody}>
                      <View style={styles.nearbyCardTitleRow}>
                        <Text style={styles.nearbyName} numberOfLines={1}>
                          {restaurant.name}
                        </Text>
                        <Text style={styles.nearbyDistance}>{distanceLabel}</Text>
                      </View>
                      <Text style={styles.nearbyMetaLine} numberOfLines={1}>
                        {[username, categoryLabel].filter(Boolean).join(' · ') || 'Chưa có username'}
                      </Text>
                      <Text style={styles.nearbyAddress} numberOfLines={2}>
                        {systemAddress}
                      </Text>
                      <Text style={styles.nearbyStats} numberOfLines={1}>
                        {productCount} sản phẩm · {reviewCount} đánh giá
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          ) : null}
          </View>
        </>
      </View>
    );
  }

  return (
    <>
      {screenContent}
      <DealOfferModal
        visible={Boolean(dealModal)}
        product={dealModal?.product}
        store={dealModal?.store}
        preselectedVariantId={dealModal?.preselectedVariantId}
        onClose={() => setDealModal(null)}
        onSuccess={() => setDealModal(null)}
      />
      <ReservationModal
        visible={Boolean(reserveModal)}
        product={reserveModal?.product}
        store={reserveModal?.store}
        preselectedVariantId={reserveModal?.preselectedVariantId}
        onClose={() => setReserveModal(null)}
        onSuccess={() => setReserveModal(null)}
      />
    </>
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
  searchOverlay: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchBarWrap: {
    flex: 1,
    minWidth: 0,
  },
  nearbyPanel: {
    minHeight: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  panelResizeHandleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: PANEL_HANDLE_HEIGHT,
    marginTop: -10,
    zIndex: 25,
  },
  panelResizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  panelResizeButtonPressed: {
    opacity: 0.82,
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
    paddingBottom: 8,
    gap: 8,
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  nearbyCardPressed: {
    opacity: 0.85,
    backgroundColor: '#f0fdfa',
  },
  nearbyThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  nearbyThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyThumbEmoji: {
    fontSize: 24,
  },
  nearbyCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nearbyCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearbyName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 18,
  },
  nearbyDistance: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  nearbyMetaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f766e',
    lineHeight: 16,
  },
  nearbyAddress: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  nearbyStats: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
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
    position: 'absolute',
    top: '42%',
    right: 14,
    marginTop: -22,
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
    zIndex: 30,
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
    flexShrink: 0,
  },
  recenterButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  locationBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  locationBarText: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#334155',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  inlineFilterPanel: {
    position: 'absolute',
    top: 56,
    left: 18,
    right: 64,
    bottom: 74,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 28,
  },
  filterPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  filterCloseButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  categoryOptionRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  categoryOptionImage: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  categoryOptionImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryOptionEmoji: {
    fontSize: 18,
  },
  categoryOptionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
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
  directionsCard: {
    flex: 1,
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
    shadowRadius: 12,
    elevation: 8,
  },
  directionsCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  directionsCardIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  directionsCardTitles: {
    flex: 1,
  },
  directionsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  directionsMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  directionsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  directionsSecondaryBtnFull: {
    flex: 1,
  },
  directionsSecondaryText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 13,
  },
  directionsPrimaryBtn: {
    flex: 1.2,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  directionsPrimaryBtnDisabled: {
    opacity: 0.7,
  },
  directionsPrimaryText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
});
