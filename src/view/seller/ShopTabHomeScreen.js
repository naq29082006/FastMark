import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { getSellerStatsOnBackend } from '../../api/sellerOpsApi';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { formatPrice } from '../../core/utils/productFormat';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsSeller,
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { getSellerRegisterButtonLabel } from './sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS, SELLER_VERIFICATION_PENDING_REVIEW_MESSAGE } from '../../constants/sellerVerification';
import { showErrorAlert } from '../../core/utils/appAlert';

const HUB_ITEMS = [
  { key: 'stats', label: 'Thống kê', icon: 'stats-chart-outline', action: 'stats' },
  { key: 'post', label: 'Đăng bài sản phẩm', icon: 'add-circle-outline', action: 'post' },
  { key: 'products', label: 'Sản phẩm', icon: 'cube-outline', action: 'products' },
  { key: 'orders', label: 'Đơn bán', icon: 'receipt-outline', action: 'orders' },
  { key: 'scan-buyer-qr', label: 'Quét QR giao hàng', icon: 'scan-outline', action: 'scan-buyer-qr' },
  { key: 'reviews', label: 'Đánh giá', icon: 'star-outline', action: 'reviews' },
  { key: 'settings', label: 'Cài đặt shop', icon: 'storefront-outline', action: 'settings' },
  { key: 'subscription', label: 'Gói bán', icon: 'diamond-outline', action: 'subscription' },
  { key: 'banner', label: 'Banner', icon: 'images-outline', action: 'banner' },
];

function OverviewStatCard({ icon, label, value, subValue }) {
  return (
    <View style={styles.overviewStatCard}>
      <View style={styles.overviewStatIcon}>
        <Ionicons name={icon} size={16} color={t.primary} />
      </View>
      <Text style={styles.overviewStatValue}>{value}</Text>
      <Text style={styles.overviewStatLabel}>{label}</Text>
      {subValue ? <Text style={styles.overviewStatSub}>{subValue}</Text> : null}
    </View>
  );
}

