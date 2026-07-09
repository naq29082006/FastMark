import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { syncSellerAccess } from '../../viewmodel/auth/authSlice';
import { useSellerAccessSync } from '../../hooks/useSellerAccessSync';

import InboxScreen from '../inbox/InboxScreen';
import PostScreen from '../home/PostScreen';
import ProductsScreen from '../home/ProductsScreen';
import MapScreen from '../map/MapScreen';
import {
  ChatTabIcon,
  CompassTabIcon,
  HomeTabIcon,
  PersonTabIcon,
  PlusTabIcon,
} from '../shared/components/TabBarIcons';
import ProfilePanel from './ProfilePanel';

const ACTIVE_COLOR = '#3a7d74';
const INACTIVE_COLOR = '#9aa8b2';

const TABS = [
  { key: 'home', label: 'Trang chủ', Icon: HomeTabIcon },
  { key: 'products', label: 'Sản phẩm', Icon: CompassTabIcon },
  { key: 'post', label: 'Đăng tin', Icon: PlusTabIcon, highlight: true },
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
  const size = tab.highlight ? 28 : 24;

  return (
    <View style={styles.iconWrap}>
      <IconComponent color={color} size={size} filled={isActive && !tab.highlight} />
      {tab.badge ? <View style={styles.badge} /> : null}
    </View>
  );
}

export default function AuthenticatedHome() {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('home');
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

  function handleOpenStoreFromProfile(storeId) {
    setMapFocusRequest({
      storeId: String(storeId),
      at: Date.now(),
    });
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
    setActiveTab('profile');
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View style={[styles.tabPane, activeTab !== 'home' && styles.tabHidden]}>
          <MapScreen focusStoreRequest={mapFocusRequest} />
        </View>
        <View style={[styles.tabPane, activeTab !== 'products' && styles.tabHidden]}>
          <ProductsScreen />
        </View>
        <View style={[styles.tabPane, activeTab !== 'post' && styles.tabHidden]}>
          <PostScreen
            onStartSellerRegister={handleStartSellerRegister}
            onProductCreated={handleOpenProductDetail}
          />
        </View>
        <View style={[styles.tabPane, activeTab !== 'inbox' && styles.tabHidden]}>
          <InboxScreen />
        </View>
        <View style={[styles.tabPane, activeTab !== 'profile' && styles.tabHidden]}>
          <ProfilePanel
            onOpenStore={handleOpenStoreFromProfile}
            sellerRegisterRequest={sellerRegisterRequest}
            isProfileVisible={activeTab === 'profile'}
            productDetailId={productDetailId}
            productRefreshKey={productRefreshKey}
            onOpenProductDetail={handleOpenProductDetail}
            onProductChanged={handleProductChanged}
          />
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const color = getTabColor(tab, isActive);

          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
              onPress={() => {
                if (tab.key === 'post' || tab.key === 'profile') {
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
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 56,
  },
  tabItemPressed: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
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
