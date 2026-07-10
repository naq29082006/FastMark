import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import PurchasedProductsScreen from '../profile/PurchasedProductsScreen';
import ReservationHistoryScreen from '../profile/ReservationHistoryScreen';
import VisitedStoresScreen from '../profile/VisitedStoresScreen';
import SellerPhoneSetupScreen from '../seller/SellerPhoneSetupScreen';
import SellerPhoneVerifyScreen from '../seller/SellerPhoneVerifyScreen';
import SellerRegistrationScreen from '../seller/SellerRegistrationScreen';
import SellerVerificationStatusScreen from '../seller/SellerVerificationStatusScreen';
import SellerProductDetailScreen from '../seller/SellerProductDetailScreen';
import SellerShopSettingsScreen from '../seller/SellerShopSettingsScreen';
import SellerOrdersScreen from '../seller/SellerOrdersScreen';
import SellerOrderDetailScreen from '../seller/SellerOrderDetailScreen';
import SellerStatsScreen from '../seller/SellerStatsScreen';
import { getSellerRegistrationStep } from '../seller/sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

export default function ProfilePanel({
  profileMode = 'buyer',
  onOpenStore,
  sellerRegisterRequest = 0,
  isProfileVisible = false,
  productDetailId = null,
  productRefreshKey = 0,
  onOpenProductDetail,
  onProductChanged,
  onSwitchToSellerMode,
  onSwitchToBuyerMode,
  canSwitchToSeller = false,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const isSeller = useSelector(selectIsSeller);
  const [profileNav, setProfileNav] = useState(null);
  const [sellerStep, setSellerStep] = useState(null);
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerVerification, setSellerVerification] = useState(null);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [phoneChangeReturn, setPhoneChangeReturn] = useState(null);
  const [shopContactRefreshKey, setShopContactRefreshKey] = useState(0);
  const [shopSettings, setShopSettings] = useState(null);

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
    if (!user || profile) {
      return;
    }
    dispatch(loadUserProfile());
  }, [dispatch, user, profile]);

  async function startSellerRegistration() {
    if (isSeller) {
      return;
    }

    try {
      const result = await dispatch(syncSellerAccess()).unwrap();
      const latestProfile = result?.profile || profile;
      const verification = result?.verification || null;
      const nextStep = getSellerRegistrationStep(latestProfile, verification);
      setSellerPhone(latestProfile?.phone || '');
      setSellerVerification(verification);
      setSellerStep(nextStep);
    } catch {
      const nextStep = getSellerRegistrationStep(profile, null);
      setSellerPhone(profile?.phone || '');
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
        onContinue={async (phone) => {
          setSellerPhone(phone);
          setSellerStep('verify');
        }}
      />
    );
  }

  if (sellerStep === 'verify') {
    return (
      <SellerPhoneVerifyScreen
        phone={sellerPhone || profile?.phone || ''}
        onBack={() => setSellerStep('phone')}
        onNeedPhone={() => setSellerStep('phone')}
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
          setSellerPhone(profile?.phone || '');
          setSellerStep('phone');
        }}
      />
    );
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
    return <EditAccountScreen onBack={() => setProfileNav(null)} />;
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

  if (productDetailId) {
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
        onOpenActivity={() => setProfileNav('reservation-history')}
        onOpenSellerShopSettings={() => setProfileNav('seller-shop-settings')}
        onOpenSellerOrders={() => setProfileNav('seller-orders')}
        onOpenSellerStats={() => setProfileNav('seller-stats')}
        onStartSellerRegister={startSellerRegistration}
        onSwitchToSellerMode={onSwitchToSellerMode}
        onSwitchToBuyerMode={onSwitchToBuyerMode}
        canSwitchToSeller={canSwitchToSeller}
        onLogout={() => dispatch(logoutUser())}
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
});
