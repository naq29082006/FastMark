import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsSeller,
  selectIsShopLocked,
  selectSellerVerification,
} from '../../viewmodel/auth/authSelectors';
import {
  applyShopSettingsToProfile,
  loadUserProfile,
  syncSellerAccess,
} from '../../viewmodel/auth/authSlice';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { isSameData } from '../../core/utils/realtimeList';
import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import { getUnreadNotificationCountOnBackend } from '../../api/notificationApi';
import {
  notificationMatchesAudience,
  resolveUnreadCountFromReadEvent,
} from '../../core/utils/notificationRealtime';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import SellerPhoneSetupScreen from './SellerPhoneSetupScreen';
import SellerRegistrationScreen from './SellerRegistrationScreen';
import SellerVerificationStatusScreen from './SellerVerificationStatusScreen';
import SellerShopSettingsScreen from './SellerShopSettingsScreen';
import SellerVerificationReReviewScreen from './SellerVerificationReReviewScreen';
import SellerShopQrScreen from './SellerShopQrScreen';
import SellerBuyerQrScanScreen from './SellerBuyerQrScanScreen';
import SellerPickupConfirmScreen from './SellerPickupConfirmScreen';
import SellerReviewsManageScreen from './SellerReviewsManageScreen';
import SellerReviewDetailScreen from './SellerReviewDetailScreen';
import SellerOrdersScreen from './SellerOrdersScreen';
import SellerOrderDetailScreen from './SellerOrderDetailScreen';
import SellerProductDetailScreen from './SellerProductDetailScreen';
import BuyerProfileScreen from '../profile/BuyerProfileScreen';
import SellerStatsScreen from './SellerStatsScreen';
import SellerProductsTabScreen from './SellerProductsTabScreen';
import SellerSubscriptionScreen from './SellerSubscriptionScreen';
import SellerBannerScreen from './SellerBannerScreen';
import SellerPostTabScreen from './SellerPostTabScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import NotificationsScreen from '../inbox/NotificationsScreen';
import TopUpScreen from '../wallet/TopUpScreen';
import TopUpSuccessScreen from '../wallet/TopUpSuccessScreen';
import WalletScreen from '../wallet/WalletScreen';
import WalletTransactionsScreen from '../wallet/WalletTransactionsScreen';
import WithdrawScreen from '../wallet/WithdrawScreen';
import { getSellerRegistrationStep } from './sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import ShopTabHomeScreen from './ShopTabHomeScreen';
import ShopLockedScreen from './ShopLockedScreen';
import { resolveTopupReturnViewModel } from '../../viewmodel/wallet/walletViewModel';
import { subscribeTopupDeepLink } from '../../viewmodel/wallet/topupSession';

