import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { getBuyerConversationsOnBackend } from '../../api/messageApi';
import { getMyNotificationsOnBackend } from '../../api/notificationApi';
import { getSellerConversationsOnBackend } from '../../api/sellerOpsApi';
import { APP_MODE_BUYER, APP_MODE_SELLER, useAppMode } from '../../hooks/useAppMode';
import { useShopPresence } from '../../hooks/useShopPresence';
import { useSellerAccessSync } from '../../hooks/useSellerAccessSync';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectCanSwitchToSeller } from '../../viewmodel/auth/authSelectors';
import { logoutUser } from '../../viewmodel/auth/authSlice';

import ProductsScreen from '../home/ProductsScreen';
import FavoriteProductsScreen from '../buyer/FavoriteProductsScreen';
import InboxScreen from '../inbox/InboxScreen';
import NotificationsScreen from '../inbox/NotificationsScreen';
import MapScreen from '../map/MapScreen';
import ProfilePanel from './ProfilePanel';
import SellerOverviewScreen from '../seller/SellerOverviewScreen';
import SellerProductsTabScreen from '../seller/SellerProductsTabScreen';
import SellerOrdersTabScreen from '../seller/SellerOrdersTabScreen';
import SellerPostTabScreen from '../seller/SellerPostTabScreen';

const ACTIVE_COLOR = '#0F766E';
const INACTIVE_COLOR = '#94A3B8';
const ICON_SIZE = 28;

