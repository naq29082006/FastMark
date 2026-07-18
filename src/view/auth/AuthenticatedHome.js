import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { getBuyerConversationsOnBackend } from '../../api/messageApi';
import { getMyNotificationsOnBackend } from '../../api/notificationApi';
import { APP_MODE_BUYER, useAppMode } from '../../hooks/useAppMode';
import { usePresence } from '../../hooks/usePresence';
import { useShopPresence } from '../../hooks/useShopPresence';
import { useSellerAccessSync } from '../../hooks/useSellerAccessSync';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import {
  selectCanSwitchToSeller,
  selectIsSeller,
} from '../../viewmodel/auth/authSelectors';

import ProductsScreen from '../home/ProductsScreen';
import HomeScreen from '../home/HomeScreen';
import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';
import InboxScreen from '../inbox/InboxScreen';
import NotificationsScreen from '../inbox/NotificationsScreen';
import MapScreen from '../map/MapScreen';
import ProfilePanel from './ProfilePanel';
import ShopTabPanel from '../seller/ShopTabPanel';

const ACTIVE_COLOR = '#076F32';
const INACTIVE_COLOR = '#94A3B8';
const ICON_SIZE = 24;

const TABS = [
  { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'map', label: 'Khám phá', icon: 'compass-outline', activeIcon: 'compass' },
  { key: 'orders', label: 'Đơn hàng', icon: 'receipt-outline', activeIcon: 'receipt' },
  {
    key: 'shop',
    label: 'Gian hàng',
    icon: 'storefront-outline',
    activeIcon: 'storefront',
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
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const isSeller = useSelector(selectIsSeller);
  const canPost = Boolean(canSwitchToSeller && isSeller);
  const { appMode, setAppMode, isReady } = useAppMode(false);

  usePresence(APP_MODE_BUYER);
  useShopPresence(canPost ? 'seller' : APP_MODE_BUYER);

  const tabs = TABS;
  const [activeTab, setActiveTab] = useState('home');
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [productsFocusRequest, setProductsFocusRequest] = useState(null);
  const [sellerRegisterRequest, setSellerRegisterRequest] = useState(0);
  const [productDetailId, setProductDetailId] = useState(null);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const [inboxChatRequest, setInboxChatRequest] = useState(null);
  const [openBuyerOrdersRequest, setOpenBuyerOrdersRequest] = useState(null);
  const [nestedTabState, setNestedTabState] = useState({});
  const [tabInstanceKeys, setTabInstanceKeys] = useState({});
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [buyerOverlay, setBuyerOverlay] = useState(null);
  const [profileNavRequest, setProfileNavRequest] = useState(null);

  const updateNestedTabState = useCallback((tabKey, isNested) => {
    setNestedTabState((current) => {
      const nextValue = Boolean(isNested);
      if (Boolean(current[tabKey]) === nextValue) {
        return current;
      }
      return { ...current, [tabKey]: nextValue };
    });
  }, []);

  const handleSelectTab = useCallback(
    (nextTab) => {
      if (!nextTab || nextTab === activeTab) {
        return;
      }

      const leavingTab = activeTab;

      setTabInstanceKeys((current) => ({
        ...current,
        [leavingTab]: (current[leavingTab] || 0) + 1,
      }));

      setNestedTabState((current) => {
        if (!current[leavingTab]) {
          return current;
        }
        return { ...current, [leavingTab]: false };
      });

      if (leavingTab === 'profile') {
        setProductDetailId(null);
        setProfileNavRequest(null);
      }
      if (leavingTab === 'map') {
        setMapFocusRequest(null);
      }

      setBuyerOverlay(null);
      setActiveTab(nextTab);
    },
    [activeTab]
  );

  const loadUnreadBadges = useCallback(async () => {
    try {
      const [conversations, notifications] = await Promise.all([
        getBuyerConversationsOnBackend(),
        getMyNotificationsOnBackend('buyer'),
      ]);

      const messageCount = (conversations || []).filter(
        (item) => Math.max(0, Number(item.unreadCount) || 0) > 0
      ).length;
      const notificationCount = (notifications || []).filter((item) => !item.isRead).length;

      setUnreadMessagesCount(messageCount);
      setUnreadNotificationsCount(notificationCount);
    } catch {
      // Keep the previous badge state on transient failures.
    }
  }, []);

  useSellerAccessSync({
    enabled: true,
  });

  useEffect(() => {
    if (!isReady) {
      return;
    }
    setAppMode(APP_MODE_BUYER);
  }, [isReady, setAppMode]);

  useEffect(() => {
    if (activeTab === 'post') {
      setActiveTab('shop');
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'favorites' || activeTab === 'products') {
      setActiveTab('orders');
    }
    if (activeTab === 'notifications') {
      setActiveTab('home');
      setBuyerOverlay('notifications');
    }
    if (activeTab === 'inbox') {
      setActiveTab('home');
      setBuyerOverlay('inbox');
    }
    if (activeTab === 'overview') {
      setActiveTab('home');
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    loadUnreadBadges();
    const timer = setInterval(loadUnreadBadges, 30000);
    return () => clearInterval(timer);
  }, [isReady, loadUnreadBadges, activeTab]);

  function getBadgeCount(tab) {
    if (tab.badgeKey === 'messages') {
      return unreadMessagesCount;
    }
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
    handleSelectTab('map');
  }

  function handleNavigateToStore({ shopId, storeName }) {
    setMapFocusRequest({
      storeId: String(shopId),
      storeName: storeName || 'Gian hàng',
      showDirections: true,
      at: Date.now(),
    });
    handleSelectTab('map');
  }

  function handleNavigatePickup({ shopId, reservationId, storeName }) {
    setMapFocusRequest({
      storeId: String(shopId),
      reservationId,
      storeName,
      showDirections: true,
      at: Date.now(),
    });
    handleSelectTab('map');
  }

  function handleOpenProductsFromHome(options = {}) {
    setProductsFocusRequest({
      ...options,
      at: Date.now(),
    });
    setBuyerOverlay('products');
  }

  function handleOpenMapFromHome() {
    handleSelectTab('map');
  }

  function handleOpenNotificationsFromHome() {
    setBuyerOverlay('notifications');
  }

  function handleOpenInbox() {
    setBuyerOverlay('inbox');
  }

  function handleCloseBuyerOverlay() {
    setBuyerOverlay(null);
    setInboxChatRequest(null);
  }

  function handleClearMapFocus() {
    setMapFocusRequest(null);
  }

  function handleOpenBuyerOrders(tab = RESERVATION_TAB.HOLDING) {
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

  function handleOpenChat({ shopId, shopName }) {
    if (!shopId) {
      return;
    }
    setInboxChatRequest({
      shopId: String(shopId),
      shopName: shopName || 'Gian hàng',
      at: Date.now(),
    });
    setBuyerOverlay('inbox');
  }

  function handleOpenProfileNav(screen) {
    setProfileNavRequest({ screen, at: Date.now() });
    handleSelectTab('profile');
  }

  const tabPanes = useMemo(
    () => ({
      home: (
        <HomeScreen
          unreadNotificationsCount={unreadNotificationsCount}
          unreadMessagesCount={unreadMessagesCount}
          onOpenMap={handleOpenMapFromHome}
          onOpenProducts={handleOpenProductsFromHome}
          onOpenNotifications={handleOpenNotificationsFromHome}
          onOpenInbox={handleOpenInbox}
          onOpenBuyerOrders={handleOpenBuyerOrders}
          onEditAccount={() => handleOpenProfileNav('edit-account')}
          onStartSellerRegister={handleStartSellerRegister}
          onOpenShop={handleOpenShopNav}
          onNavigationStateChange={(isNested) => updateNestedTabState('home', isNested)}
        />
      ),
      map: (
        <MapScreen
          focusStoreRequest={mapFocusRequest}
          onOpenChat={handleOpenChat}
          onClearFocus={handleClearMapFocus}
          onPickupCompleted={handlePickupCompleted}
          onOpenBuyerOrders={handleOpenBuyerOrders}
          onNavigationStateChange={(isNested) => updateNestedTabState('map', isNested)}
          isScreenActive={activeTab === 'map'}
        />
      ),
      orders: (
        <BuyerOrdersScreen
          embedded
          initialTab={openBuyerOrdersRequest?.tab || RESERVATION_TAB.HOLDING}
          tabRequestKey={openBuyerOrdersRequest?.at || 0}
          onNavigatePickup={handleNavigatePickup}
          onOpenStore={handleOpenStoreFromProfile}
          onNavigationStateChange={(isNested) => updateNestedTabState('orders', isNested)}
        />
      ),
      shop: (
        <ShopTabPanel
          isVisible={activeTab === 'shop'}
          sellerRegisterRequest={sellerRegisterRequest}
          productRefreshKey={productRefreshKey}
          onProductChanged={handleProductChanged}
          onNavigationStateChange={(isNested) => updateNestedTabState('shop', isNested)}
        />
      ),
      profile: (
        <ProfilePanel
          profileMode="buyer"
          showSellerHub={false}
          onOpenStore={handleOpenStoreFromProfile}
          onNavigateToStore={handleNavigateToStore}
          onOpenInbox={handleOpenInbox}
          onNavigatePickup={handleNavigatePickup}
          openBuyerOrdersRequest={openBuyerOrdersRequest}
          isProfileVisible={activeTab === 'profile'}
          productDetailId={productDetailId}
          productRefreshKey={productRefreshKey}
          onOpenProductDetail={handleOpenProductDetail}
          onProductChanged={handleProductChanged}
          canSwitchToSeller={canSwitchToSeller}
          profileNavRequest={profileNavRequest}
          onStartSellerRegister={handleStartSellerRegister}
          onOpenShopTab={handleOpenShopNav}
          onNavigationStateChange={(isNested) => updateNestedTabState('profile', isNested)}
        />
      ),
    }),
    [
      activeTab,
      canSwitchToSeller,
      mapFocusRequest,
      openBuyerOrdersRequest,
      productDetailId,
      productRefreshKey,
      profileNavRequest,
      sellerRegisterRequest,
      unreadMessagesCount,
      unreadNotificationsCount,
      updateNestedTabState,
    ]
  );

  if (!isReady) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.content} edges={['top', 'left', 'right']}>
        {tabs.map((tab) => (
          <View
            key={`${tab.key}-${tabInstanceKeys[tab.key] || 0}`}
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
              onBack={handleCloseBuyerOverlay}
              onNavigationStateChange={(isNested) => updateNestedTabState('home', isNested)}
            />
          </View>
        ) : null}
        {buyerOverlay === 'notifications' ? (
          <View style={styles.overlayPane}>
            <NotificationsScreen audience="buyer" onBack={handleCloseBuyerOverlay} />
          </View>
        ) : null}
        {buyerOverlay === 'inbox' ? (
          <View style={styles.overlayPane}>
            <InboxScreen
              buyerView
              messagesOnly
              chatRequest={inboxChatRequest}
              onViewShop={handleOpenStoreFromProfile}
              onBack={handleCloseBuyerOverlay}
            />
          </View>
        ) : null}
      </SafeAreaView>

      {!nestedTabState[activeTab] && !buyerOverlay ? (
        <SafeAreaView style={styles.tabBarSafe} edges={['bottom', 'left', 'right']}>
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

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
                    color={color}
                    badgeCount={getBadgeCount(tab)}
                  />
                  <Text
                    style={[styles.tabLabel, { color }, isActive && styles.tabLabelActive]}
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
