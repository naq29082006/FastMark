import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { getBuyerOrdersOnBackend } from '../../../api/buyerOpsApi';
import { RESERVATION_TAB } from '../../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../../repository/authRepository';
import { selectAuthProfile, selectAuthUser } from '../../../viewmodel/auth/authSelectors';
import ProfileSideDrawer from './ProfileSideDrawer';

/**
 * Nút 3 gạch + drawer bên phải (kiểu TikTok).
 */
export default function BuyerQuickMenu({
  onEditAccount,
  onOpenWallet,
  onOpenHoldingOrders,
  onOpenFavoriteProducts,
  onOpenReport,
  onLogout,
  style,
  buttonStyle,
  iconColor = '#0f172a',
}) {
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const [open, setOpen] = useState(false);
  const [holdingOrdersCount, setHoldingOrdersCount] = useState(0);
  const [holdingOrdersLoading, setHoldingOrdersLoading] = useState(false);

  const displayName =
    profile?.fullName || profile?.displayName || user?.displayName || user?.email || 'Tài khoản';
  const userName = profile?.userName || profile?.username || '';
  const photoUrl = profile?.photoUrl || profile?.avatarUrl || user?.photoURL || null;
  const walletBalance = Number(profile?.walletBalance) || 0;

  const loadHoldingOrdersCount = useCallback(async () => {
    setHoldingOrdersLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setHoldingOrdersCount(0);
        return;
      }
      const data = await getBuyerOrdersOnBackend({
        idToken,
        tab: RESERVATION_TAB.HOLDING,
        page: 1,
        limit: 1,
      });
      setHoldingOrdersCount(Math.max(0, Number(data?.total) || 0));
    } catch {
      setHoldingOrdersCount(0);
    } finally {
      setHoldingOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    loadHoldingOrdersCount();
  }, [open, loadHoldingOrdersCount]);

  const sections = useMemo(() => {
    const personalItems = [
      {
        key: 'favorites',
        icon: 'heart-outline',
        label: 'Sản phẩm yêu thích',
        onPress: onOpenFavoriteProducts,
      },
      {
        key: 'edit',
        icon: 'create-outline',
        label: 'Chỉnh sửa hồ sơ',
        onPress: onEditAccount,
      },
      {
        key: 'report',
        icon: 'shield-checkmark-outline',
        label: 'Báo cáo',
        onPress: onOpenReport,
      },
    ].filter((item) => typeof item.onPress === 'function');

    const settingsItems = [
      {
        key: 'logout',
        icon: 'log-out-outline',
        label: 'Đăng xuất',
        danger: true,
        onPress: onLogout,
      },
    ].filter((item) => typeof item.onPress === 'function');

    return [
      personalItems.length
        ? { key: 'personal', title: 'Công cụ cá nhân', items: personalItems }
        : null,
      settingsItems.length ? { key: 'settings', title: 'Tài khoản', items: settingsItems } : null,
    ].filter(Boolean);
  }, [onEditAccount, onLogout, onOpenFavoriteProducts, onOpenReport]);

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu tiện ích"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, buttonStyle, pressed && styles.buttonPressed]}
      >
        <Ionicons name="menu-outline" size={22} color={iconColor} />
      </Pressable>

      <ProfileSideDrawer
        visible={open}
        onClose={() => setOpen(false)}
        displayName={displayName}
        userName={userName}
        photoUrl={photoUrl}
        walletBalance={walletBalance}
        holdingOrdersCount={holdingOrdersCount}
        holdingOrdersLoading={holdingOrdersLoading}
        onOpenWallet={onOpenWallet}
        onOpenHoldingOrders={onOpenHoldingOrders}
        sections={sections}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 30,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
