import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { getUnreadNotificationCountOnBackend } from '../../api/notificationApi';
import {
  notificationMatchesAudience,
  resolveUnreadCountFromReadEvent,
} from '../../core/utils/notificationRealtime';
import { APP_MODE_BUYER, useAppMode } from '../../hooks/useAppMode';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import { usePresence } from '../../hooks/usePresence';
import { useShopPresence } from '../../hooks/useShopPresence';
import { useSellerAccessSync } from '../../hooks/useSellerAccessSync';
import { useAccountStatusSync } from '../../hooks/useAccountStatusSync';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import { hasValidLocation, resolveShopCoordinates } from '../../core/utils/geo';
import { toResumeReserveRequest } from '../../viewmodel/buyer/reservationResumeSession';
import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsAccountLocked,
  selectIsSeller,
} from '../../viewmodel/auth/authSelectors';
import AccountLockedScreen from './AccountLockedScreen';

import ProductsScreen from '../home/ProductsScreen';
import HomeScreen from '../home/HomeScreen';
import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';
import NotificationsScreen from '../inbox/NotificationsScreen';
import MapScreen from '../map/MapScreen';
import ProfilePanel from './ProfilePanel';
import ShopTabPanel from '../seller/ShopTabPanel';
import WalletTopUpOverlay from '../wallet/WalletTopUpOverlay';
import {
  registerWalletTopUpHandler,
  unregisterWalletTopUpHandler,
} from '../wallet/walletTopUpBridge';

const ACTIVE_COLOR = '#076F32';
const INACTIVE_COLOR = '#94A3B8';
const TAB_LABEL_COLOR = '#0f172a';
const ICON_SIZE = 24;

