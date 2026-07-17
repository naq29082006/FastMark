import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { getBuyerConversationsOnBackend } from '../../api/messageApi';
import { getMyNotificationsOnBackend } from '../../api/notificationApi';
import { getSellerConversationsOnBackend } from '../../api/sellerOpsApi';
import { APP_MODE_BUYER, APP_MODE_SELLER, useAppMode } from '../../hooks/useAppMode';
import { usePresence } from '../../hooks/usePresence';
import { useShopPresence } from '../../hooks/useShopPresence';
import { useSellerAccessSync } from '../../hooks/useSellerAccessSync';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectCanSwitchToSeller } from '../../viewmodel/auth/authSelectors';

import ProductsScreen from '../home/ProductsScreen';
import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';
import InboxScreen from '../inbox/InboxScreen';
import NotificationsScreen from '../inbox/NotificationsScreen';
import MapScreen from '../map/MapScreen';
import ProfilePanel from './ProfilePanel';
import SellerOverviewScreen from '../seller/SellerOverviewScreen';
import SellerProductsTabScreen from '../seller/SellerProductsTabScreen';
import SellerOrdersTabScreen from '../seller/SellerOrdersTabScreen';

const ACTIVE_COLOR = '#0F766E';
const INACTIVE_COLOR = '#94A3B8';
const ICON_SIZE = 28;