const BUYER_TABS = [
  { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'products', label: 'Sản phẩm', icon: 'basket-outline', activeIcon: 'basket' },
  { key: 'favorites', label: 'Sản phẩm yêu thích', icon: 'heart-outline', activeIcon: 'heart' },
  { key: 'inbox', label: 'Tin nhắn', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badgeKey: 'messages' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications', badgeKey: 'notifications' },
  { key: 'profile', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

const SELLER_TABS = [
  { key: 'overview', label: 'Tổng quan', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { key: 'products', label: 'Sản phẩm', icon: 'basket-outline', activeIcon: 'basket' },
  { key: 'post', label: 'Đăng tin', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { key: 'orders', label: 'Đơn hàng', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'inbox', label: 'Tin nhắn', icon: 'chatbubble-outline', activeIcon: 'chatbubble', badgeKey: 'messages' },
  { key: 'profile', label: 'Tài khoản', icon: 'person-outline', activeIcon: 'person' },
];

function getTabIconName(tab, isActive) {
  if (isActive && tab.activeIcon) {
    return tab.activeIcon;
  }

  return tab.icon;
}

function TabIcon({ icon, color, showBadge }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={ICON_SIZE} color={color} />
      {showBadge ? <View style={styles.badge} /> : null}
    </View>
  );
}

export default function AuthenticatedHome() {
  const dispatch = useDispatch();
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const { appMode, setAppMode, isReady, isBuyerMode, isSellerMode } = useAppMode(canSwitchToSeller);

  useShopPresence(appMode);

  const tabs = isSellerMode ? SELLER_TABS : BUYER_TABS;
  const [activeTab, setActiveTab] = useState(BUYER_TABS[0].key);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [sellerRegisterRequest, setSellerRegisterRequest] = useState(0);
  const [productDetailId, setProductDetailId] = useState(null);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const [inboxChatRequest, setInboxChatRequest] = useState(null);
  const [openBuyerOrdersRequest, setOpenBuyerOrdersRequest] = useState(0);
  const [nestedTabState, setNestedTabState] = useState({});
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

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

  const loadUnreadBadges = useCallback(async () => {
    try {
      if (isBuyerMode) {
        const [conversations, notifications] = await Promise.all([
          getBuyerConversationsOnBackend(),
          getMyNotificationsOnBackend(),
        ]);

        setHasUnreadMessages(
          (conversations || []).some((item) => Number(item.unreadCount) > 0)
        );
        setHasUnreadNotifications(
          (notifications || []).some((item) => !item.isRead)
        );
        return;
      }

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          return;
        }

        const conversations = await getSellerConversationsOnBackend(idToken);
        setHasUnreadMessages(
          (conversations || []).some((item) => Number(item.unreadCount) > 0)
        );
        setHasUnreadNotifications(false);
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
    setNestedTabState({});
  }, [appMode, isReady, isSellerMode]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    loadUnreadBadges();
    const timer = setInterval(loadUnreadBadges, 30000);
    return () => clearInterval(timer);
  }, [isReady, loadUnreadBadges, activeTab]);

  function shouldShowBadge(tab) {
    if (tab.badgeKey === 'messages') {
      return hasUnreadMessages;
    }
    if (tab.badgeKey === 'notifications') {
      return hasUnreadNotifications;
    }
    return false;
  }

  function handleOpenStoreFromProfile(storeId) {
    setMapFocusRequest({
      storeId: String(storeId),
      at: Date.now(),
    });
    setAppMode(APP_MODE_BUYER);
    setActiveTab('home');
  }

  function handleNavigateToStore({ shopId, storeName }) {
    setMapFocusRequest({
      storeId: String(shopId),
      storeName: storeName || 'Gian hàng',
      showDirections: true,
      at: Date.now(),
    });
    setAppMode(APP_MODE_BUYER);
    setActiveTab('home');
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
    setActiveTab('home');
  }

  function handleClearMapFocus() {
    setMapFocusRequest(null);
  }

  function handlePickupCompleted() {
    setOpenBuyerOrdersRequest(Date.now());
    setActiveTab('profile');
  }

  function handleProductChanged() {
    setProductRefreshKey(Date.now());
  }

  function handleOpenProductDetail(productId) {
    setProductDetailId(productId || null);
    if (productId) {
      setActiveTab('profile');
    }
  }

  function handleStartSellerRegister() {
    setSellerRegisterRequest(Date.now());
    setAppMode(APP_MODE_BUYER);
    setActiveTab('profile');
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
    setActiveTab('inbox');
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

  function handleHomeEditAccount() {
    setProfileNavRequest({ screen: 'edit-account', at: Date.now() });
    setActiveTab('profile');
  }

  function handleHomeSellerAction() {
    if (canSwitchToSeller) {
      handleSwitchToSellerMode();
      return;
    }
    handleStartSellerRegister();
  }

  function handleHomeLogout() {
    dispatch(logoutUser());
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
            onNavigationStateChange={(isNested) => updateNestedTabState('home', isNested)}
            onEditAccount={handleHomeEditAccount}
            onSellerAction={handleHomeSellerAction}
            onLogout={handleHomeLogout}
            isScreenActive={activeTab === 'home'}
          />
        ),
        products: (
          <ProductsScreen
            onNavigationStateChange={(isNested) => updateNestedTabState('products', isNested)}
          />
        ),
        favorites: <FavoriteProductsScreen />,
        notifications: <NotificationsScreen />,
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
            onOpenInbox={() => setActiveTab('inbox')}
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
            profileNavRequest={profileNavRequest}
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
          onOpenProductDetail={handleOpenProductDetail}
        />
      ),
      post: (
        <SellerPostTabScreen
          onProductCreated={handleOpenProductDetail}
          onProductChanged={handleProductChanged}
        />
      ),
      orders: <SellerOrdersTabScreen />,
      inbox: <InboxScreen />,
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
        />
      ),
    };
  }, [
    activeTab,
    handleNavigateToStore,
    handleOpenStoreFromProfile,
    handleSwitchToBuyerMode,
    handleSwitchToSellerMode,
    handleHomeEditAccount,
    handleHomeLogout,
    handleHomeSellerAction,
    isBuyerMode,
    canSwitchToSeller,
    inboxChatRequest,
    mapFocusRequest,
    openBuyerOrdersRequest,
    productDetailId,
    productRefreshKey,
    profileNavRequest,
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
            key={tab.key}
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
                  onPress={() => {
                    setActiveTab(tab.key);
                  }}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                >
                  <TabIcon
                    icon={getTabIconName(tab, isActive)}
                    color={color}
                    showBadge={shouldShowBadge(tab)}
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
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
