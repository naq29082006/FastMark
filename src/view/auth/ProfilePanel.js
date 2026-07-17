import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthProfile,
  selectAuthUser,
  selectIsSeller,
} from '../../viewmodel/auth/authSelectors';
import {
  applyShopSettingsToProfile,
  loadUserProfile,
  logoutUser,
  syncSellerAccess,
} from '../../viewmodel/auth/authSlice';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import AccountProfileScreen from '../profile/AccountProfileScreen';
import EditAccountScreen from '../profile/EditAccountScreen';
import FollowConnectionsScreen from '../profile/FollowConnectionsScreen';
import MyActivityScreen from '../profile/MyActivityScreen';
import NotificationSettingsScreen from '../profile/NotificationSettingsScreen';
import PurchasedProductsScreen from '../profile/PurchasedProductsScreen';
import ReservationHistoryScreen from '../profile/ReservationHistoryScreen';
import VisitedStoresScreen from '../profile/VisitedStoresScreen';
import SellerPhoneSetupScreen from '../seller/SellerPhoneSetupScreen';
import SellerRegistrationScreen from '../seller/SellerRegistrationScreen';
import SellerVerificationStatusScreen from '../seller/SellerVerificationStatusScreen';
import SellerProductDetailScreen from '../seller/SellerProductDetailScreen';
import ProductDetailScreen from '../store/ProductDetailScreen';
import SellerShopSettingsScreen from '../seller/SellerShopSettingsScreen';
import SellerReviewsManageScreen from '../seller/SellerReviewsManageScreen';
import SellerOrdersScreen from '../seller/SellerOrdersScreen';
import SellerOrderDetailScreen from '../seller/SellerOrderDetailScreen';
import SellerStatsScreen from '../seller/SellerStatsScreen';
import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';
import FavoriteProductsScreen from '../buyer/FavoriteProductsScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import { getSellerRegistrationStep } from '../seller/sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import { RESERVATION_TAB } from '../../constants/sellerOrders';