export default function ShopTabHomeScreen({
  unreadNotificationsCount = 0,
  isVisible = false,
  onStartRegister,
  onOpenHub,
  onOpenWallet,
  onEditVerification,
}) {
  const insets = useScreenInsets();
  const profile = useSelector(selectAuthProfile);
  const role = useSelector(selectUserRole);
  const isSeller = useSelector(selectIsSeller);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const verification = useSelector(selectSellerVerification);
  const registerLabel = getSellerRegisterButtonLabel({ role, verification });

  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const isPending = verification?.status === SELLER_VERIFICATION_STATUS.PENDING;
  const isRejected = verification?.status === SELLER_VERIFICATION_STATUS.REJECTED;
  const isPendingReReview = Boolean(verification?.isPendingReReview);
  const isAttpExpired = Boolean(verification?.isAttpExpired);
  const isAttpResubmitRequired = Boolean(verification?.isAttpResubmitRequired);
  const showAttpActionBanner =
    (isAttpExpired || isAttpResubmitRequired) && !isPendingReReview;
  const showManageHub = Boolean(canSwitchToSeller && isSeller);
  const notificationBadgeCount = Math.max(0, Number(unreadNotificationsCount) || 0);
  const walletBalance = Number(profile?.walletBalance) || 0;

  const loadStats = useCallback(async () => {
    if (!showManageHub) {
      return;
    }

    setIsLoadingStats(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }
      const data = await getSellerStatsOnBackend(idToken);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [showManageHub]);

  useEffect(() => {
    if (!isVisible || !showManageHub) {
      return;
    }
    loadStats();
  }, [isVisible, showManageHub, loadStats]);

  const reservations = stats?.reservations || {};
  const orderCount = String(reservations.total ?? 0);
  const productCount = String(stats?.tongSP ?? profile?.tongSP ?? 0);
  const ratingValue =
    Number(stats?.diemTB ?? profile?.diemTB ?? 0) > 0
      ? Number(stats?.diemTB ?? profile?.diemTB).toFixed(1)
      : '—';
  const reviewCount = stats?.tongDG ?? profile?.tongDG ?? 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 8,
            paddingBottom: insets.tabRootScrollPaddingBottom,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Gian hàng</Text>
            {showManageHub ? (
              <Pressable
                style={({ pressed }) => [styles.headerWalletRow, pressed && styles.pressed]}
                onPress={() => onOpenWallet?.()}
              >
                <Ionicons name="wallet-outline" size={14} color={t.primary} />
                <Text style={styles.headerWalletLabel}>Ví FastMark:</Text>
                <Text style={styles.headerWalletBalance}>{formatPrice(walletBalance)}</Text>
              </Pressable>
            ) : (
              <Text style={styles.subtitle} numberOfLines={1}>
                Mở gian hàng và bán hàng trên FastMark
              </Text>
            )}
          </View>
          {showManageHub ? (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => onOpenHub?.('preview')}
                style={({ pressed }) => [styles.headerActionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Xem shop"
                hitSlop={8}
              >
                <Ionicons name="eye-outline" size={18} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={() => onOpenHub?.('notifications')}
                style={({ pressed }) => [styles.headerActionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Thông báo"
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={18} color="#64748b" />
                {notificationBadgeCount > 0 ? (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>
                      {notificationBadgeCount > 99 ? '99+' : String(notificationBadgeCount)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          ) : null}
        </View>

        {showManageHub && showAttpActionBanner ? (
          <View style={styles.expiredAttpBanner}>
            <Text style={styles.expiredAttpBannerTitle}>
              {isAttpResubmitRequired ? 'Giấy phép ATTP chưa được duyệt' : 'Giấy phép ATTP đã hết hạn'}
            </Text>
            <Text style={styles.expiredAttpBannerBody}>
              {isAttpResubmitRequired
                ? verification?.attpMeta?.lastReReviewRejection?.reason
                  ? `Lý do từ chối: ${verification.attpMeta.lastReReviewRejection.reason}. Gian hàng đang tạm ẩn — vui lòng gửi lại hồ sơ xác thực.`
                  : 'Gian hàng đang tạm ẩn. Vui lòng gửi lại giấy phép kinh doanh hoặc chứng nhận an toàn thực phẩm.'
                : 'Gian hàng đang tạm ẩn. Vui lòng cập nhật giấy phép kinh doanh hoặc chứng nhận an toàn thực phẩm.'}
            </Text>
            {onEditVerification ? (
              <Pressable
                style={({ pressed }) => [styles.expiredAttpBannerBtn, pressed && styles.pressed]}
                onPress={onEditVerification}
              >
                <Text style={styles.expiredAttpBannerBtnText}>
                  {isAttpResubmitRequired ? 'Gửi lại hồ sơ xác thực' : 'Cập nhật hồ sơ xác thực'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {showManageHub && isPendingReReview ? (
          <View style={styles.reReviewBanner}>
            <Text style={styles.reReviewBannerTitle}>Đang chờ duyệt lại hồ sơ xác thực</Text>
            <Text style={styles.reReviewBannerBody}>{SELLER_VERIFICATION_PENDING_REVIEW_MESSAGE}</Text>
          </View>
        ) : null}

        {!showManageHub ? (
          <View style={styles.registerBanner}>
            <View style={styles.registerBannerIcon}>
              <Ionicons name="storefront-outline" size={28} color={t.primary} />
            </View>
            <Text style={styles.registerBannerTitle}>
              {isPending
                ? 'Hồ sơ đang chờ duyệt'
                : isRejected
                  ? 'Hồ sơ cần chỉnh sửa'
                  : 'Đăng ký bán hàng'}
            </Text>
            <Text style={styles.registerBannerBody}>
              {isPending
                ? 'Admin đang xét duyệt. Bạn có thể xem trạng thái hoặc chỉnh sửa hồ sơ nếu được yêu cầu.'
                : isRejected
                  ? 'Hồ sơ bị từ chối. Hãy cập nhật lại thông tin để gửi duyệt lần nữa.'
                  : 'Tạo gian hàng, đăng sản phẩm và nhận đơn gần bạn. Ví FastMark dùng chung với tài khoản mua hàng.'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.registerCta, pressed && styles.pressed]}
              onPress={onStartRegister}
            >
              <Text style={styles.registerCtaText}>
                {registerLabel || 'Đăng ký người bán'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.overviewSection}>
              <Text style={styles.sectionTitle}>Tổng quan gian hàng</Text>

              {isLoadingStats && !stats ? (
                <ActivityIndicator color={t.primary} style={styles.statsLoader} />
              ) : (
                <View style={styles.overviewGrid}>
                  <OverviewStatCard icon="bag-handle-outline" label="Đơn hàng" value={orderCount} />
                  <OverviewStatCard icon="cube-outline" label="Sản phẩm" value={productCount} />
                  <OverviewStatCard
                    icon="star-outline"
                    label={reviewCount ? `Đánh giá (${reviewCount})` : 'Đánh giá'}
                    value={ratingValue}
                  />
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Quản lý gian hàng</Text>

            <View style={styles.hubGrid}>
              {HUB_ITEMS.map((item) => {
                const blockedByReReview =
                  (isPendingReReview || isAttpResubmitRequired) &&
                  (item.action === 'post' || item.action === 'products');
                return (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [
                    styles.hubItem,
                    blockedByReReview && styles.hubItemDisabled,
                    pressed && !blockedByReReview && styles.pressed,
                  ]}
                  onPress={() => {
                    if (blockedByReReview) {
                      showErrorAlert(SELLER_VERIFICATION_PENDING_REVIEW_MESSAGE);
                      return;
                    }
                    onOpenHub?.(item.action);
                  }}
                >
                  <View style={styles.hubIconWrap}>
                    <Ionicons name={item.icon} size={22} color={blockedByReReview ? '#94a3b8' : t.primary} />
                  </View>
                  <Text style={[styles.hubLabel, blockedByReReview && styles.hubLabelDisabled]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  content: {
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.88,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  headerWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  headerWalletLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  headerWalletBalance: {
    fontSize: 14,
    fontWeight: '800',
    color: t.primary,
  },
  registerBanner: {
    backgroundColor: t.primarySoft,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  registerBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  registerBannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: t.primaryDark,
    marginBottom: 8,
  },
  registerBannerBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 18,
  },
  registerCta: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: t.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  registerCtaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  overviewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  statsLoader: {
    paddingVertical: 24,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overviewStatCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8f0eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  overviewStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  overviewStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  overviewStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  overviewStatSub: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hubItem: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    maxWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  hubItemDisabled: {
    opacity: 0.55,
    backgroundColor: '#f8fafc',
  },
  hubIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  hubLabelDisabled: {
    color: '#94a3b8',
  },
  reReviewBanner: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  reReviewBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#c2410c',
    marginBottom: 6,
  },
  reReviewBannerBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9a3412',
  },
  expiredAttpBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  expiredAttpBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 4,
  },
  expiredAttpBannerBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#991b1b',
  },
  expiredAttpBannerBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredAttpBannerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