const TABS = [
  { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
  {
    key: 'products',
    label: 'Sản phẩm',
    icon: 'bag-outline',
    activeIcon: 'bag',
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    icon: 'receipt-outline',
    activeIcon: 'receipt',
  },
  {
    key: 'shop',
    label: 'Gian hàng',
    icon: 'storefront-outline',
    activeIcon: 'storefront',
  },
  {
    key: 'notifications',
    label: 'Thông báo',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
    badgeKey: 'notifications',
  },
  { key: 'profile', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

function getTabIconName(tab, isActive) {
  if (isActive && tab.activeIcon) {
    return tab.activeIcon;
  }
  return tab.icon;
}

function TabIcon({ icon, color, badgeCount = 0 }) {
  const count = Math.max(0, Number(badgeCount) || 0);
  const label = count > 99 ? '99+' : String(count);

  return (
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={ICON_SIZE} color={color} />
      {count > 0 ? (
        <View style={[styles.badge, count > 9 && styles.badgeWide]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function AuthenticatedHome() {
  const isAccountLocked = useSelector(selectIsAccountLocked);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const isSeller = useSelector(selectIsSeller);
  const profile = useSelector(selectAuthProfile);
  const canPost = Boolean(canSwitchToSeller && isSeller);
  const { appMode, setAppMode, isReady } = useAppMode(false);
  const presenceEnabled = !isAccountLocked;

  usePresence(APP_MODE_BUYER, { enabled: presenceEnabled });
  useShopPresence(canPost ? 'seller' : APP_MODE_BUYER, { enabled: presenceEnabled });

  const tabs = TABS;
  const [activeTab, setActiveTab] = useState('home');
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [returnOrdersDetailRequest, setReturnOrdersDetailRequest] = useState(null);
  const [returnProductsStoreRequest, setReturnProductsStoreRequest] = useState(null);
  const [profileOpenStoreRequest, setProfileOpenStoreRequest] = useState(null);
  const [productsFocusRequest, setProductsFocusRequest] = useState(null);
  const [sellerRegisterRequest, setSellerRegisterRequest] = useState(0);
  const [productDetailId, setProductDetailId] = useState(null);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const [openBuyerOrdersRequest, setOpenBuyerOrdersRequest] = useState(null);
  const [buyerOrdersTab, setBuyerOrdersTab] = useState(RESERVATION_TAB.PENDING);
  const [nestedTabState, setNestedTabState] = useState({});
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [buyerOverlay, setBuyerOverlay] = useState(null);
  const [walletTopUpOverlay, setWalletTopUpOverlay] = useState(null);
  const [profileNavRequest, setProfileNavRequest] = useState(null);
  const [resumeReserveRequest, setResumeReserveRequest] = useState(null);
  /** Giữ product/store nested khi tạm sang nạp ví từ giữ hàng. */
  const [keepNestedAcrossTabs, setKeepNestedAcrossTabs] = useState(false);
  const keepNestedAcrossTabsRef = useRef(false);

  const updateNestedTabState = useCallback((tabKey, isNested) => {
    setNestedTabState((current) => {
      const nextValue = Boolean(isNested);
      if (Boolean(current[tabKey]) === nextValue) {
        return current;
      }
      return { ...current, [tabKey]: nextValue };
    });
  }, []);

  const reportHomeNested = useCallback(
    (isNested) => updateNestedTabState('home', isNested),
    [updateNestedTabState]
  );
  const reportProductsNested = useCallback(
    (isNested) => updateNestedTabState('products', isNested),
    [updateNestedTabState]
  );
  const reportOrdersNested = useCallback(
    (isNested) => updateNestedTabState('orders', isNested),
    [updateNestedTabState]
  );
  const reportShopNested = useCallback(
    (isNested) => updateNestedTabState('shop', isNested),
    [updateNestedTabState]
  );
  const reportNotificationsNested = useCallback(
    (isNested) => updateNestedTabState('notifications', isNested),
    [updateNestedTabState]
  );
  const reportProfileNested = useCallback(
    (isNested) => updateNestedTabState('profile', isNested),
    [updateNestedTabState]
  );

  const closeBuyerOverlay = useCallback(() => {
    setBuyerOverlay(null);
    setProductsFocusRequest(null);
  }, []);

  const closeWalletTopUpOverlay = useCallback(() => {
    setWalletTopUpOverlay(null);
  }, []);

  const handleSelectTab = useCallback(
    (nextTab) => {
      if (!nextTab) {
        return;
      }

      // Overlay (Thông báo/Inbox/Sản phẩm) che tab — bấm tab hiện tại cũng phải đóng được.
      if (buyerOverlay) {
        closeBuyerOverlay();
        if (nextTab === activeTab) {
          updateNestedTabState(activeTab, false);
          return;
        }
      }

      if (walletTopUpOverlay) {
        closeWalletTopUpOverlay();
        if (nextTab === activeTab) {
          updateNestedTabState(activeTab, false);
          return;
        }
      }

      if (nextTab === activeTab) {
        return;
      }

      const leavingTab = activeTab;
      const keepNested = keepNestedAcrossTabsRef.current;

      // Đóng overlay / one-shot request khi đổi tab — không remount tab
      // (remount khiến sellerRegisterRequest / profileNavRequest kích lại → mất bottom nav).
      if (leavingTab === 'profile' && !keepNested) {
        setProductDetailId(null);
        setProfileNavRequest(null);
      }
      if (leavingTab === 'home' && !keepNested) {
        setMapFocusRequest(null);
      }
      if (leavingTab === 'shop') {
        setSellerRegisterRequest(0);
      }
      // Rời bottom tab Đơn hàng → về tab mặc định "Chờ xác nhận" khi quay lại.
      if (leavingTab === 'orders') {
        setBuyerOrdersTab(RESERVATION_TAB.PENDING);
        setOpenBuyerOrdersRequest(null);
      }

      // Giữ overlay products khi đang sang nạp ví từ giữ hàng — sẽ đóng bên dưới nếu không keep.
      if (!keepNested) {
        closeBuyerOverlay();
      } else if (buyerOverlay === 'products') {
        // Ẩn overlay trong lúc nạp ví (tránh che TopUp); sẽ mở lại khi quay về.
        setBuyerOverlay(null);
      }

      // Tab gốc luôn hiện bottom nav; panel active sẽ báo lại nếu đang ở màn phụ.
      setNestedTabState((current) => ({
        ...current,
        [leavingTab]: false,
        [nextTab]: false,
      }));
      setActiveTab(nextTab);
    },
    [
      activeTab,
      buyerOverlay,
      closeBuyerOverlay,
      closeWalletTopUpOverlay,
      updateNestedTabState,
      walletTopUpOverlay,
    ]
  );

  const loadUnreadBadges = useCallback(async () => {
    try {
      // Đếm từ backend theo toàn bộ thông báo, không dựa vào trang 20 item đang tải.
      const notificationCount = await getUnreadNotificationCountOnBackend('buyer');
      setUnreadNotificationsCount(notificationCount);
    } catch {
      // Keep the previous badge state on transient failures.
    }
  }, []);

  const handleRealtimeNotification = useCallback((notification) => {
    if (!notificationMatchesAudience(notification, 'buyer')) {
      return;
    }

    if (!notification.isRead) {
      setUnreadNotificationsCount((current) => current + 1);
    }
  }, []);

  const handleNotificationRead = useCallback((payload) => {
    const audience = String(payload?.audience || '').trim().toLowerCase();
    if (audience && audience !== 'buyer' && audience !== 'system') {
      return;
    }

    const unreadCount = resolveUnreadCountFromReadEvent(payload, 'buyer');
    if (unreadCount != null) {
      setUnreadNotificationsCount(unreadCount);
      return;
    }

    setUnreadNotificationsCount((current) => Math.max(0, current - 1));
  }, []);

  useNotificationSocket({
    enabled: isReady && !isAccountLocked,
    onNotificationNew: handleRealtimeNotification,
    onNotificationRead: handleNotificationRead,
  });

  useSellerAccessSync({
    enabled: !isAccountLocked,
  });

  useAccountStatusSync({ enabled: true });

  useEffect(() => {
    if (!isReady || isAccountLocked) {
      return;
    }
    setAppMode(APP_MODE_BUYER);
  }, [isReady, isAccountLocked, setAppMode]);

  useEffect(() => {
    if (activeTab === 'post') {
      setActiveTab('shop');
    }
  }, [activeTab]);

  useEffect(() => {
    const legacyTabMap = {
      map: 'home',
      inbox: 'profile',
      favorites: 'products',
    };
    if (legacyTabMap[activeTab]) {
      setActiveTab(legacyTabMap[activeTab]);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isReady || isAccountLocked) {
      return;
    }

    loadUnreadBadges();
    const timer = setInterval(loadUnreadBadges, 30000);
    return () => clearInterval(timer);
  }, [isReady, isAccountLocked, loadUnreadBadges, activeTab]);

  function getBadgeCount(tab) {
    if (tab.badgeKey === 'notifications') {
      return unreadNotificationsCount;
    }
    return 0;
  }

  function handleOpenStoreFromProfile(storeId) {
    setMapFocusRequest({
      storeId: String(storeId),
      at: Date.now(),
    });
    handleSelectTab('home');
  }

  function handleNavigateToStore({ shopId, storeName }) {
    setMapFocusRequest({
      storeId: String(shopId),
      storeName: storeName || 'Gian hàng',
      showDirections: true,
      returnTo: { tab: activeTab, storeId: String(shopId) },
      at: Date.now(),
    });
    handleSelectTab('home');
  }

  function handleNavigatePickup({ shopId, reservationId, storeName, latitude, longitude, location }) {
    const coords =
      location && hasValidLocation(location)
        ? location
        : resolveShopCoordinates({ latitude, longitude });
    setMapFocusRequest({
      storeId: String(shopId),
      reservationId,
      storeName,
      ...(coords ? { location: coords } : {}),
      showDirections: true,
      returnTo: {
        tab: 'orders',
        storeId: String(shopId),
        reservationId: reservationId ? String(reservationId) : null,
        ordersTab: buyerOrdersTab,
      },
      at: Date.now(),
    });
    handleSelectTab('home');
  }

  function handleDirectionsStopped(returnTo) {
    if (!returnTo?.tab) {
      return;
    }

    if (returnTo.tab === 'orders') {
      if (returnTo.ordersTab) {
        setBuyerOrdersTab(returnTo.ordersTab);
      }
      if (returnTo.reservationId) {
        setReturnOrdersDetailRequest({
          at: Date.now(),
          reservationId: String(returnTo.reservationId),
          tab: returnTo.ordersTab || buyerOrdersTab,
        });
      }
      handleSelectTab('orders');
      return;
    }

    if (returnTo.tab === 'products' && returnTo.storeId) {
      setReturnProductsStoreRequest({
        at: Date.now(),
        storeId: String(returnTo.storeId),
      });
      handleSelectTab('products');
      return;
    }

    if (returnTo.tab === 'profile' && returnTo.storeId) {
      setProductDetailId(null);
      setProfileOpenStoreRequest({
        at: Date.now(),
        storeId: String(returnTo.storeId),
      });
      handleSelectTab('profile');
      return;
    }

    handleSelectTab(returnTo.tab);
  }

  function handleOpenProductsFromHome(options = {}) {
    setProductsFocusRequest({
      ...options,
      at: Date.now(),
    });
    setBuyerOverlay('products');
    handleSelectTab('products');
  }

  function handleOpenMapFromHome() {
    handleSelectTab('home');
  }

  function handleCloseBuyerOverlay() {
    closeBuyerOverlay();
    updateNestedTabState(activeTab, false);
  }

  function handleClearMapFocus() {
    setMapFocusRequest(null);
  }

  function handleOpenBuyerOrders(tab = RESERVATION_TAB.PENDING) {
    setBuyerOrdersTab(tab);
    setOpenBuyerOrdersRequest({ at: Date.now(), tab });
    handleSelectTab('orders');
  }

  function handlePickupCompleted() {
    handleOpenBuyerOrders(RESERVATION_TAB.HOLDING);
  }

  function handleProductChanged() {
    setProductRefreshKey(Date.now());
  }

  function handleOpenProductDetail(productId) {
    setProductDetailId(productId || null);
    if (productId) {
      handleSelectTab('profile');
    }
  }

  function handleStartSellerRegister() {
    setSellerRegisterRequest(Date.now());
    handleSelectTab('shop');
  }

  function handleOpenShopNav() {
    handleSelectTab('shop');
  }

  function handleOpenProfileNav(screenOrRequest) {
    const request =
      typeof screenOrRequest === 'string'
        ? { screen: screenOrRequest, at: Date.now() }
        : { ...screenOrRequest, at: screenOrRequest?.at || Date.now() };
    setProfileNavRequest(request);
    handleSelectTab('profile');
  }

  const handleOpenWalletTopUp = useCallback((context) => {
    const productId = String(context?.productId || '').trim();
    if (productId) {
      keepNestedAcrossTabsRef.current = true;
      setKeepNestedAcrossTabs(true);
      setWalletTopUpOverlay({ returnTo: 'reservation', at: Date.now() });
      return;
    }
    keepNestedAcrossTabsRef.current = false;
    setKeepNestedAcrossTabs(false);
    setWalletTopUpOverlay({ returnTo: 'wallet', at: Date.now() });
  }, []);

  useEffect(() => {
    registerWalletTopUpHandler(handleOpenWalletTopUp);
    return () => unregisterWalletTopUpHandler();
  }, [handleOpenWalletTopUp]);

  function handleOpenWalletFromTopUp(screen = 'wallet') {
    handleOpenProfileNav(screen);
  }

  function handleContinueReservationAfterTopUp(payload) {
    keepNestedAcrossTabsRef.current = false;
    setKeepNestedAcrossTabs(false);
    setProfileNavRequest({ screen: '__clear__', at: Date.now() });

    if (!payload?.productId) {
      handleOpenProfileNav({ screen: 'wallet', returnTo: 'wallet' });
      return;
    }

    const source = payload.source || 'products';

    if (source === 'map' || source === 'profile') {
      setResumeReserveRequest(toResumeReserveRequest(payload));
    }

    if (source === 'map') {
      setProductDetailId(null);
      setBuyerOverlay(null);
      setActiveTab('home');
      return;
    }

    setBuyerOverlay(null);
    if (source === 'profile') {
      setProductDetailId(String(payload.productId));
      setActiveTab('profile');
      return;
    }
    if (source === 'orders') {
      setActiveTab('orders');
      return;
    }
    setActiveTab('products');
  }

  const tabPanes = useMemo(
    () => ({
      home: (
        <MapScreen
          focusStoreRequest={mapFocusRequest}
          onClearFocus={handleClearMapFocus}
          onDirectionsStopped={handleDirectionsStopped}
          onPickupCompleted={handlePickupCompleted}
          onOpenBuyerOrders={handleOpenBuyerOrders}
          onOpenWalletTopUp={handleOpenWalletTopUp}
          onEditAccount={() => handleOpenProfileNav('edit-account')}
          onOpenWallet={() => handleOpenProfileNav('wallet')}
          onOpenFavoriteProducts={() => handleOpenProfileNav('favorite-products')}
          onOpenReport={() => handleOpenProfileNav('account-report')}
          resumeReserveRequest={
            resumeReserveRequest?.source === 'map' ? resumeReserveRequest : null
          }
          onResumeReserveHandled={() => setResumeReserveRequest(null)}
          keepNestedAcrossTabs={keepNestedAcrossTabs}
          onNavigationStateChange={reportHomeNested}
          isScreenActive={activeTab === 'home'}
        />
      ),
      products: (
        <HomeScreen
          onOpenMap={handleOpenMapFromHome}
          onOpenProducts={handleOpenProductsFromHome}
          onOpenSearch={() => handleOpenProductsFromHome({ focusSearch: true, search: '' })}
          onOpenBuyerOrders={handleOpenBuyerOrders}
          onEditAccount={() => handleOpenProfileNav('edit-account')}
          onOpenWallet={() => handleOpenProfileNav('wallet')}
          onOpenFavoriteProducts={() => handleOpenProfileNav('favorite-products')}
          onOpenReport={() => handleOpenProfileNav('account-report')}
          onStartSellerRegister={handleStartSellerRegister}
          onOpenShop={handleOpenShopNav}
          onOpenWalletTopUp={handleOpenWalletTopUp}
          onNavigateDirections={handleNavigateToStore}
          returnStoreRequest={returnProductsStoreRequest}
          resumeReserveRequest={
            !resumeReserveRequest?.source ||
            resumeReserveRequest.source === 'products' ||
            resumeReserveRequest.source === 'home'
              ? resumeReserveRequest
              : null
          }
          onResumeReserveHandled={() => setResumeReserveRequest(null)}
          keepNestedAcrossTabs={keepNestedAcrossTabs}
          isScreenActive={activeTab === 'products'}
          onNavigationStateChange={reportProductsNested}
        />
      ),
      orders: (
        <BuyerOrdersScreen
          embedded
          activeTab={buyerOrdersTab}
          onActiveTabChange={setBuyerOrdersTab}
          initialTab={openBuyerOrdersRequest?.tab || RESERVATION_TAB.PENDING}
          tabRequestKey={openBuyerOrdersRequest?.at || 0}
          onNavigatePickup={handleNavigatePickup}
          returnDetailRequest={returnOrdersDetailRequest}
          onOpenStore={handleOpenStoreFromProfile}
          onOpenBuyerOrders={handleOpenBuyerOrders}
          onOpenWalletTopUp={handleOpenWalletTopUp}
          resumeReserveRequest={
            resumeReserveRequest?.source === 'orders' ? resumeReserveRequest : null
          }
          onResumeReserveHandled={() => setResumeReserveRequest(null)}
          isScreenActive={activeTab === 'orders'}
          onNavigationStateChange={reportOrdersNested}
        />
      ),
      shop: (
        <ShopTabPanel
          isVisible={activeTab === 'shop'}
          sellerRegisterRequest={sellerRegisterRequest}
          productRefreshKey={productRefreshKey}
          onProductChanged={handleProductChanged}
          onNavigationStateChange={reportShopNested}
        />
      ),
      notifications: (
        <NotificationsScreen
          audience="buyer"
          isScreenActive={activeTab === 'notifications'}
          onNavigationStateChange={reportNotificationsNested}
        />
      ),
      profile: (
        <ProfilePanel
          profileMode="buyer"
          showSellerHub={false}
          onOpenStore={handleOpenStoreFromProfile}
          onNavigateToStore={handleNavigateToStore}
          onNavigatePickup={handleNavigatePickup}
          isProfileVisible={activeTab === 'profile'}
          openStoreRequest={profileOpenStoreRequest}
          productDetailId={productDetailId}
          productRefreshKey={productRefreshKey}
          onOpenProductDetail={handleOpenProductDetail}
          onProductChanged={handleProductChanged}
          canSwitchToSeller={canSwitchToSeller}
          profileNavRequest={profileNavRequest}
          onStartSellerRegister={handleStartSellerRegister}
          onOpenShopTab={handleOpenShopNav}
          onContinueReservationAfterTopUp={handleContinueReservationAfterTopUp}
          keepNestedAcrossTabs={keepNestedAcrossTabs}
          resumeReserveRequest={
            resumeReserveRequest?.source === 'profile' ? resumeReserveRequest : null
          }
          onResumeReserveHandled={() => setResumeReserveRequest(null)}
          onNavigationStateChange={reportProfileNested}
          onOpenBuyerOrdersTab={handleOpenBuyerOrders}
          onOpenWalletTopUp={handleOpenWalletTopUp}
        />
      ),
    }),
    [
      activeTab,
      canSwitchToSeller,
      keepNestedAcrossTabs,
      mapFocusRequest,
      returnOrdersDetailRequest,
      returnProductsStoreRequest,
      profileOpenStoreRequest,
      openBuyerOrdersRequest,
      buyerOrdersTab,
      productDetailId,
      productRefreshKey,
      resumeReserveRequest,
      profileNavRequest,
      reportHomeNested,
      reportProductsNested,
      reportOrdersNested,
      reportNotificationsNested,
      reportProfileNested,
      reportShopNested,
      sellerRegisterRequest,
      handleOpenWalletTopUp,
    ]
  );

  if (isAccountLocked) {
    return <AccountLockedScreen />;
  }

  if (!isReady) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.content} edges={['top', 'left', 'right']}>
        {tabs.map((tab) => (
          <View
            key={tab.key}
            style={[styles.tabPane, activeTab !== tab.key && styles.tabHidden]}
          >
            {tabPanes[tab.key]}
          </View>
        ))}
        {buyerOverlay === 'products' ? (
          <View style={styles.overlayPane}>
            <ProductsScreen
              focusRequest={productsFocusRequest}
              onOpenBuyerOrders={handleOpenBuyerOrders}
              onOpenWalletTopUp={handleOpenWalletTopUp}
              onNavigateDirections={handleNavigateToStore}
              resumeReserveRequest={
                resumeReserveRequest?.source === 'products' ? resumeReserveRequest : null
              }
              onResumeReserveHandled={() => setResumeReserveRequest(null)}
              onBack={handleCloseBuyerOverlay}
            />
          </View>
        ) : null}
      </SafeAreaView>

      <Modal
        visible={Boolean(walletTopUpOverlay)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeWalletTopUpOverlay}
      >
        <SafeAreaView style={styles.walletOverlaySafe} edges={['top', 'left', 'right', 'bottom']}>
          {walletTopUpOverlay ? (
            <WalletTopUpOverlay
              balance={Number(profile?.walletBalance) || 0}
              returnTo={walletTopUpOverlay.returnTo || 'wallet'}
              onClose={closeWalletTopUpOverlay}
              onContinueReservationAfterTopUp={handleContinueReservationAfterTopUp}
              onOpenWallet={handleOpenWalletFromTopUp}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Bottom nav chỉ ẩn khi overlay phụ hoặc màn nested trong tab. */}
      {!buyerOverlay && !walletTopUpOverlay && !nestedTabState[activeTab] ? (
        <SafeAreaView style={styles.tabBarSafe} edges={['bottom', 'left', 'right']}>
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const iconColor = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
              return (
                <Pressable
                  key={tab.key}
                  style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
                  onPress={() => handleSelectTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                >
                  <TabIcon
                    icon={getTabIconName(tab, isActive)}
                    color={iconColor}
                    badgeCount={getBadgeCount(tab)}
                  />
                  <Text
                    style={[styles.tabLabel, { color: TAB_LABEL_COLOR }, isActive && styles.tabLabelActive]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafb',
  },
  content: {
    flex: 1,
  },
  tabPane: {
    flex: 1,
  },
  tabHidden: {
    display: 'none',
  },
  overlayPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafb',
    zIndex: 20,
    elevation: 20,
  },
  walletOverlayPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafb',
    zIndex: 1000,
    elevation: 1000,
  },
  walletOverlaySafe: {
    flex: 1,
  },
  tabBarSafe: {
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingBottom: 2,
    minHeight: 58,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  iconWrap: {
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeWide: {
    minWidth: 22,
    right: -10,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