export default function ProfilePanel({
  profileMode = 'buyer',
  onOpenStore,
  onNavigateToStore,
  onOpenInbox,
  onNavigatePickup,
  openBuyerOrdersRequest = null,
  sellerRegisterRequest = 0,
  isProfileVisible = false,
  productDetailId = null,
  productRefreshKey = 0,
  onOpenProductDetail,
  onProductChanged,
  onSwitchToSellerMode,
  onSwitchToBuyerMode,
  canSwitchToSeller = false,
  profileNavRequest = null,
  onNavigationStateChange,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const isSeller = useSelector(selectIsSeller);
  const [profileNav, setProfileNav] = useState(null);
  const [followConnectionsTab, setFollowConnectionsTab] = useState('following');
  const [sellerStep, setSellerStep] = useState(null);
  const [sellerVerification, setSellerVerification] = useState(null);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [phoneChangeReturn, setPhoneChangeReturn] = useState(null);
  const [shopContactRefreshKey, setShopContactRefreshKey] = useState(0);
  const [shopSettings, setShopSettings] = useState(null);
  const [buyerOrdersTab, setBuyerOrdersTab] = useState(RESERVATION_TAB.HOLDING);
  const [buyerOrdersTabKey, setBuyerOrdersTabKey] = useState(0);
  const [productStoreId, setProductStoreId] = useState(null);

  const loadShopSettings = useCallback(async () => {
    if (!isProfileVisible || !isSeller) {
      return;
    }

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }

      const shop = await getSellerShopSettingsOnBackend(idToken);
      setShopSettings(shop);
      dispatch(applyShopSettingsToProfile(shop));
    } catch {
      // Keep the last known shop settings on transient failures.
    }
  }, [dispatch, isProfileVisible, isSeller]);

  useEffect(() => {
    loadShopSettings();
  }, [loadShopSettings, shopContactRefreshKey]);

  useEffect(() => {
    if (!user) {
      return;
    }
    // Luôn refresh khi mở lại tab Tài khoản để số follow/following mới nhất.
    if (isProfileVisible) {
      dispatch(loadUserProfile());
    }
  }, [dispatch, user, isProfileVisible]);

  async function startSellerRegistration() {
    if (canSwitchToSeller) {
      return;
    }

    try {
      const result = await dispatch(syncSellerAccess()).unwrap();
      const latestProfile = result?.profile || profile;
      const verification = result?.verification || null;
      const nextStep = getSellerRegistrationStep(latestProfile, verification);
      setSellerVerification(verification);
      setSellerStep(nextStep);
    } catch {
      const nextStep = getSellerRegistrationStep(profile, null);
      setSellerVerification(null);
      setSellerStep(nextStep);
    }
  }

  useEffect(() => {
    if (!sellerRegisterRequest) {
      return;
    }
    startSellerRegistration();
  }, [sellerRegisterRequest]);

  useEffect(() => {
    if (!openBuyerOrdersRequest || profileMode !== 'buyer') {
      return;
    }
    const tab =
      typeof openBuyerOrdersRequest === 'object' && openBuyerOrdersRequest.tab
        ? openBuyerOrdersRequest.tab
        : RESERVATION_TAB.HOLDING;
    const key =
      typeof openBuyerOrdersRequest === 'object' && openBuyerOrdersRequest.at
        ? openBuyerOrdersRequest.at
        : openBuyerOrdersRequest;
    setBuyerOrdersTab(tab);
    setBuyerOrdersTabKey(key);
    setProfileNav('buyer-orders');
  }, [openBuyerOrdersRequest, profileMode]);

  useEffect(() => {
    if (!profileNavRequest?.screen) {
      return;
    }
    setProfileNav(profileNavRequest.screen);
  }, [profileNavRequest]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(sellerStep || profileNav || productDetailId));
  }, [onNavigationStateChange, productDetailId, profileNav, sellerStep]);

  useEffect(() => {
    if (!productDetailId) {
      setProductStoreId(null);
    }
  }, [productDetailId]);

  const openBuyerPreview = useCallback(async () => {
    let shop = shopSettings;

    if (!shop?.id && !shop?.shopId) {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          throw new Error('Phiên đăng nhập đã hết hạn.');
        }

        shop = await getSellerShopSettingsOnBackend(idToken);
        setShopSettings(shop);
        dispatch(applyShopSettingsToProfile(shop));
      } catch (error) {
        Alert.alert('Không mở được chế độ xem', error.message || 'Vui lòng thử lại sau.');
        return;
      }
    }

    const storeId = shop?.id || shop?.shopId;
    if (!storeId) {
      Alert.alert('Không mở được chế độ xem', 'Chưa tìm thấy cửa hàng của bạn.');
      return;
    }

    setProfileNav('buyer-preview');
  }, [dispatch, shopSettings]);

  if (sellerStep === 'phone') {
    return (
      <SellerPhoneSetupScreen
        mode={phoneChangeReturn ? 'change' : 'register'}
        onBack={() => {
          const returnNav = phoneChangeReturn;
          setPhoneChangeReturn(null);
          setSellerStep(null);
          if (returnNav) {
            setProfileNav(returnNav);
          }
        }}
        onVerified={async () => {
          if (phoneChangeReturn) {
            await dispatch(syncSellerAccess());
            const returnNav = phoneChangeReturn;
            setPhoneChangeReturn(null);
            setSellerStep(null);
            setShopContactRefreshKey((value) => value + 1);
            setProfileNav(returnNav);
            return;
          }
          try {
            const result = await dispatch(syncSellerAccess()).unwrap();
            setSellerVerification(result?.verification || null);
          } catch {
            setSellerVerification(null);
          }
          setSellerStep('register');
        }}
      />
    );
  }

  if (sellerStep === 'pending') {
    return (
      <SellerVerificationStatusScreen
        verification={sellerVerification}
        onBack={() => setSellerStep(null)}
        onEdit={() => setSellerStep('register')}
      />
    );
  }

  if (sellerStep === 'register') {
    return (
      <SellerRegistrationScreen
        initialVerification={sellerVerification}
        onBack={() => {
          if (
            sellerVerification?.status === SELLER_VERIFICATION_STATUS.PENDING ||
            sellerVerification?.status === SELLER_VERIFICATION_STATUS.REJECTED
          ) {
            setSellerStep('pending');
            return;
          }
          setSellerStep(null);
        }}
        onSubmitted={async (verification) => {
          let latestVerification = verification || sellerVerification;

          try {
            const result = await dispatch(syncSellerAccess()).unwrap();
            latestVerification = verification || result?.verification || sellerVerification;
          } catch {
            // Giữ verification từ response submit nếu sync thất bại tạm thời.
          }

          setSellerVerification(latestVerification);
          setSellerStep('pending');
        }}
      />
    );
  }

  if (profileNav === 'seller-shop-settings') {
    return (
      <SellerShopSettingsScreen
        onBack={() => {
          setShopContactRefreshKey((value) => value + 1);
          setProfileNav(null);
        }}
        onSaved={(shop) => {
          if (shop) {
            setShopSettings(shop);
          }
          setShopContactRefreshKey((value) => value + 1);
        }}
        onChangePhone={() => {
          setPhoneChangeReturn('seller-shop-settings');
          setProfileNav(null);
          setSellerStep('phone');
        }}
      />
    );
  }

  if (profileNav === 'seller-reviews') {
    return <SellerReviewsManageScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'seller-orders') {
    return (
      <SellerOrdersScreen
        onBack={() => setProfileNav(null)}
        onRefreshKey={ordersRefreshKey}
        onOpenReservation={(reservationId) => {
          setSelectedReservationId(reservationId);
          setProfileNav('seller-order-detail');
        }}
      />
    );
  }

  if (profileNav === 'seller-order-detail' && selectedReservationId) {
    return (
      <SellerOrderDetailScreen
        reservationId={selectedReservationId}
        onBack={() => setProfileNav('seller-orders')}
        onChanged={() => setOrdersRefreshKey((value) => value + 1)}
      />
    );
  }

  if (profileNav === 'seller-stats') {
    return <SellerStatsScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'edit-account') {
    return (
      <EditAccountScreen
        onBack={() => setProfileNav(null)}
        onChangePhone={() => {
          setPhoneChangeReturn('edit-account');
          setSellerStep('phone');
        }}
      />
    );
  }

  if (profileNav === 'follow-connections') {
    return (
      <FollowConnectionsScreen
        initialTab={followConnectionsTab}
        mode={
          profileMode === 'seller' || followConnectionsTab === 'followers'
            ? 'followers'
            : 'following'
        }
        onBack={() => {
          setProfileNav(null);
          dispatch(loadUserProfile());
        }}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'my-activity') {
    return (
      <MyActivityScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'notification-settings') {
    return <NotificationSettingsScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'reservation-history') {
    return (
      <ReservationHistoryScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'visited-stores') {
    return (
      <VisitedStoresScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'purchased-products') {
    return (
      <PurchasedProductsScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'buyer-orders') {
    return (
      <BuyerOrdersScreen
        onBack={() => setProfileNav(null)}
        onNavigatePickup={onNavigatePickup}
        initialTab={buyerOrdersTab}
        tabRequestKey={buyerOrdersTabKey}
      />
    );
  }

  if (profileNav === 'favorite-products') {
    return (
      <View style={styles.screen}>
        <FavoriteProductsScreen
          title="Quản lý sản phẩm yêu thích"
          onBack={() => setProfileNav(null)}
          onOpenProduct={(productId) => onOpenProductDetail?.(productId)}
        />
      </View>
    );
  }

  if (profileNav === 'buyer-preview') {
    const storeId = shopSettings?.id || shopSettings?.shopId;

    return (
      <View style={styles.screen}>
        <View style={styles.previewBanner}>
          <View style={styles.previewBannerTextWrap}>
            <Text style={styles.previewBannerTitle}>Chế độ xem</Text>
            <Text style={styles.previewBannerSubtitle}>Góc nhìn người mua</Text>
          </View>
          <Pressable
            onPress={() => setProfileNav(null)}
            style={({ pressed }) => [styles.previewExitButton, pressed && styles.previewExitButtonPressed]}
          >
            <Text style={styles.previewExitButtonText}>Thoát</Text>
          </Pressable>
        </View>
        {storeId ? (
          <StoreDetailScreen
            key={String(storeId)}
            storeId={String(storeId)}
            onBack={() => setProfileNav(null)}
            onNavigateDirections={onNavigateToStore}
            previewMode
          />
        ) : (
          <View style={styles.previewFallback}>
            <Text style={styles.previewFallbackText}>Không tải được cửa hàng.</Text>
            <Pressable onPress={() => setProfileNav(null)} style={styles.previewExitButton}>
              <Text style={styles.previewExitButtonText}>Thoát</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (productDetailId) {
    if (profileMode === 'buyer') {
      if (productStoreId) {
        return (
          <StoreDetailScreen
            storeId={productStoreId}
            onBack={() => setProductStoreId(null)}
            onProductPress={(nextProductId) => {
              setProductStoreId(null);
              onOpenProductDetail?.(nextProductId);
            }}
            onNavigateDirections={onNavigateToStore}
          />
        );
      }

      return (
        <ProductDetailScreen
          productId={productDetailId}
          onBack={() => {
            setProductStoreId(null);
            onOpenProductDetail?.(null);
          }}
          onStorePress={(storeId) => setProductStoreId(String(storeId))}
        />
      );
    }

    return (
      <SellerProductDetailScreen
        productId={productDetailId}
        onBack={() => onOpenProductDetail?.(null)}
        onChanged={onProductChanged}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <AccountProfileScreen
        profileMode={profileMode}
        isProfileVisible={isProfileVisible}
        productRefreshKey={productRefreshKey}
        shopContactRefreshKey={shopContactRefreshKey}
        shopSettings={shopSettings}
        onOpenProduct={(productId) => onOpenProductDetail?.(productId)}
        onEditAccount={() => setProfileNav('edit-account')}
        onOpenActivity={() => setProfileNav('my-activity')}
        onOpenNotificationSettings={() => setProfileNav('notification-settings')}
        onOpenInbox={onOpenInbox}
        onOpenBuyerOrders={() => {
          setBuyerOrdersTab(RESERVATION_TAB.HOLDING);
          setBuyerOrdersTabKey(Date.now());
          setProfileNav('buyer-orders');
        }}
        onOpenFavoriteProducts={() => setProfileNav('favorite-products')}
        onOpenSellerShopSettings={() => setProfileNav('seller-shop-settings')}
        onOpenSellerReviews={() => setProfileNav('seller-reviews')}
        onOpenSellerOrders={() => setProfileNav('seller-orders')}
        onOpenSellerStats={() => setProfileNav('seller-stats')}
        onOpenBuyerView={openBuyerPreview}
        onStartSellerRegister={startSellerRegistration}
        onSwitchToSellerMode={onSwitchToSellerMode}
        onSwitchToBuyerMode={onSwitchToBuyerMode}
        onLogout={() => dispatch(logoutUser())}
        onOpenFollowConnections={(tab = 'following') => {
          setFollowConnectionsTab(tab === 'followers' ? 'followers' : 'following');
          setProfileNav('follow-connections');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
    minHeight: 0,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ecfdf5',
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
  },
  previewBannerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewBannerTitle: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '800',
  },
  previewBannerSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  previewExitButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  previewExitButtonPressed: {
    opacity: 0.75,
  },
  previewExitButtonText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '800',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  previewFallbackText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