function resolveTopUpBackLabel(returnNav) {
  if (returnNav === 'banner' || returnNav === 'seller-banner') {
    return 'Quay lại banner';
  }
  if (returnNav === 'subscription' || returnNav === 'seller-subscription') {
    return 'Quay lại gói bán';
  }
  return 'Về ví FastMark';
}

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
  const shopLocked = useSelector(selectIsShopLocked);
  const reduxVerification = useSelector(selectSellerVerification);

  const [shopNav, setShopNav] = useState(null);
  const [sellerStep, setSellerStep] = useState(null);
  const [sellerVerification, setSellerVerification] = useState(null);
  const [orderDetailTarget, setOrderDetailTarget] = useState(null);
  const [reviewDetailTarget, setReviewDetailTarget] = useState(null);
  const [pickupScanReservation, setPickupScanReservation] = useState(null);
  const [orderDetailNestedNav, setOrderDetailNestedNav] = useState(null);
  const [reviewDetailNestedNav, setReviewDetailNestedNav] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [sellerOrdersTab, setSellerOrdersTab] = useState(RESERVATION_TAB.PENDING);
  const [phoneChangeReturn, setPhoneChangeReturn] = useState(null);
  const [shopSettings, setShopSettings] = useState(null);
  const [shopContactRefreshKey, setShopContactRefreshKey] = useState(0);
  const [topUpResult, setTopUpResult] = useState(null);
  const [topUpReturnNav, setTopUpReturnNav] = useState('subscription');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const handledRegisterRequestRef = useRef(0);

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
      // Giữ nguyên state nếu cấu hình shop không đổi → tránh render lại cả panel.
      setShopSettings((current) => (isSameData(current, shop) ? current : shop));
      dispatch(applyShopSettingsToProfile(shop));
    } catch {
      // Keep last known settings.
    }
  }, [dispatch, isSeller, isVisible]);

  const loadUnreadSellerNotifications = useCallback(async () => {
    if (!isSeller) {
      setUnreadNotificationsCount(0);
      return;
    }

    try {
      // Đếm từ backend theo toàn bộ thông báo, không dựa vào trang 20 item đang tải.
      setUnreadNotificationsCount(await getUnreadNotificationCountOnBackend('seller'));
    } catch {
      // Keep previous badge on transient failures.
    }
  }, [isSeller]);

  const handleRealtimeSellerNotification = useCallback(
    (notification) => {
      if (!notificationMatchesAudience(notification, 'seller')) {
        return;
      }
      if (!notification.isRead) {
        setUnreadNotificationsCount((current) => current + 1);
      }
    },
    []
  );

  const handleSellerNotificationRead = useCallback((payload) => {
    const audience = String(payload?.audience || '').trim().toLowerCase();
    if (audience && audience !== 'seller' && audience !== 'system') {
      return;
    }

    const unreadCount = resolveUnreadCountFromReadEvent(payload, 'seller');
    if (unreadCount != null) {
      setUnreadNotificationsCount(unreadCount);
      return;
    }

    setUnreadNotificationsCount((current) => Math.max(0, current - 1));
  }, []);

  useNotificationSocket({
    enabled: Boolean(isVisible && isSeller),
    onNotificationNew: handleRealtimeSellerNotification,
    onNotificationRead: handleSellerNotificationRead,
  });

  useResourceSocket({
    enabled: Boolean(isVisible && isSeller),
    onResourceUpdated: (payload) => {
      const type = String(payload?.type || '').trim();
      // Đơn hàng: SellerOrdersScreen tự cập nhật đúng item qua order_updated,
      // không bump refresh key để tránh tải lại cả danh sách.
      if (type === 'wallet' || type === 'withdraw') {
        dispatch(loadUserProfile()).catch(() => {});
      }
      if (type === 'banner' || type === 'subscription' || type === 'review') {
        loadShopSettings();
      }
    },
  });

  useEffect(() => {
    loadShopSettings();
  }, [loadShopSettings, shopContactRefreshKey]);

  useEffect(() => {
    if (!isVisible || !isSeller) {
      return;
    }

    loadUnreadSellerNotifications();
    const timer = setInterval(loadUnreadSellerNotifications, 30000);
    return () => clearInterval(timer);
  }, [isVisible, isSeller, loadUnreadSellerNotifications, shopNav]);

  useEffect(() => {
    if (!isVisible) {
      // Về hub khi rời tab → bottom nav hiện lại đúng khi quay lại.
      setShopNav(null);
      setSellerStep(null);
      setOrderDetailTarget(null);
      setPhoneChangeReturn(null);
      // Reset tab đơn bán về mặc định khi rời bottom tab Shop.
      setSellerOrdersTab(RESERVATION_TAB.PENDING);
      return;
    }
    dispatch(syncSellerAccess()).catch(() => {});
  }, [dispatch, isVisible]);

  useEffect(() => {
    if (!sellerStep || sellerStep === 'phone' || sellerStep === 'verify' || !reduxVerification) {
      return;
    }

    setSellerVerification(reduxVerification);

    if (
      sellerStep === 'pending' &&
      reduxVerification.status === SELLER_VERIFICATION_STATUS.APPROVED
    ) {
      setSellerStep(null);
      dispatch(loadUserProfile()).catch(() => {});
      dispatch(syncSellerAccess()).catch(() => {});
      (async () => {
        try {
          const idToken = await getCurrentUserIdToken();
          if (!idToken) {
            return;
          }
          const shop = await getSellerShopSettingsOnBackend(idToken);
          setShopSettings(shop);
          dispatch(applyShopSettingsToProfile(shop));
        } catch {
          // Profile sync above will retry shop settings on next visit.
        }
      })();
      Alert.alert(
        'Đã duyệt hồ sơ',
        'Gian hàng của bạn đã được phê duyệt. Bạn có thể bắt đầu đăng sản phẩm và nhận đơn.'
      );
    }
  }, [dispatch, reduxVerification, sellerStep]);

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
    if (!isVisible || !sellerRegisterRequest) {
      return;
    }
    if (handledRegisterRequestRef.current === sellerRegisterRequest) {
      return;
    }
    handledRegisterRequestRef.current = sellerRegisterRequest;
    startSellerRegistration();
  }, [isVisible, sellerRegisterRequest]);

  useEffect(() => {
    // Hub tab gốc: hiện bottom nav. Màn phụ / đăng ký: ẩn.
    // Chỉ báo nested khi tab đang visible — tránh kẹt true khi ẩn.
    const nested = Boolean(isVisible && (sellerStep || shopNav));
    onNavigationStateChange?.(nested);
  }, [isVisible, onNavigationStateChange, sellerStep, shopNav]);

  useEffect(() => {
    return subscribeTopupDeepLink(async (parsed) => {
      if (parsed?.cancelled || !isVisible) {
        return;
      }
      try {
        const resolved = await resolveTopupReturnViewModel(parsed);
        if (resolved?.transaction?.status === 1) {
          setTopUpResult({
            amount: resolved.transaction.amount,
            orderCode: resolved.transaction.orderCode,
            balance: resolved.wallet?.balance,
          });
          dispatch(loadUserProfile());
          setShopNav('wallet-topup-success');
        }
      } catch {
        // Ignore; user can check wallet.
      }
    });
  }, [dispatch, isVisible]);

  function openTopUp(returnNav = 'subscription') {
    setTopUpReturnNav(returnNav || 'subscription');
    setShopNav('wallet-topup');
  }

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
      scan: null,
      post: 'post',
      products: 'products',
      orders: 'orders',
      reviews: 'reviews',
      settings: 'shop-settings',
      'scan-buyer-qr': 'scan-buyer-qr',
      'pickup-qr': 'scan-buyer-qr',
      subscription: 'subscription',
      banner: 'banner',
      wallet: 'wallet',
      stats: 'stats',
      preview: 'preview',
      notifications: 'notifications',
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

  const shopLockedOrderFlow = shopNav === 'orders' || shopNav === 'order-detail';

  if (isSeller && shopLocked && !shopLockedOrderFlow) {
    return (
      <ShopLockedScreen
        onManageOrders={() => {
          setSellerOrdersTab(RESERVATION_TAB.DISPUTE);
          setShopNav('orders');
        }}
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
        onEditVerification={() => setShopNav('verification-re-review')}
      />
    );
  }

  if (shopNav === 'verification-re-review') {
    return (
      <SellerVerificationReReviewScreen
        onBack={() => setShopNav('shop-settings')}
        onSubmitted={async () => {
          try {
            const result = await dispatch(syncSellerAccess()).unwrap();
            setSellerVerification(result?.verification || null);
          } catch {
            // ignore
          }
          setShopNav('shop-settings');
        }}
      />
    );
  }

  if (shopNav === 'scan-buyer-qr') {
    return (
      <SellerBuyerQrScanScreen
        onBack={() => setShopNav('orders')}
        onValidated={(reservation) => {
          setPickupScanReservation(reservation);
          setShopNav('pickup-confirm');
        }}
      />
    );
  }

  if (shopNav === 'pickup-confirm' && pickupScanReservation) {
    return (
      <SellerPickupConfirmScreen
        reservation={pickupScanReservation}
        onBack={() => setShopNav('scan-buyer-qr')}
        onCompleted={() => {
          setPickupScanReservation(null);
          setOrdersRefreshKey((value) => value + 1);
          setShopNav('orders');
        }}
      />
    );
  }

  if (shopNav === 'pickup-qr') {
    return <SellerShopQrScreen onBack={() => setShopNav(null)} />;
  }

  if (shopNav === 'reviews') {
    const reviewShopName =
      shopSettings?.shopName || profile?.shopName || profile?.storeName || 'Gian hàng';
    return (
      <SellerReviewsManageScreen
        onBack={() => setShopNav(null)}
        onOpenReview={({ item, shopName }) => {
          setReviewDetailNestedNav(null);
          setReviewDetailTarget({
            item,
            shopName: shopName || reviewShopName,
          });
          setShopNav('review-detail');
        }}
      />
    );
  }

  if (shopNav === 'review-detail' && reviewDetailTarget) {
    if (reviewDetailNestedNav?.screen === 'buyer') {
      return (
        <BuyerProfileScreen
          userId={String(reviewDetailNestedNav.userId)}
          onBack={() => setReviewDetailNestedNav(null)}
        />
      );
    }

    if (reviewDetailNestedNav?.screen === 'product') {
      return (
        <SellerProductDetailScreen
          productId={String(reviewDetailNestedNav.productId)}
          onBack={() => setReviewDetailNestedNav(null)}
          onChanged={() => {}}
        />
      );
    }

    return (
      <SellerReviewDetailScreen
        reviewId={String(reviewDetailTarget.item?.id || reviewDetailTarget.item?._id || '')}
        initialItem={reviewDetailTarget.item || null}
        shopName={reviewDetailTarget.shopName || ''}
        onBack={() => {
          setReviewDetailNestedNav(null);
          setShopNav('reviews');
        }}
        onOpenBuyer={({ userId }) => {
          setReviewDetailNestedNav({ screen: 'buyer', userId: String(userId) });
        }}
        onOpenProduct={({ productId }) => {
          setReviewDetailNestedNav({ screen: 'product', productId: String(productId) });
        }}
      />
    );
  }

  if (shopNav === 'notifications') {
    return (
      <NotificationsScreen
        audience="seller"
        onBack={() => {
          setShopNav(null);
          loadUnreadSellerNotifications();
        }}
        isScreenActive
      />
    );
  }

  if (shopNav === 'orders') {
    return (
      <SellerOrdersScreen
        activeTab={sellerOrdersTab}
        onActiveTabChange={setSellerOrdersTab}
        onRefreshKey={ordersRefreshKey}
        isScreenActive={isVisible}
        onBack={() => {
          setSellerOrdersTab(RESERVATION_TAB.PENDING);
          setShopNav(null);
        }}
        onOpenReservation={(target) => {
          setOrderDetailNestedNav(null);
          setOrderDetailTarget(target);
          setShopNav('order-detail');
        }}
        onScanPickupQr={() => {
          setPickupScanReservation(null);
          setShopNav('scan-buyer-qr');
        }}
        onShowShopQr={() => setShopNav('pickup-qr')}
      />
    );
  }

  if (shopNav === 'order-detail' && orderDetailTarget) {
    if (orderDetailNestedNav?.screen === 'buyer') {
      return (
        <BuyerProfileScreen
          userId={String(orderDetailNestedNav.userId)}
          onBack={() => setOrderDetailNestedNav(null)}
        />
      );
    }

    if (orderDetailNestedNav?.screen === 'product') {
      return (
        <SellerProductDetailScreen
          productId={String(orderDetailNestedNav.productId)}
          onBack={() => setOrderDetailNestedNav(null)}
          onChanged={() => setOrdersRefreshKey((value) => value + 1)}
        />
      );
    }

    return (
      <SellerOrderDetailScreen
        reservationId={String(orderDetailTarget.item?.id || '')}
        initialItem={orderDetailTarget.item || null}
        listCancelReasonText={orderDetailTarget.listCancelReasonText || ''}
        onBack={() => {
          if (orderDetailTarget.fromTab) {
            setSellerOrdersTab(orderDetailTarget.fromTab);
          }
          setOrderDetailNestedNav(null);
          setShopNav('orders');
        }}
        onChanged={() => setOrdersRefreshKey((value) => value + 1)}
        onOpenBuyer={({ userId }) => {
          setOrderDetailNestedNav({ screen: 'buyer', userId: String(userId) });
        }}
        onOpenProduct={({ productId }) => {
          setOrderDetailNestedNav({ screen: 'product', productId: String(productId) });
        }}
      />
    );
  }

  if (shopNav === 'stats') {
    return <SellerStatsScreen onBack={() => setShopNav(null)} />;
  }

  if (shopNav === 'subscription') {
    return (
      <SellerSubscriptionScreen
        onBack={() => setShopNav(null)}
        onOpenWallet={() => openTopUp('subscription')}
        onOpenBanner={() => setShopNav('banner')}
      />
    );
  }

  if (shopNav === 'banner') {
    return (
      <SellerBannerScreen
        onBack={() => setShopNav(null)}
        onOpenWallet={() => openTopUp('banner')}
        onOpenSubscription={() => setShopNav('subscription')}
      />
    );
  }

  if (shopNav === 'wallet') {
    return (
      <WalletScreen
        onBack={() => setShopNav(null)}
        onTopUp={() => openTopUp('wallet')}
        onWithdraw={() => setShopNav('wallet-withdraw')}
        canTopUp
        onSeeAllTransactions={() => setShopNav('wallet-transactions')}
      />
    );
  }

  if (shopNav === 'wallet-transactions') {
    return <WalletTransactionsScreen onBack={() => setShopNav('wallet')} />;
  }

  if (shopNav === 'wallet-withdraw') {
    return (
      <View style={styles.previewScreen}>
        <WithdrawScreen
          balance={Number(profile?.walletBalance) || 0}
          onBack={() => setShopNav('wallet')}
          onSuccess={() => {
            dispatch(loadUserProfile());
          }}
        />
      </View>
    );
  }

  if (shopNav === 'wallet-topup') {
    return (
      <View style={styles.previewScreen}>
        <TopUpScreen
          balance={Number(profile?.walletBalance) || 0}
          onBack={() => setShopNav(topUpReturnNav || 'subscription')}
          onSuccess={(result) => {
            setTopUpResult(result || null);
            dispatch(loadUserProfile());
            setShopNav('wallet-topup-success');
          }}
        />
      </View>
    );
  }

  if (shopNav === 'wallet-topup-success') {
    return (
      <TopUpSuccessScreen
        amount={topUpResult?.amount || 0}
        orderCode={topUpResult?.orderCode}
        backLabel={resolveTopUpBackLabel(topUpReturnNav)}
        onBackHome={() => {
          setTopUpResult(null);
          setShopNav(topUpReturnNav || 'subscription');
        }}
        onViewHistory={() => {
          setTopUpResult(null);
          if (topUpReturnNav === 'wallet') {
            setShopNav('wallet-transactions');
          } else {
            setShopNav(topUpReturnNav || 'subscription');
          }
        }}
      />
    );
  }

  if (shopNav === 'products') {
    return (
      <SellerProductsTabScreen
        productRefreshKey={productRefreshKey}
        onProductChanged={onProductChanged}
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
      unreadNotificationsCount={unreadNotificationsCount}
      isVisible={isVisible}
      onStartRegister={startSellerRegistration}
      onOpenHub={handleOpenHub}
      onOpenWallet={() => setShopNav('wallet')}
      onOpenWalletTopUp={() => openTopUp('wallet')}
      onShopSettingsUpdated={(updated) => {
        setShopSettings(updated);
        dispatch(applyShopSettingsToProfile(updated));
      }}
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
