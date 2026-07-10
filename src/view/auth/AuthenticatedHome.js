import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { APP_MODE_BUYER, APP_MODE_SELLER, useAppMode } from '../../hooks/useAppMode';
import { useSellerAccessSync } from '../../hooks/useSellerAccessSync';
import { selectIsSeller } from '../../viewmodel/auth/authSelectors';
import { syncSellerAccess } from '../../viewmodel/auth/authSlice';

import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';
import SearchScreen from '../buyer/SearchScreen';
import ProductsScreen from '../home/ProductsScreen';
import InboxScreen from '../inbox/InboxScreen';
import MapScreen from '../map/MapScreen';
import ProfilePanel from './ProfilePanel';
import SellerOverviewScreen from '../seller/SellerOverviewScreen';
import SellerProductsTabScreen from '../seller/SellerProductsTabScreen';
import SellerOrdersTabScreen from '../seller/SellerOrdersTabScreen';
import {
  BagTabIcon,
  ChartTabIcon,
  ChatTabIcon,
  HomeTabIcon,
  OrdersTabIcon,
  PersonTabIcon,
  SearchTabIcon,
  PlusTabIcon,
} from '../shared/components/TabBarIcons';
import SellerPostTabScreen from '../seller/SellerPostTabScreen';

const ACTIVE_COLOR = '#3a7d74';
const INACTIVE_COLOR = '#9aa8b2';

const BUYER_TABS = [
  { key: 'home', label: 'Trang chủ', Icon: HomeTabIcon },
  { key: 'search', label: 'Tìm kiếm', Icon: SearchTabIcon },
  { key: 'products', label: 'Sản phẩm', Icon: BagTabIcon },
  { key: 'orders', label: 'Đơn hàng', Icon: OrdersTabIcon },
  { key: 'inbox', label: 'Inbox', Icon: ChatTabIcon, badge: true },
  { key: 'profile', label: 'Tài khoản', Icon: PersonTabIcon },
];

const SELLER_TABS = [
  { key: 'overview', label: 'Tổng quan', Icon: ChartTabIcon },
  { key: 'products', label: 'Sản phẩm', Icon: BagTabIcon },
  { key: 'post', label: 'Đăng tin', Icon: PlusTabIcon, highlight: true },
  { key: 'orders', label: 'Đơn hàng', Icon: OrdersTabIcon },
  { key: 'inbox', label: 'Inbox', Icon: ChatTabIcon, badge: true },
  { key: 'profile', label: 'Tài khoản', Icon: PersonTabIcon },
];

function getTabColor(tab, isActive) {
  if (tab.highlight) {
    return ACTIVE_COLOR;
  }

  return isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
}

function TabIcon({ tab, isActive, color }) {
  const IconComponent = tab.Icon;
  const size = tab.highlight ? 26 : 22;

  return (
    <View style={styles.iconWrap}>
      <IconComponent color={color} size={size} filled={isActive && !tab.highlight} />
      {tab.badge ? <View style={styles.badge} /> : null}
    </View>
  );
}

export default function AuthenticatedHome() {
  const dispatch = useDispatch();
  const isSeller = useSelector(selectIsSeller);
  const { appMode, setAppMode, isReady, isBuyerMode, isSellerMode } = useAppMode(isSeller);

  const tabs = isSellerMode ? SELLER_TABS : BUYER_TABS;
  const [activeTab, setActiveTab] = useState(BUYER_TABS[0].key);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [sellerRegisterRequest, setSellerRegisterRequest] = useState(0);
  const [productDetailId, setProductDetailId] = useState(null);
  const [productRefreshKey, setProductRefreshKey] = useState(0);

  useSellerAccessSync({
    enabled: true,
    pollIntervalMs: 5000,
  });

  useEffect(() => {
    dispatch(syncSellerAccess());
  }, [dispatch]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const defaultTab = isSellerMode ? SELLER_TABS[0].key : BUYER_TABS[0].key;
    setActiveTab(defaultTab);
    setProductDetailId(null);
  }, [appMode, isReady, isSellerMode]);

  const profileMode = isSellerMode ? 'seller' : 'buyer';

  function handleOpenStoreFromProfile(storeId) {
    setMapFocusRequest({
      storeId: String(storeId),
      at: Date.now(),
    });
    setAppMode(APP_MODE_BUYER);
    setActiveTab('home');
  }

  function handleSearchSelect(result) {
    if (!result?.latitude || !result?.longitude) {
      return;
    }

    setMapFocusRequest({
      location: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
      at: Date.now(),
    });
    setAppMode(APP_MODE_BUYER);
    setActiveTab('home');
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

  async function handleSwitchToSellerMode() {
    if (!isSeller) {
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
        home: <MapScreen focusStoreRequest={mapFocusRequest} />,
        search: <SearchScreen onSelectLocation={handleSearchSelect} />,
        products: <ProductsScreen />,
        orders: <BuyerOrdersScreen onOpenStore={handleOpenStoreFromProfile} />,
        inbox: <InboxScreen buyerView />,
        profile: (
          <ProfilePanel
            profileMode="buyer"
            onOpenStore={handleOpenStoreFromProfile}
            sellerRegisterRequest={sellerRegisterRequest}
            isProfileVisible={activeTab === 'profile'}
            productDetailId={productDetailId}
            productRefreshKey={productRefreshKey}
            onOpenProductDetail={handleOpenProductDetail}
            onProductChanged={handleProductChanged}
            onSwitchToSellerMode={handleSwitchToSellerMode}
            canSwitchToSeller={isSeller}
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
    handleOpenStoreFromProfile,
    handleSearchSelect,
    handleSwitchToBuyerMode,
    handleSwitchToSellerMode,
    isBuyerMode,
    isSeller,
    mapFocusRequest,
    productDetailId,
    productRefreshKey,
    sellerRegisterRequest,
  ]);

  if (!isReady) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tabs.map((tab) => (
          <View
            key={tab.key}
            style={[styles.tabPane, activeTab !== tab.key && styles.tabHidden]}
          >
            {tabPanes[tab.key]}
          </View>
        ))}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const color = getTabColor(tab, isActive);

          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
              onPress={() => {
                if (tab.key === 'profile' || tab.key === 'products' || tab.key === 'post') {
                  dispatch(syncSellerAccess());
                }
                setActiveTab(tab.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <TabIcon tab={tab} isActive={isActive} color={color} />
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d7e0e6',
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 52,
  },
  tabItemPressed: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#e53935',
  },
});
