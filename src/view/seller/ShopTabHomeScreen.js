import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsSeller,
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { getSellerRegisterButtonLabel } from './sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

const HUB_ITEMS = [
  { key: 'scan', label: 'Quét đơn', icon: 'qr-code-outline', action: 'scan' },
  { key: 'post', label: 'Đăng bài', icon: 'add-circle-outline', action: 'post' },
  { key: 'products', label: 'Sản phẩm', icon: 'cube-outline', action: 'products' },
  { key: 'orders', label: 'Đơn bán', icon: 'receipt-outline', action: 'orders' },
  { key: 'vouchers', label: 'Voucher', icon: 'pricetag-outline', action: 'vouchers' },
  { key: 'reviews', label: 'Đánh giá', icon: 'star-outline', action: 'reviews' },
  { key: 'settings', label: 'Cài đặt shop', icon: 'storefront-outline', action: 'settings' },
  { key: 'subscription', label: 'Gói bán', icon: 'diamond-outline', action: 'subscription' },
  { key: 'stats', label: 'Thống kê', icon: 'stats-chart-outline', action: 'stats' },
  { key: 'preview', label: 'Xem shop', icon: 'eye-outline', action: 'preview' },
];

export default function ShopTabHomeScreen({
  shopSettings = null,
  onStartRegister,
  onOpenHub,
}) {
  const insets = useScreenInsets();
  const profile = useSelector(selectAuthProfile);
  const role = useSelector(selectUserRole);
  const isSeller = useSelector(selectIsSeller);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const verification = useSelector(selectSellerVerification);
  const registerLabel = getSellerRegisterButtonLabel({ role, verification });

  const isPending = verification?.status === SELLER_VERIFICATION_STATUS.PENDING;
  const isRejected = verification?.status === SELLER_VERIFICATION_STATUS.REJECTED;
  const showManageHub = Boolean(canSwitchToSeller && isSeller);
  const shopName = profile?.fullName || shopSettings?.shopName || 'Gian hàng của bạn';
  const subscriptionActive = Boolean(
    shopSettings?.subscriptionActive || profile?.subscriptionActive
  );
  const expiresAt =
    shopSettings?.subscriptionExpiresAt || profile?.subscriptionExpiresAt || null;

  return (
    <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottomSpacing, 24) + 88 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="storefront" size={22} color="#ffffff" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Gian hàng</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {showManageHub ? shopName : 'Mở gian hàng và bán hàng trên FastMark'}
            </Text>
          </View>
        </View>

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
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{shopName}</Text>
              <Text style={styles.statusSub}>
                {subscriptionActive
                  ? `Gói còn hạn đến ${
                      expiresAt ? new Date(expiresAt).toLocaleDateString('vi-VN') : '—'
                    }`
                  : 'Chưa có gói — gian hàng đang ẩn công khai'}
              </Text>
              <Text style={styles.walletHint}>
                Ví thanh toán gói / nạp tiền nằm ở tab Tài khoản (dùng chung).
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Quản lý gian hàng</Text>
            <View style={styles.hubGrid}>
              {HUB_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.hubItem, pressed && styles.pressed]}
                  onPress={() => onOpenHub?.(item.action)}
                >
                  <View style={styles.hubIconWrap}>
                    <Ionicons name={item.icon} size={22} color={t.primary} />
                  </View>
                  <Text style={styles.hubLabel}>{item.label}</Text>
                </Pressable>
              ))}
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
    backgroundColor: '#f8fafb',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.88,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
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
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: t.primaryDark,
    fontWeight: '600',
  },
  walletHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
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
});
