import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsSeller,
} from '../../viewmodel/auth/authSelectors';
import {
  applyShopSettingsToProfile,
  loadUserProfile,
  syncSellerAccess,
} from '../../viewmodel/auth/authSlice';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import SellerPhoneSetupScreen from './SellerPhoneSetupScreen';
import SellerRegistrationScreen from './SellerRegistrationScreen';
import SellerVerificationStatusScreen from './SellerVerificationStatusScreen';
import SellerShopSettingsScreen from './SellerShopSettingsScreen';
import SellerVouchersScreen from './SellerVouchersScreen';
import SellerReviewsManageScreen from './SellerReviewsManageScreen';
import SellerOrdersScreen from './SellerOrdersScreen';
import SellerOrderDetailScreen from './SellerOrderDetailScreen';
import SellerStatsScreen from './SellerStatsScreen';
import SellerProductsTabScreen from './SellerProductsTabScreen';
import SellerSubscriptionScreen from './SellerSubscriptionScreen';
import SellerPostTabScreen from './SellerPostTabScreen';
import SellerPickupScanScreen from './SellerPickupScanScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import TopUpScreen from '../wallet/TopUpScreen';
import TopUpSuccessScreen from '../wallet/TopUpSuccessScreen';
import { getSellerRegistrationStep } from './sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import ShopTabHomeScreen from './ShopTabHomeScreen';

