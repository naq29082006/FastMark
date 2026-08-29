import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLockAppealStatusOnBackend,
  submitLockAppealOnBackend,
} from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import { selectAuthProfile, selectHasShop } from '../../viewmodel/auth/authSelectors';
import { loadUserProfile, logoutUser } from '../../viewmodel/auth/authSlice';
import { showErrorAlert, confirmLogout } from '../../core/utils/appAlert';
import WithdrawScreen from '../wallet/WithdrawScreen';
import WalletScreen from '../wallet/WalletScreen';
import WalletTransactionsScreen from '../wallet/WalletTransactionsScreen';
import SellerOrdersScreen from '../seller/SellerOrdersScreen';
import SellerOrderDetailScreen from '../seller/SellerOrderDetailScreen';
import SellerBuyerQrScanScreen from '../seller/SellerBuyerQrScanScreen';
import SellerPickupConfirmScreen from '../seller/SellerPickupConfirmScreen';
import SellerShopQrScreen from '../seller/SellerShopQrScreen';
import AdminAppealCompose from '../shared/components/AdminAppealCompose';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';

export default function AccountLockedScreen() {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const hasShop = useSelector(selectHasShop);

  const [loading, setLoading] = useState(true);
  const [appealState, setAppealState] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [screen, setScreen] = useState('main');
  const [ordersTab, setOrdersTab] = useState(RESERVATION_TAB.DISPUTE);
  const [orderDetailTarget, setOrderDetailTarget] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [pickupScanReservation, setPickupScanReservation] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        showErrorAlert('Phiên đăng nhập đã hết hạn.');
        return;
      }
      const status = await getLockAppealStatusOnBackend(idToken);
      setAppealState(status);
      if (status && !status.accountLocked) {
        await dispatch(loadUserProfile());
      }
    } catch (loadError) {
      showErrorAlert(loadError.message || 'Không tải được trạng thái khiếu nại.');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmitAppeal({ content, images }) {
    const idToken = await getCurrentUserIdToken();
    if (!idToken) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập lại.');
      return;
    }
    await submitLockAppealOnBackend({
      idToken,
      title: 'Yêu cầu xem xét lại khóa tài khoản',
      content,
      images,
    });
    setShowForm(false);
    Alert.alert('Đã gửi khiếu nại', 'Đang chờ admin xử lý.');
    await refresh();
  }

  const phase = appealState?.phase || 'can_appeal';
  const displayName = profile?.fullName || profile?.userName || 'Tài khoản';

  if (screen === 'wallet') {
    return (
      <WalletScreen
        onBack={() => setScreen('main')}
        canTopUp={false}
        canWithdraw
        onWithdraw={() => setScreen('withdraw')}
        onSeeAllTransactions={() => setScreen('wallet-transactions')}
      />
    );
  }

  if (screen === 'wallet-transactions') {
    return <WalletTransactionsScreen onBack={() => setScreen('wallet')} />;
  }

  if (screen === 'withdraw') {
    return (
      <WithdrawScreen
        balance={profile?.walletBalance ?? 0}
        onBack={() => setScreen('wallet')}
        onSuccess={() => {
          dispatch(loadUserProfile()).catch(() => {});
        }}
      />
    );
  }

  if (screen === 'scan-buyer-qr' && hasShop) {
    return (
      <SellerBuyerQrScanScreen
        onBack={() => setScreen('orders')}
        onValidated={(reservation) => {
          setPickupScanReservation(reservation);
          setScreen('pickup-confirm');
        }}
      />
    );
  }

  if (screen === 'pickup-confirm' && pickupScanReservation && hasShop) {
    return (
      <SellerPickupConfirmScreen
        reservation={pickupScanReservation}
        onBack={() => setScreen('scan-buyer-qr')}
        onCompleted={() => {
          setPickupScanReservation(null);
          setOrdersRefreshKey((value) => value + 1);
          setScreen('orders');
        }}
      />
    );
  }

  if (screen === 'shop-qr' && hasShop) {
    return <SellerShopQrScreen onBack={() => setScreen('orders')} />;
  }

  if (screen === 'orders' && hasShop) {
    return (
      <SellerOrdersScreen
        activeTab={ordersTab}
        onActiveTabChange={setOrdersTab}
        onRefreshKey={ordersRefreshKey}
        isScreenActive
        accountLockedOrderMode
        onBack={() => setScreen('main')}
        onOpenReservation={(target) => {
          setOrderDetailTarget(target);
          setScreen('order-detail');
        }}
        onScanPickupQr={() => setScreen('scan-buyer-qr')}
        onShowShopQr={() => setScreen('shop-qr')}
      />
    );
  }

  if (screen === 'order-detail' && orderDetailTarget && hasShop) {
    return (
      <SellerOrderDetailScreen
        reservationId={String(orderDetailTarget.item?.id || '')}
        initialItem={orderDetailTarget.item || null}
        listCancelReasonText={orderDetailTarget.listCancelReasonText || ''}
        accountLockedOrderMode
        onBack={() => {
          if (orderDetailTarget.fromTab) {
            setOrdersTab(orderDetailTarget.fromTab);
          }
          setScreen('orders');
        }}
        onChanged={() => setOrdersRefreshKey((value) => value + 1)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAwareScrollView
        nestedScrollPadding={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={36} color="#b91c1c" />
        </View>
        <Text style={styles.title}>Tài khoản đã bị khóa</Text>
        <Text style={styles.subtitle}>
          {displayName} hiện không thể sử dụng FastMark cho đến khi admin mở khóa. Các đơn
          bạn đặt với vai trò người mua đã được hủy và cọc hoàn về ví (nếu có).
          {hasShop
            ? ' Đơn gian hàng (giữ hàng, tranh chấp…) vẫn giữ nguyên — bạn có thể quản lý đơn gian hàng, quản lý ví (chỉ rút tiền), gửi yêu cầu xem xét lại hoặc đăng xuất.'
            : ' Bạn vẫn có thể quản lý ví (chỉ rút tiền), gửi yêu cầu xem xét lại hoặc đăng xuất.'}
        </Text>

        <Pressable style={styles.actionBtn} onPress={() => setScreen('wallet')}>
          <Ionicons name="wallet-outline" size={18} color="#076F32" />
          <Text style={styles.actionBtnText}>Quản lý ví</Text>
        </Pressable>

        {hasShop ? (
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              setOrdersTab(RESERVATION_TAB.DISPUTE);
              setScreen('orders');
            }}
          >
            <Ionicons name="receipt-outline" size={18} color="#076F32" />
            <Text style={styles.actionBtnText}>Quản lý đơn gian hàng</Text>
          </Pressable>
        ) : null}

        {loading ? <Text style={styles.muted}>Đang tải trạng thái...</Text> : null}

        {!loading && phase === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chờ admin xử lý</Text>
            <Text style={styles.cardBody}>
              Bạn đã gửi khiếu nại. Vui lòng đợi quản trị viên xem xét.
            </Text>
            {appealState?.appeal?.content ? (
              <Text style={styles.quote}>{appealState.appeal.content}</Text>
            ) : null}
          </View>
        ) : null}

        {!loading && phase === 'rejected' ? (
          <View style={[styles.card, styles.cardDanger]}>
            <Text style={styles.cardTitle}>Khiếu nại đã bị từ chối</Text>
            <Text style={styles.cardBody}>
              {appealState?.appeal?.adminNote ||
                appealState?.message ||
                'Tài khoản vẫn bị khóa. Bạn không thể gửi khiếu nại lại.'}
            </Text>
          </View>
        ) : null}

        {!loading && phase === 'can_appeal' && !showForm ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setShowForm(true)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Yêu cầu xem xét lại</Text>
          </Pressable>
        ) : null}

        {!loading && phase === 'can_appeal' && showForm ? (
          <AdminAppealCompose
            contentLabel="Nội dung yêu cầu"
            contentPlaceholder="Giải thích vì sao bạn muốn mở lại tài khoản..."
            submitLabel="Gửi yêu cầu"
            onCancel={() => setShowForm(false)}
            onSubmit={handleSubmitAppeal}
          />
        ) : null}

        <Pressable style={styles.refreshBtn} onPress={refresh}>
          <Text style={styles.refreshText}>Làm mới trạng thái</Text>
        </Pressable>
        <Pressable
          style={styles.logoutBtn}
          onPress={() => confirmLogout(() => dispatch(logoutUser()))}
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 40 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#076F32',
    backgroundColor: '#ffffff',
  },
  actionBtnText: { color: '#076F32', fontWeight: '800', fontSize: 15 },
  muted: { textAlign: 'center', color: '#94a3b8', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardDanger: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#475569', lineHeight: 20 },
  quote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#076F32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  refreshBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  refreshText: { color: '#0369a1', fontWeight: '700' },
  logoutBtn: { alignItems: 'center', paddingVertical: 12 },
  logoutText: { color: '#b91c1c', fontWeight: '800' },
});
