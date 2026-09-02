import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useDispatch } from 'react-redux';

import { getShopCategoriesOnBackend } from '../../api/productApi';
import { confirmLogout } from '../../core/utils/appAlert';
import { logoutUser } from '../../viewmodel/auth/authSlice';
import BuyerQuickMenu from '../shared/components/BuyerQuickMenu';

import LeafletMap from '../shared/components/LeafletMap';
import DirectionsScreen from './DirectionsScreen';
import AddressSearchBar from './AddressSearchBar';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import ReservationScreen from '../buyer/ReservationScreen';
import {
  calculateDistanceMeters,
  formatDistance,
  formatNearbyDistanceLabel,
  getDistanceFromCurrentLocation,
  hasValidLocation,
  normalizeExpoLocation,
} from '../../core/utils/geo';
import useLocationWatcher from '../../hooks/useLocationWatcher';
import { loadAllNearbyShopsForMap, loadNearbyRegisteredShops, reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { loadProductById, loadStoreById } from '../../viewmodel/store/storeViewModel';
import { mapLogger as log } from '../../core/utils/logger';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import { toReservationFormResume } from '../../viewmodel/buyer/reservationResumeSession';
import AvatarBadge from '../shared/components/AvatarBadge';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import { resolveShopAvatarUri } from '../../core/utils/avatarInitial';
import { buildMapMarkerPayload } from '../../core/utils/mapMarkerPayload';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';

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
const DEFAULT_SCAN_RADIUS_METERS = 1000;

function formatScanCoords(location) {
  if (!hasValidLocation(location)) {
    return 'Chưa có tọa độ';
  }

  return `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`;
}

function MapCategoryOption({ category, selected, onPress }) {
  return (
    <Pressable
      style={[styles.categoryItem, selected && styles.categoryItemActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.categoryOptionName, selected && styles.categoryTextActive]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
    </Pressable>
  );
}

export default function MapScreen({
  children,
  focusStoreRequest,
  onClearFocus,
  onDirectionsStopped,
  onPickupCompleted,
  onOpenBuyerOrders,
  onOpenWalletTopUp,
  onEditAccount,
  onOpenWallet,
  onOpenFavoriteProducts,
  onOpenReport,
  resumeReserveRequest = null,
  onResumeReserveHandled,
  keepNestedAcrossTabs = false,
  onNavigationStateChange,
  isScreenActive = true,
}) {
  const dispatch = useDispatch();
  const [directionsSession, setDirectionsSession] = useState(null);
  const handleLocationError = useCallback((error) => {
    log.fail('location:tracking-failed', error);
  }, []);
  const currentLocation = useLocationWatcher({
    mode: 'discovery',
    enabled: isScreenActive && !directionsSession,
    onError: handleLocationError,
  });
  const [scanLocation, setScanLocation] = useState(null);
  const [scanSystemAddress, setScanSystemAddress] = useState('');
  const [isResolvingScanAddress, setIsResolvingScanAddress] = useState(false);
  const [usingCustomScan, setUsingCustomScan] = useState(false);
  const [recenterRequest, setRecenterRequest] = useState(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(DEFAULT_SCAN_RADIUS_METERS);
  // Giá trị đang kéo trên slider (commit vào selectedRadius khi thả tay).
  const [radiusDraft, setRadiusDraft] = useState(DEFAULT_SCAN_RADIUS_METERS);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [registeredShops, setRegisteredShops] = useState([]);
  const [mapMarkerShops, setMapMarkerShops] = useState([]);
  const [isScanningShops, setIsScanningShops] = useState(false);
  const [initialShopScanComplete, setInitialShopScanComplete] = useState(false);
  const [isLoadingMoreShops, setIsLoadingMoreShops] = useState(false);
  const [shopsHasMore, setShopsHasMore] = useState(false);
  const [shopsTotal, setShopsTotal] = useState(0);
  const [storeNav, setStoreNav] = useState(null);
  const [activeReservation, setActiveReservation] = useState(null);
  const [isShopPanelExpanded, setIsShopPanelExpanded] = useState(false);
  const [shopCategories, setShopCategories] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearchFocusChange = useCallback((focused) => {
    setIsSearchFocused(Boolean(focused));
  }, []);

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

  const reverseScanRequestRef = useRef(0);
  const scanFetchTimerRef = useRef(null);
  const lastScanFetchRef = useRef(null);
  const shopsPageRef = useRef(1);
  /** true = user đổi bán kính/danh mục → hiện "Đang quét" và xóa list tạm */
  const explicitScanRefreshRef = useRef(false);
  /** true = cần fetch lại dù cùng locKey (vd. quay lại tab) — cập nhật ngầm */
  const silentRescanRequestedRef = useRef(false);

  const beginScanRefresh = useCallback(() => {
    explicitScanRefreshRef.current = true;
    setIsScanningShops(true);
    setRegisteredShops([]);
    setMapMarkerShops([]);
    setShopsHasMore(false);
    setShopsTotal(0);
  }, []);

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
    onNavigationStateChange?.(
      Boolean(
        isScreenActive &&
          (storeNav || directionsSession || activeReservation)
      )
    );
  }, [activeReservation, directionsSession, isScreenActive, onNavigationStateChange, storeNav]);

  useEffect(() => {
    if (isScreenActive || keepNestedAcrossTabs) {
      return;
    }
    setStoreNav(null);
    setDirectionsSession(null);
    setActiveReservation(null);
    // Rời bottom tab Bản đồ → reset filter danh mục về mặc định.
    setSelectedCategory('all');
  }, [isScreenActive, keepNestedAcrossTabs]);

  useEffect(() => {
    if (!resumeReserveRequest?.productId || !resumeReserveRequest?.at) {
      return;
    }

    if (resumeReserveRequest.fromTopUp) {
      let cancelled = false;
      const productId = String(resumeReserveRequest.productId);
      const formResume = toReservationFormResume(resumeReserveRequest);

      setActiveReservation({
        product: null,
        store: null,
        preselectedVariantId: resumeReserveRequest.variantId || null,
        initialQuantity: Math.max(1, Number(resumeReserveRequest.quantity) || 1),
        initialFormResume: formResume,
      });

      (async () => {
        try {
          const loadedProduct = await loadProductById(productId);
          let loadedStore = null;
          const storeId = resumeReserveRequest.storeId || loadedProduct?.store_id;
          if (storeId) {
            loadedStore = await loadStoreById(String(storeId));
          }
          if (cancelled) {
            return;
          }
          if (!loadedProduct) {
            setActiveReservation((prev) =>
              prev
                ? {
                    ...prev,
                    product: null,
                    store: null,
                    loadError: 'Không tải được thông tin sản phẩm.',
                  }
                : prev
            );
            onResumeReserveHandled?.();
            return;
          }
          setActiveReservation({
            product: { ...loadedProduct, id: loadedProduct?.id || productId },
            store: loadedStore,
            preselectedVariantId: resumeReserveRequest.variantId || null,
            initialQuantity: Math.max(1, Number(resumeReserveRequest.quantity) || 1),
            initialFormResume: formResume,
          });
          onResumeReserveHandled?.();
        } catch (error) {
          log.fail('MapScreen:resume-topup-failed', error);
          if (!cancelled) {
            setStoreNav({
              screen: 'product',
              productId,
              storeId: resumeReserveRequest.storeId
                ? String(resumeReserveRequest.storeId)
                : undefined,
            });
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    setStoreNav({
      screen: 'product',
      productId: String(resumeReserveRequest.productId),
      storeId: resumeReserveRequest.storeId
        ? String(resumeReserveRequest.storeId)
        : undefined,
    });
  }, [
    resumeReserveRequest?.at,
    resumeReserveRequest?.productId,
    resumeReserveRequest?.storeId,
    resumeReserveRequest?.fromTopUp,
    onResumeReserveHandled,
  ]);

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

  useEffect(() => {
    if (!hasValidLocation(currentLocation) || usingCustomScan) {
      return;
    }

    setScanLocation((prev) => {
      if (hasValidLocation(prev)) {
        const movedMeters = calculateDistanceMeters(prev, currentLocation);
        if (movedMeters !== null && movedMeters < 50) {
          return prev;
        }
      }
      resolveScanAddress(currentLocation);
      return currentLocation;
    });
  }, [currentLocation, usingCustomScan, resolveScanAddress]);

  useEffect(() => {
    if (selectedCategory === 'none') {
      setRegisteredShops([]);
      setMapMarkerShops([]);
      setShopsHasMore(false);
      setShopsTotal(0);
      setIsScanningShops(false);
      setInitialShopScanComplete(true);
      return undefined;
    }

    if (!hasValidLocation(scanLocation)) {
      return undefined;
    }

    let isCurrent = true;
    // null = tắt lọc hiển thị → quét rộng (unlimited phía API).
    const effectiveRadius = selectedRadius == null ? 0 : selectedRadius;
    const categoryKey =
      selectedCategory === 'all' || selectedCategory === 'none' ? 'all' : String(selectedCategory);
    const locKey = `${Number(scanLocation.latitude).toFixed(4)},${Number(scanLocation.longitude).toFixed(4)},${effectiveRadius},${categoryKey}`;

    const locKeyChanged = lastScanFetchRef.current !== locKey;
    if (locKeyChanged && explicitScanRefreshRef.current) {
      setIsScanningShops(true);
      setRegisteredShops([]);
      setMapMarkerShops([]);
      setShopsHasMore(false);
      setShopsTotal(0);
    }

    if (scanFetchTimerRef.current) {
      clearTimeout(scanFetchTimerRef.current);
    }

    const runFetch = () => {
      const needsFetch =
        lastScanFetchRef.current !== locKey || silentRescanRequestedRef.current;
      if (!needsFetch) {
        if (isCurrent) {
          setIsScanningShops(false);
        }
        return;
      }

      log.info('fetchRegisteredShops:map', {
        lat: scanLocation.latitude,
        lng: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        categoryId: categoryKey,
        customScan: usingCustomScan,
        silent: !explicitScanRefreshRef.current,
      });

      if (explicitScanRefreshRef.current) {
        setIsScanningShops(true);
      }
      shopsPageRef.current = 1;
      const shopCategoryId =
        selectedCategory === 'all' || selectedCategory === 'none' ? '' : selectedCategory;
      const fetchParams = {
        latitude: scanLocation.latitude,
        longitude: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        shopCategoryId,
      };

      const listPromise = loadNearbyRegisteredShops({
        ...fetchParams,
        page: 1,
        limit: DEFAULT_PAGE_SIZE,
      });

      const mapPromise = loadAllNearbyShopsForMap(fetchParams);

      listPromise
        .then((data) => {
          if (!isCurrent) {
            return;
          }
          lastScanFetchRef.current = locKey;
          log.ok('fetchRegisteredShops:map-loaded', {
            count: Array.isArray(data) ? data.length : data?.items?.length || 0,
          });
          const shops = Array.isArray(data) ? data : data?.items || data?.shops || [];
          setRegisteredShops(shops);
          setShopsHasMore(Boolean(data?.hasMore));
          setShopsTotal(Math.max(0, Number(data?.total) || shops.length));
        })
        .catch((error) => {
          if (!isCurrent) {
            return;
          }
          lastScanFetchRef.current = null;
          log.fail('fetchRegisteredShops:map-failed', error);
        })
        .finally(() => {
          if (isCurrent) {
            explicitScanRefreshRef.current = false;
            silentRescanRequestedRef.current = false;
            setIsScanningShops(false);
            setInitialShopScanComplete(true);
          }
        });

      mapPromise
        .then((shops) => {
          if (!isCurrent) {
            return;
          }
          log.ok('fetchMapMarkers:loaded', { count: shops.length });
          setMapMarkerShops(Array.isArray(shops) ? shops : []);
        })
        .catch((error) => {
          if (!isCurrent) {
            return;
          }
          log.fail('fetchMapMarkers:failed', error);
          if (explicitScanRefreshRef.current) {
            setMapMarkerShops([]);
          }
        });
    };

    // Tab đang mở: debounce ngắn trước khi quét lại. Tab ẩn: debounce nhẹ để preload.
    const delayMs = isScreenActive ? 800 : 400;
    scanFetchTimerRef.current = setTimeout(runFetch, delayMs);

    return () => {
      isCurrent = false;
      if (scanFetchTimerRef.current) {
        clearTimeout(scanFetchTimerRef.current);
      }
    };
  }, [scanLocation, selectedRadius, selectedCategory, usingCustomScan, isScreenActive]);

  const loadMoreShops = useCallback(async () => {
    if (
      isLoadingMoreShops ||
      !shopsHasMore ||
      !hasValidLocation(scanLocation) ||
      selectedCategory === 'none'
    ) {
      return;
    }

    setIsLoadingMoreShops(true);
    try {
      const nextPage = shopsPageRef.current + 1;
      const effectiveRadius = selectedRadius == null ? 0 : selectedRadius;
      const data = await loadNearbyRegisteredShops({
        latitude: scanLocation.latitude,
        longitude: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        shopCategoryId: selectedCategory === 'all' ? '' : selectedCategory,
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const rows = Array.isArray(data) ? data : data?.items || data?.shops || [];
      shopsPageRef.current = nextPage;
      setRegisteredShops((current) => appendUniqueById(current, rows));
      setShopsHasMore(Boolean(data?.hasMore));
      setShopsTotal(Math.max(0, Number(data?.total) || shopsTotal));
    } catch (error) {
      log.fail('fetchRegisteredShops:map-load-more-failed', error);
    } finally {
      setIsLoadingMoreShops(false);
    }
  }, [
    isLoadingMoreShops,
    scanLocation,
    selectedCategory,
    selectedRadius,
    shopsHasMore,
    shopsTotal,
  ]);

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
        categoryName: shop.category_name || categoryMeta?.name || shop.categoryName || '',
      };
    },
    [shopCategoryLookup]
  );

  const liveDistanceOrigin = useMemo(() => {
    if (usingCustomScan && hasValidLocation(scanLocation)) {
      return scanLocation;
    }
    return currentLocation;
  }, [usingCustomScan, scanLocation, currentLocation]);

  const startDirectionsToStore = useCallback(
    ({ shopId, storeName, latitude, longitude, categoryId = '', storeAvatar = '' }) => {
      const nextLatitude = Number(latitude);
      const nextLongitude = Number(longitude);

      if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
        Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
        return;
      }

      setStoreNav(null);
      setMenuVisible(false);
      setDirectionsSession({
        storeId: String(shopId),
        reservationId: null,
        storeName: storeName || 'Gian hàng',
        storeAvatar: String(storeAvatar || '').trim(),
        initialLocation: hasValidLocation(currentLocation) ? { ...currentLocation } : null,
        destination: {
          latitude: nextLatitude,
          longitude: nextLongitude,
          image_url: String(storeAvatar || '').trim(),
          type: 'shop',
        },
        returnTo: { type: 'mapStore', storeId: String(shopId) },
      });
      onClearFocus?.();
    },
    [onClearFocus, currentLocation]
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
          initialLocation: hasValidLocation(currentLocation) ? { ...currentLocation } : null,
          destination: {
            latitude: targetStore.latitude,
            longitude: targetStore.longitude,
            image_url: String(enrichedStore.image_url || enrichedStore.cover_image_url || '').trim(),
            type: 'shop',
          },
          returnTo: focusStoreRequest?.returnTo || null,
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
  }, [focusStoreRequest, registeredShops, enrichShopWithCategory, currentLocation]);

  const shopDistanceOrigin = hasValidLocation(scanLocation) ? scanLocation : liveDistanceOrigin;

  const filterShopsByCategory = useCallback(
    (shops) => {
      if (selectedCategory === 'none') {
        return [];
      }

      const enrichedShops = shops.map(enrichShopWithCategory);

      if (selectedCategory === 'all') {
        return enrichedShops;
      }

      return enrichedShops.filter(
        (item) => String(item.category_id || item.categoryId || '') === String(selectedCategory)
      );
    },
    [selectedCategory, enrichShopWithCategory]
  );

  const enrichAndFilterByRadius = useCallback(
    (items) => {
      if (!hasValidLocation(shopDistanceOrigin) || items.length === 0) {
        return items;
      }

      const enriched = items.map((item) => ({
        ...item,
        distance_meters: getDistanceFromCurrentLocation(shopDistanceOrigin, item),
      }));

      const filtered = selectedRadius
        ? enriched.filter(
            (item) =>
              item.distance_meters !== null &&
              Number.isFinite(item.distance_meters) &&
              item.distance_meters <= selectedRadius
          )
        : enriched;

      return [...filtered].sort(
        (left, right) =>
          (left.distance_meters ?? Number.MAX_SAFE_INTEGER) -
          (right.distance_meters ?? Number.MAX_SAFE_INTEGER)
      );
    },
    [shopDistanceOrigin, selectedRadius]
  );

  const filterMapMarkersByRadius = useCallback(
    (items) => {
      if (!selectedRadius) {
        return items;
      }

      return items.filter((item) => {
        const distance = Number(item.distance_meters ?? item.distanceMeters);
        return Number.isFinite(distance) && distance <= selectedRadius;
      });
    },
    [selectedRadius]
  );

  const mapRestaurantPayload = useMemo(
    () =>
      buildMapMarkerPayload(
        filterMapMarkersByRadius(filterShopsByCategory(mapMarkerShops)).map(
          enrichShopWithCategory
        ),
        { categoryLookup: shopCategoryLookup }
      ),
    [
      mapMarkerShops,
      filterShopsByCategory,
      filterMapMarkersByRadius,
      enrichShopWithCategory,
      shopCategoryLookup,
    ]
  );

  const displayRestaurants = useMemo(
    () => enrichAndFilterByRadius(filterShopsByCategory(registeredShops)),
    [registeredShops, filterShopsByCategory, enrichAndFilterByRadius]
  );

  const originLocation = liveDistanceOrigin;

  const radiusCircleProp =
    selectedRadius && hasValidLocation(scanLocation || currentLocation)
      ? { center: scanLocation || currentLocation, radius: selectedRadius }
      : null;

  function requestRecenter(location) {
    setRecenterRequest({ location, at: Date.now() });
  }

  function handleRecenterPress() {
    log.info('recenter:pressed');
    setUsingCustomScan(false);

    const cached = currentLocation;
    if (hasValidLocation(cached)) {
      setScanLocation({ ...cached });
      resolveScanAddress(cached);
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
          log.warn('recenter:no-location');
        }
      })
      .catch((error) => {
        log.fail('recenter:gps-failed', error);
      });
  }

  const wasScreenActiveRef = useRef(isScreenActive);

  useEffect(() => {
    if (!isScreenActive) {
      setMenuVisible(false);
      setIsSearchFocused(false);
      wasScreenActiveRef.current = false;
      return;
    }

    wasScreenActiveRef.current = true;

    // Quay lại tab: quét ngầm, giữ list & dòng "X điểm trong Y km" cho đến khi có dữ liệu mới.
    silentRescanRequestedRef.current = true;
    if (hasValidLocation(currentLocation) && !usingCustomScan) {
      resolveScanAddress(currentLocation);
      setScanLocation({ ...currentLocation });
    }
  }, [isScreenActive, usingCustomScan, resolveScanAddress, currentLocation]);

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
    const returnTo = directionsSession?.returnTo ?? null;
    setDirectionsSession(null);
    onClearFocus?.();

    if (returnTo?.type === 'mapStore' && returnTo.storeId) {
      setStoreNav({ screen: 'store', storeId: String(returnTo.storeId) });
      return;
    }

    onDirectionsStopped?.(returnTo);
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

  const RADIUS_SLIDER_MAX = 10000;
  const RADIUS_SLIDER_STEP = 500;

  function formatRadiusLabel(meters) {
    if (!meters) {
      return 'Tắt';
    }
    return formatDistance(meters);
  }

  function formatNearbyDistance(distanceMeters) {
    return formatNearbyDistanceLabel(distanceMeters);
  }

  function adjustRadius(delta) {
    const base = selectedRadius == null ? 0 : Number(selectedRadius) || 0;
    const next = Math.max(0, Math.min(RADIUS_SLIDER_MAX, base + delta));
    const nextRadius = next > 0 ? next : null;
    if (nextRadius === selectedRadius) {
      return;
    }
    beginScanRefresh();
    setSelectedRadius(nextRadius);
  }

  useEffect(() => {
    setRadiusDraft(selectedRadius == null ? 0 : selectedRadius);
  }, [selectedRadius]);

  const restaurantCategories = useMemo(() => {
    const dynamicCategories = shopCategories.map((category) => ({
      key: String(category.id),
      name: category.name || category.categoryName || 'Danh mục',
      description: category.description || '',
    }));

    return [
      { key: 'none', name: 'Ẩn tất cả' },
      { key: 'all', name: 'Tất cả gian hàng' },
      ...dynamicCategories,
    ];
  }, [shopCategories]);

  const selectedCategoryLabel =
    restaurantCategories.find((category) => category.key === selectedCategory)?.name || 'Tất cả';

  const selectedRadiusLabel = formatRadiusLabel(selectedRadius);

  const mapLocationReady = hasValidLocation(scanLocation || currentLocation);
  const awaitingInitialShopScan =
    selectedCategory !== 'none' && mapLocationReady && !initialShopScanComplete;

  const showNearbyPanel =
    initialShopScanComplete &&
    selectedCategory !== 'none' &&
    displayRestaurants.length > 0 &&
    !storeNav &&
    !isScanningShops;

  const scannedPointsTotal = shopsTotal > 0 ? shopsTotal : displayRestaurants.length;

  const scanLocationLabel = useMemo(() => {
    const coords = formatScanCoords(liveDistanceOrigin || scanLocation || currentLocation);
    const address = isResolvingScanAddress
      ? 'Đang lấy địa chỉ hệ thống...'
      : scanSystemAddress || 'Chưa có địa chỉ hệ thống';

    return `${coords} · ${address}`;
  }, [liveDistanceOrigin, scanLocation, currentLocation, isResolvingScanAddress, scanSystemAddress]);

  const mapFlex = isShopPanelExpanded ? MAP_FLEX_HALF : MAP_FLEX_SHOP_COLLAPSED;
  const shopFlex = isShopPanelExpanded ? SHOP_FLEX_HALF : SHOP_FLEX_COLLAPSED;

  let screenContent;

  if (activeReservation) {
    screenContent = (
      <ReservationScreen
        loading={!activeReservation.product}
        loadError={activeReservation.loadError || null}
        product={activeReservation.product}
        store={activeReservation.store}
        preselectedVariantId={activeReservation.preselectedVariantId}
        initialQuantity={activeReservation.initialQuantity || 1}
        initialFormResume={activeReservation.initialFormResume || null}
        onBack={() => setActiveReservation(null)}
        onSuccess={() => {
          setActiveReservation(null);
          setStoreNav(null);
          onOpenBuyerOrders?.(RESERVATION_TAB.PENDING);
        }}
        onOpenTopUp={onOpenWalletTopUp}
        resumeSource="map"
        resumeStoreId={storeNav?.storeId || activeReservation?.store?.id || null}
      />
    );
  } else if (directionsSession) {
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
        onNavigateDirections={startDirectionsToStore}
        onOrderSuccess={(tab) => {
          setStoreNav(null);
          setActiveReservation(null);
          onOpenBuyerOrders?.(tab);
        }}
        onOpenTopUp={onOpenWalletTopUp}
        reservationSource="map"
      />
    );
  } else if (storeNav?.screen === 'product') {
    screenContent = (
      <ProductDetailScreen
        productId={storeNav.productId}
        onBack={goBackStoreNav}
        onStorePress={openStore}
        onOpenTopUp={onOpenWalletTopUp}
        onOrderSuccess={(tab) => {
          setStoreNav(null);
          setActiveReservation(null);
          onOpenBuyerOrders?.(tab);
        }}
        reservationSource="map"
        reservationStoreId={storeNav.storeId || null}
        resumeReserveRequest={
          resumeReserveRequest &&
          String(resumeReserveRequest.productId) === String(storeNav.productId)
            ? resumeReserveRequest
            : null
        }
        onResumeReserveConsumed={onResumeReserveHandled}
        onReserve={(product, store, selectedVariant) => {
          const pendingResume =
            resumeReserveRequest &&
            String(resumeReserveRequest.productId) === String(storeNav.productId)
              ? resumeReserveRequest
              : null;
          const formResume = toReservationFormResume(pendingResume);
          setActiveReservation({
            product: { ...product, id: product.id || storeNav.productId },
            store,
            preselectedVariantId:
              pendingResume?.variantId || selectedVariant?.id || null,
            initialQuantity: pendingResume?.quantity || 1,
            initialFormResume: formResume,
          });
        }}
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
          shouldAutoRecenter={isScreenActive && !directionsSession && !usingCustomScan}
          scanLocation={
            usingCustomScan && hasValidLocation(scanLocation) ? scanLocation : null
          }
          restaurants={mapRestaurantPayload}
          onEvent={handleMapEvent}
          interactive={!isSearchFocused}
        />

        <View style={styles.searchOverlay} pointerEvents="box-none">
          <View style={styles.searchBarWrap} pointerEvents="auto">
            <View style={styles.searchTopRow}>
              <View style={styles.searchBarFlex}>
                <AddressSearchBar
                  placeholder="Tìm đường, địa điểm..."
                  onSelectResult={handleSearchSelect}
                  onFocusChange={handleSearchFocusChange}
                />
              </View>
              <BuyerQuickMenu
                onEditAccount={onEditAccount}
                onOpenWallet={onOpenWallet}
                onOpenHoldingOrders={() => onOpenBuyerOrders?.(RESERVATION_TAB.HOLDING)}
                onOpenFavoriteProducts={onOpenFavoriteProducts}
                onOpenReport={onOpenReport}
                onLogout={() => confirmLogout(() => dispatch(logoutUser()))}
                buttonStyle={styles.mapQuickMenuBtn}
                iconColor="#334155"
              />
            </View>
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

              <View style={styles.radiusHeaderRow}>
                <Text style={styles.menuSubHeader}>Bán kính hiển thị</Text>
                <Text style={styles.radiusValueText}>
                  {radiusDraft > 0 ? `📍 ${formatRadiusLabel(radiusDraft)}` : '🚫 0 km'}
                </Text>
              </View>
              <Slider
                style={styles.radiusSlider}
                minimumValue={0}
                maximumValue={RADIUS_SLIDER_MAX}
                step={RADIUS_SLIDER_STEP}
                value={selectedRadius == null ? 0 : selectedRadius}
                minimumTrackTintColor="#076F32"
                maximumTrackTintColor="#e2e8f0"
                thumbTintColor="#076F32"
                onValueChange={(value) => setRadiusDraft(value)}
                onSlidingComplete={(value) => {
                  const nextRadius = value > 0 ? Math.round(value) : null;
                  if (nextRadius !== selectedRadius) {
                    beginScanRefresh();
                    setSelectedRadius(nextRadius);
                  }
                }}
              />
              <View style={styles.radiusScaleRow}>
                <Text style={styles.radiusScaleText}>0 km</Text>
                <Text style={styles.radiusScaleText}>5 km</Text>
                <Text style={styles.radiusScaleText}>10 km</Text>
              </View>
              <View style={styles.radiusStepRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Giảm bán kính 0,5 km"
                  style={({ pressed }) => [styles.radiusStepBtn, pressed && styles.mapFabPressed]}
                  onPress={() => adjustRadius(-RADIUS_SLIDER_STEP)}
                >
                  <Ionicons name="remove" size={18} color="#076F32" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tăng bán kính 0,5 km"
                  style={({ pressed }) => [styles.radiusStepBtn, pressed && styles.mapFabPressed]}
                  onPress={() => adjustRadius(RADIUS_SLIDER_STEP)}
                >
                  <Ionicons name="add" size={18} color="#076F32" />
                </Pressable>
              </View>

              <View style={styles.divider} />

              <Text style={styles.menuSubHeader}>Danh mục gian hàng</Text>
              {restaurantCategories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <MapCategoryOption
                    key={cat.key}
                    category={cat}
                    selected={isSelected}
                    onPress={() => {
                      if (cat.key === selectedCategory) {
                        return;
                      }
                      beginScanRefresh();
                      setSelectedCategory(cat.key);
                    }}
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
            {selectedCategory === 'none'
              ? 'Chọn loại hiển thị để xem danh sách'
              : !mapLocationReady
                ? 'Đang lấy vị trí để quét gian hàng gần bạn...'
                : isScanningShops || awaitingInitialShopScan
                  ? 'Đang quét gian hàng gần bạn...'
                  : showNearbyPanel
                    ? `${scannedPointsTotal} điểm trong ${selectedRadiusLabel} — chạm để xem`
                    : `Không có điểm nào trong bán kính ${selectedRadiusLabel}`}
          </Text>
          {showNearbyPanel ? (
            <FlatList
              data={displayRestaurants}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.nearbyList}
              ListFooterComponent={
                displayRestaurants.length > 0 ? (
                  <LoadMoreButton
                    currentCount={displayRestaurants.length}
                    totalCount={scannedPointsTotal}
                    loading={isLoadingMoreShops}
                    onPress={loadMoreShops}
                  />
                ) : null
              }
              renderItem={({ item: restaurant }) => {
                const categoryLabel =
                  restaurant.category_name ||
                  TYPE_LABEL[restaurant.type] ||
                  'Gian hàng';
                const productCount = Number(restaurant.total_products ?? restaurant.product_count ?? 0);
                const rating = Number(restaurant.rating_avg ?? restaurant.diemTB ?? 0);
                const distanceLabel = formatNearbyDistance(restaurant.distance_meters);
                const isOpen = restaurant.is_open !== false && restaurant.is_open !== 0;
                const avatarUrl = resolveShopAvatarUri(restaurant);

                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.nearbyCard,
                      pressed && styles.nearbyCardPressed,
                    ]}
                    onPress={() => openStore(restaurant.id)}
                  >
                    <AvatarBadge
                      name={restaurant.shop_name || restaurant.name || 'S'}
                      uri={avatarUrl}
                      size={56}
                      style={styles.nearbyThumb}
                    />
                    <View style={styles.nearbyCardBody}>
                      <Text style={styles.nearbyName} numberOfLines={1}>
                        {restaurant.shop_name || restaurant.name}
                      </Text>
                      <View style={styles.nearbyMetricsRow}>
                        <Ionicons name="star" size={12} color="#eab308" />
                        <Text style={styles.nearbyRating}>
                          {rating > 0 ? rating.toFixed(1) : 'Mới'}
                        </Text>
                        <Text style={styles.nearbyMetricSep}>·</Text>
                        <Text style={styles.nearbyMetricText}>{productCount} sản phẩm</Text>
                        <View
                          style={[
                            styles.nearbyOpenBadge,
                            !isOpen && styles.nearbyOpenBadgeClosed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.nearbyOpenBadgeText,
                              !isOpen && styles.nearbyOpenBadgeTextClosed,
                            ]}
                          >
                            {isOpen ? 'Đang mở cửa' : 'Đóng cửa'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.nearbyCategory} numberOfLines={1}>
                        {categoryLabel}
                        {distanceLabel && distanceLabel !== '--' ? ` · ${distanceLabel}` : ''}
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

  return <>{screenContent}</>;
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
    zIndex: 40,
    elevation: 16,
  },
  searchBarWrap: {
    paddingHorizontal: 14,
    zIndex: 41,
    elevation: 16,
  },
  searchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarFlex: {
    flex: 1,
    minWidth: 0,
  },
  mapQuickMenuBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignSelf: 'center',
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
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  nearbyCardPressed: {
    opacity: 0.85,
    backgroundColor: '#fafafa',
  },
  nearbyThumb: {
    flexShrink: 0,
  },
  nearbyCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nearbyName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 18,
  },
  nearbyMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  nearbyRating: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  nearbyMetricSep: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  nearbyMetricText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  nearbyOpenBadge: {
    marginLeft: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#e8f5e9',
  },
  nearbyOpenBadgeClosed: {
    backgroundColor: '#f1f5f9',
  },
  nearbyOpenBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2e7d32',
  },
  nearbyOpenBadgeTextClosed: {
    color: '#64748b',
  },
  nearbyCategory: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
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
    backgroundColor: '#076F32',
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
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#076F32',
  },
  radiusSlider: {
    width: '100%',
    height: 32,
  },
  radiusScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  radiusScaleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  radiusStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  radiusStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#c7ead6',
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#076F32',
    fontWeight: '800',
  },
  checkmark: {
    fontSize: 13,
    color: '#076F32',
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
    color: '#076F32',
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
    backgroundColor: '#076F32',
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