export default function ShopTabPanel({
  isVisible = false,
  sellerRegisterRequest = 0,
  productRefreshKey = 0,
  onProductChanged,
  onNavigationStateChange,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const isSeller = useSelector(selectIsSeller);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);

  const [shopNav, setShopNav] = useState(null);
  const [sellerStep, setSellerStep] = useState(null);
  const [sellerVerification, setSellerVerification] = useState(null);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [phoneChangeReturn, setPhoneChangeReturn] = useState(null);
  const [shopSettings, setShopSettings] = useState(null);
  const [shopContactRefreshKey, setShopContactRefreshKey] = useState(0);
  const [topUpResult, setTopUpResult] = useState(null);

  const loadShopSettings = useCallback(async () => {
    if (!isVisible || !isSeller) {
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
      // Keep last known settings.
    }
  }, [dispatch, isSeller, isVisible]);

  useEffect(() => {
    loadShopSettings();
  }, [loadShopSettings, shopContactRefreshKey]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    dispatch(syncSellerAccess()).catch(() => {});
  }, [dispatch, isVisible]);

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
    onNavigationStateChange?.(Boolean(sellerStep || shopNav));
  }, [onNavigationStateChange, sellerStep, shopNav]);

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

    setShopNav('buyer-preview');
  }, [dispatch, shopSettings]);

  function handleOpenHub(action) {
    const map = {
      scan: 'scan',
      post: 'post',
      products: 'products',
      orders: 'orders',
      vouchers: 'vouchers',
      reviews: 'reviews',
      settings: 'shop-settings',
      subscription: 'subscription',
      stats: 'stats',
      preview: 'preview',
    };

    if (action === 'preview') {
      openBuyerPreview();
      return;
    }

    const next = map[action];
    if (next) {
      setShopNav(next);
    }
  }

  if (sellerStep === 'phone' || sellerStep === 'verify') {
    return (
      <SellerPhoneSetupScreen
        mode={phoneChangeReturn ? 'change' : 'register'}
        onBack={() => {
          const returnNav = phoneChangeReturn;
          setPhoneChangeReturn(null);
          setSellerStep(null);
          if (returnNav) {
            setShopNav(returnNav);
          }
        }}
        onVerified={async () => {
          if (phoneChangeReturn) {
            await dispatch(syncSellerAccess());
            const returnNav = phoneChangeReturn;
            setPhoneChangeReturn(null);
            setSellerStep(null);
            setShopContactRefreshKey((value) => value + 1);
            setShopNav(returnNav);
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
            // Keep submitted verification.
          }
          setSellerVerification(latestVerification);
          setSellerStep('pending');
        }}
      />
    );
  }

  if (shopNav === 'scan') {
    return (
      <SellerPickupScanScreen
        onBack={() => setShopNav(null)}
        onCompleted={() => setOrdersRefreshKey((value) => value + 1)}
      />
    );
  }

  if (shopNav === 'post') {
    return (
      <SellerPostTabScreen
        onBack={() => setShopNav(null)}
        onProductChanged={onProductChanged}
        onProductCreated={() => {
          onProductChanged?.();
          setShopNav('products');
        }}
      />
    );
  }

  if (shopNav === 'shop-settings') {
    return (
      <SellerShopSettingsScreen
        onBack={() => {
          setShopContactRefreshKey((value) => value + 1);
          setShopNav(null);
        }}
        onSaved={(shop) => {
          if (shop) {
            setShopSettings(shop);
          }
          setShopContactRefreshKey((value) => value + 1);
        }}
        onChangePhone={() => {
          setPhoneChangeReturn('shop-settings');
          setSellerStep('phone');
        }}
      />
    );
  }

  if (shopNav === 'reviews') {
    return <SellerReviewsManageScreen onBack={() => setShopNav(null)} />;
  }

  if (shopNav === 'orders') {
    return (
      <SellerOrdersScreen
        onRefreshKey={ordersRefreshKey}
        onBack={() => setShopNav(null)}
        onOpenReservation={(reservationId) => {
          setSelectedReservationId(reservationId);
          setShopNav('order-detail');
        }}
      />
    );
  }

  if (shopNav === 'order-detail' && selectedReservationId) {
    return (
      <SellerOrderDetailScreen
        reservationId={selectedReservationId}
        onBack={() => setShopNav('orders')}
        onChanged={() => setOrdersRefreshKey((value) => value + 1)}
      />
    );
  }

  if (shopNav === 'stats') {
    return <SellerStatsScreen onBack={() => setShopNav(null)} />;
  }

  if (shopNav === 'vouchers') {
    return <SellerVouchersScreen onBack={() => setShopNav(null)} />;
  }

  if (shopNav === 'subscription') {
    return (
      <SellerSubscriptionScreen
        onBack={() => setShopNav(null)}
        onOpenWallet={() => setShopNav('wallet-topup')}
      />
    );
  }

  if (shopNav === 'wallet-topup') {
    return (
      <TopUpScreen
        balance={Number(profile?.walletBalance) || 0}
        onBack={() => setShopNav('subscription')}
        onSuccess={(result) => {
          setTopUpResult(result || null);
          dispatch(loadUserProfile());
          setShopNav('wallet-topup-success');
        }}
      />
    );
  }

  if (shopNav === 'wallet-topup-success') {
    return (
      <TopUpSuccessScreen
        amount={topUpResult?.amount || 0}
        orderCode={topUpResult?.orderCode}
        onBackHome={() => {
          setTopUpResult(null);
          setShopNav('subscription');
        }}
        onViewHistory={() => {
          setTopUpResult(null);
          setShopNav('subscription');
        }}
      />
    );
  }

  if (shopNav === 'products') {
    return (
      <SellerProductsTabScreen
        productRefreshKey={productRefreshKey}
        onProductChanged={onProductChanged}
        onNavigationStateChange={onNavigationStateChange}
        onBack={() => setShopNav(null)}
      />
    );
  }

  if (shopNav === 'buyer-preview') {
    const storeId = shopSettings?.id || shopSettings?.shopId;
    return (
      <View style={styles.previewScreen}>
        <View style={styles.previewBanner}>
          <Text style={styles.previewBannerText}>Xem như khách hàng</Text>
          <Pressable
            onPress={() => setShopNav(null)}
            style={styles.previewExitButton}
          >
            <Text style={styles.previewExitButtonText}>Thoát</Text>
          </Pressable>
        </View>
        {storeId ? (
          <StoreDetailScreen
            key={String(storeId)}
            storeId={String(storeId)}
            onBack={() => setShopNav(null)}
            previewMode
          />
        ) : (
          <View style={styles.previewFallback}>
            <Text style={styles.previewFallbackText}>Không tải được cửa hàng.</Text>
            <Pressable onPress={() => setShopNav(null)} style={styles.previewExitButton}>
              <Text style={styles.previewExitButtonText}>Thoát</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <ShopTabHomeScreen
      shopSettings={shopSettings}
      onStartRegister={startSellerRegistration}
      onOpenHub={handleOpenHub}
    />
  );
}

const styles = StyleSheet.create({
  previewScreen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E6F4EC',
    borderBottomWidth: 1,
    borderBottomColor: '#A7D9B8',
  },
  previewBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#076F32',
  },
  previewExitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  previewExitButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#076F32',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  previewFallbackText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
});