const BUYER_TABS = [
  { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'products', label: 'Sản phẩm', icon: 'basket-outline', activeIcon: 'basket' },
  { key: 'orders', label: 'Quản lý đơn hàng', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'inbox', label: 'Tin nhắn', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badgeKey: 'messages' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications', badgeKey: 'notifications' },
  { key: 'profile', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

const SELLER_TABS = [
  { key: 'overview', label: 'Thống kê', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { key: 'products', label: 'Quản lý sản phẩm', icon: 'cube-outline', activeIcon: 'cube' },
  { key: 'orders', label: 'Quản lý đơn hàng', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'inbox', label: 'Tin nhắn', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badgeKey: 'messages' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications', badgeKey: 'notifications' },
  { key: 'profile', label: 'Tài khoản của tôi', icon: 'person-outline', activeIcon: 'person' },
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
  const { appMode, setAppMode, isReady, isBuyerMode, isSellerMode } = useAppMode(canSwitchToSeller);

  usePresence(appMode);
  useShopPresence(appMode);

  const tabs = isSellerMode ? SELLER_TABS : BUYER_TABS;
  const [activeTab, setActiveTab] = useState(BUYER_TABS[0].key);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [sellerRegisterRequest, setSellerRegisterRequest] = useState(0);
  const [productDetailId, setProductDetailId] = useState(null);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const [inboxChatRequest, setInboxChatRequest] = useState(null);
  const [openBuyerOrdersRequest, setOpenBuyerOrdersRequest] = useState(null);
  const [nestedTabState, setNestedTabState] = useState({});
  const [tabInstanceKeys, setTabInstanceKeys] = useState({});
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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
      }
      if (leavingTab === 'inbox') {
        setInboxChatRequest(null);
      }
      if (leavingTab === 'home') {
        setMapFocusRequest(null);
      }

      setActiveTab(nextTab);
    },
    [activeTab]
  );

  const loadUnreadBadges = useCallback(async () => {
    try {
      if (isBuyerMode) {
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
        return;
      }

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          return;
        }

        const [conversations, notifications] = await Promise.all([
          getSellerConversationsOnBackend(idToken),
          getMyNotificationsOnBackend('seller'),
        ]);
        const messageCount = (conversations || []).filter(
          (item) => Math.max(0, Number(item.unreadCount) || 0) > 0
        ).length;
        const notificationCount = (notifications || []).filter((item) => !item.isRead).length;
        setUnreadMessagesCount(messageCount);
        setUnreadNotificationsCount(notificationCount);
      }
    } catch {
      // Keep the previous badge state on transient failures.
    }
  }, [isBuyerMode, isSellerMode]);

  useSellerAccessSync({
    enabled: true,
  });

  const previousAppModeRef = useRef(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (previousAppModeRef.current === appMode) {
      return;
    }

    previousAppModeRef.current = appMode;
    const defaultTab = isSellerMode ? SELLER_TABS[0].key : BUYER_TABS[0].key;
    setActiveTab(defaultTab);
    setProductDetailId(null);
    setInboxChatRequest(null);
    setMapFocusRequest(null);
    setNestedTabState({});
    setTabInstanceKeys({});
  }, [appMode, isReady, isSellerMode]);

  // Tab cũ "favorites" đã đổi thành "orders" — tránh crash nếu state còn tab cũ.
  useEffect(() => {
    if (isBuyerMode && activeTab === 'favorites') {
      setActiveTab('orders');
    }
  }, [isBuyerMode, activeTab]);

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
    setAppMode(APP_MODE_BUYER);
    handleSelectTab('home');
  }

  function handleNavigateToStore({ shopId, storeName }) {
    setMapFocusRequest({
      storeId: String(shopId),
      storeName: storeName || 'Gian hàng',
      showDirections: true,
      at: Date.now(),
    });
    setAppMode(APP_MODE_BUYER);
    handleSelectTab('home');
  }

  function handleNavigatePickup({ shopId, reservationId, storeName }) {
    setMapFocusRequest({
      storeId: String(shopId),
      reservationId,
      storeName,
      showDirections: true,
      at: Date.now(),
    });
    setAppMode(APP_MODE_BUYER);
    handleSelectTab('home');
  }

  function handleClearMapFocus() {
    setMapFocusRequest(null);
  }

  function handleOpenBuyerOrders(tab = RESERVATION_TAB.HOLDING) {
    setOpenBuyerOrdersRequest({ at: Date.now(), tab });
    setAppMode(APP_MODE_BUYER);
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
    if (productId && isBuyerMode) {
      handleSelectTab('profile');
    }
  }

  function handleStartSellerRegister() {
    setSellerRegisterRequest(Date.now());
    setAppMode(APP_MODE_BUYER);
    handleSelectTab('profile');
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
    handleSelectTab('inbox');
  }

  async function handleSwitchToSellerMode() {
    if (!canSwitchToSeller) {
      handleStartSellerRegister();
      return;
    }
    await setAppMode(APP_MODE_SELLER);
  }

  async function handleSwitchToBuyerMode() {
    await setAppMode(APP_MODE_BUYER);
  }

  const tabPanes = useMemo(() => {
    if (isBuyerMode) {
      return {
        home: (
          <MapScreen
            focusStoreRequest={mapFocusRequest}
            onOpenChat={handleOpenChat}
            onClearFocus={handleClearMapFocus}
            onPickupCompleted={handlePickupCompleted}
            onOpenBuyerOrders={handleOpenBuyerOrders}
            onNavigationStateChange={(isNested) => updateNestedTabState('home', isNested)}
            isScreenActive={activeTab === 'home'}
          />
        ),
        products: (
          <ProductsScreen
            onOpenBuyerOrders={handleOpenBuyerOrders}
            onNavigationStateChange={(isNested) => updateNestedTabState('products', isNested)}
          />
        ),
        orders: (
          <BuyerOrdersScreen
            embedded
            initialTab={
              openBuyerOrdersRequest?.tab || RESERVATION_TAB.HOLDING
            }
            tabRequestKey={openBuyerOrdersRequest?.at || 0}
            onNavigatePickup={handleNavigatePickup}
            onOpenStore={handleOpenStoreFromProfile}
            onNavigationStateChange={(isNested) => updateNestedTabState('orders', isNested)}
          />
        ),
        notifications: <NotificationsScreen audience="buyer" />,
        inbox: (
          <InboxScreen
            buyerView
            chatRequest={inboxChatRequest}
            onViewShop={handleOpenStoreFromProfile}
            onNavigationStateChange={(isNested) => updateNestedTabState('inbox', isNested)}
          />
        ),
        profile: (
          <ProfilePanel
            profileMode="buyer"
            onOpenStore={handleOpenStoreFromProfile}
            onNavigateToStore={handleNavigateToStore}
            onOpenInbox={() => handleSelectTab('inbox')}
            onNavigatePickup={handleNavigatePickup}
            openBuyerOrdersRequest={openBuyerOrdersRequest}
            sellerRegisterRequest={sellerRegisterRequest}
            isProfileVisible={activeTab === 'profile'}
            productDetailId={productDetailId}
            productRefreshKey={productRefreshKey}
            onOpenProductDetail={handleOpenProductDetail}
            onProductChanged={handleProductChanged}
            onSwitchToSellerMode={handleSwitchToSellerMode}
            canSwitchToSeller={canSwitchToSeller}
            onNavigationStateChange={(isNested) => updateNestedTabState('profile', isNested)}
          />
        ),
      };
    }

    return {
      overview: <SellerOverviewScreen />,
      products: (
        <SellerProductsTabScreen
          productRefreshKey={productRefreshKey}
          onProductChanged={handleProductChanged}
          onNavigationStateChange={(isNested) => updateNestedTabState('products', isNested)}
        />
      ),
      orders: (
        <SellerOrdersTabScreen
          onNavigationStateChange={(isNested) => updateNestedTabState('orders', isNested)}
        />
      ),
      inbox: (
        <InboxScreen
          messagesOnly
          onViewShop={handleOpenStoreFromProfile}
          onNavigationStateChange={(isNested) => updateNestedTabState('inbox', isNested)}
        />
      ),
      notifications: (
        <NotificationsScreen
          audience="seller"
          onNavigationStateChange={(isNested) => updateNestedTabState('notifications', isNested)}
        />
      ),
      profile: (
        <ProfilePanel
          profileMode="seller"
          onOpenStore={handleOpenStoreFromProfile}
          onNavigateToStore={handleNavigateToStore}
          sellerRegisterRequest={sellerRegisterRequest}
          isProfileVisible={activeTab === 'profile'}
          productDetailId={productDetailId}
          productRefreshKey={productRefreshKey}
          onOpenProductDetail={handleOpenProductDetail}
          onProductChanged={handleProductChanged}
          onSwitchToBuyerMode={handleSwitchToBuyerMode}
          onNavigationStateChange={(isNested) => updateNestedTabState('profile', isNested)}
        />
      ),
    };
  }, [
    activeTab,
    handleNavigateToStore,
    handleOpenStoreFromProfile,
    handleSwitchToBuyerMode,
    handleSwitchToSellerMode,
    isBuyerMode,
    canSwitchToSeller,
    inboxChatRequest,
    mapFocusRequest,
    openBuyerOrdersRequest,
    productDetailId,
    productRefreshKey,
    sellerRegisterRequest,
    activeTab,
    updateNestedTabState,
  ]);

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
      </SafeAreaView>

      {!nestedTabState[activeTab] ? (
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
  tabBarSafe: {
    backgroundColor: '#ffffff',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: ICON_SIZE + 8,
    height: ICON_SIZE + 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeWide: {
    minWidth: 22,
    right: -10,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
