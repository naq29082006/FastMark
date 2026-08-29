import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useScreenInsets } from '../../hooks/useScreenInsets';

import {
  selectAuthProfile,
  selectAuthUser,
  selectCanSwitchToSeller,
} from '../../viewmodel/auth/authSelectors';
import { uploadUserAvatar, syncSellerAccess, loadUserProfile, applyShopSettingsToProfile, clearAuthFeedback } from '../../viewmodel/auth/authSlice';
import { getMyProductsOnBackend } from '../../api/productApi';
import { getBuyerOrdersOnBackend } from '../../api/buyerOpsApi';
import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import StarRating from '../store/components/StarRating';
import ProfileSideDrawer from '../shared/components/ProfileSideDrawer';
import AvatarBadge from '../shared/components/AvatarBadge';
import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';

function pickShopDescription(...values) {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) {
      return text;
    }
  }
  return '';
}

function resolveImageUrl(value) {
  const url = String(value || '').trim();
  if (!url || url === 'null' || url === 'undefined') {
    return null;
  }
  return url;
}

function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(1).replace('.0', '')}M`;
  }
  if (number >= 1000) {
    return `${(number / 1000).toFixed(1).replace('.0', '')}k`;
  }
  return String(number);
}

async function pickImageBase64() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập thư viện ảnh.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]?.base64) {
    return null;
  }

  const asset = result.assets[0];
  return {
    imageBase64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
  };
}

function mapApiProductToCard(product) {
  const variants = product.variants || [];
  const isOutOfStock =
    product.isOutOfStock ??
    (variants.length > 0 && variants.every((variant) => Number(variant.quantity) <= 0));

  return {
    id: String(product.id),
    name: product.productName,
    price: product.minPrice,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    originalPrice: product.maxPrice > product.minPrice ? product.maxPrice : null,
    thumbnail: product.thumbnail,
    donVi: product.donVi,
    viewCount: product.viewCount,
    likeCount: product.likeCount,
    soldCount: product.soldCount || 0,
    isOutOfStock,
    variants,
  };
}

function ProfileAvatar({ name, photoUrl, onPress, isUploading }) {
  return (
    <View style={styles.avatarWrap}>
      <AvatarBadge name={name} uri={photoUrl} size={88} />
      <Pressable
        onPress={onPress}
        disabled={isUploading}
        style={({ pressed }) => [styles.avatarPlusButton, pressed && styles.buttonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Đổi ảnh đại diện"
      >
        {isUploading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Ionicons name="camera" size={14} color="#ffffff" />
        )}
      </Pressable>
    </View>
  );
}

function BuyerMenuItem({ icon, title, subtitle, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.buyerMenuRow, pressed && styles.buttonPressed]}
      onPress={onPress}
    >
      <View style={styles.buyerMenuIconWrap}>
        <Ionicons name={icon} size={20} color="#076F32" />
      </View>
      <View style={styles.buyerMenuCopy}>
        <Text style={styles.buyerMenuTitle}>{title}</Text>
        {subtitle ? <Text style={styles.buyerMenuSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

function BuyerOrderStatTile({ icon, iconColor, iconBg, title, value, subtitle, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.buyerOrderStatTile, pressed && styles.buttonPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.buyerOrderStatIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.buyerOrderStatCopy}>
        <Text style={styles.buyerOrderStatTitle}>{title}</Text>
        <Text style={styles.buyerOrderStatValue}>{value}</Text>
        {subtitle ? <Text style={styles.buyerOrderStatSubtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function AccountProfileScreen({
  profileMode = 'buyer',
  isProfileVisible = false,
  productRefreshKey = 0,
  shopContactRefreshKey = 0,
  shopSettings = null,
  onOpenProduct,
  onEditAccount,
  onOpenActivity,
  onOpenBuyerOrders,
  onOpenFavoriteProducts,
  onOpenReport,
  onOpenWallet,
  onOpenWalletTopUp,
  onOpenVisitedStores,
  onOpenSellerShopSettings,
  onOpenSellerReviews,
  onOpenSellerOrders,
  onOpenSellerStats,
  onOpenSellerProducts,
  onOpenSellerSubscription,
  onOpenSellerBanner,
  onOpenBuyerView,
  showSellerHub = false,
  onStartSellerRegister,
  onOpenShopTab,
  onSwitchToSellerMode,
  onSwitchToBuyerMode,
  onLogout,
  onOpenFollowConnections,
}) {
  const screenInsets = useScreenInsets();
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const showAsSeller = profileMode === 'seller';
  const showAsBuyer = profileMode === 'buyer';
  const [menuOpen, setMenuOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [shopContact, setShopContact] = useState(null);
  const [isLoadingShopContact, setIsLoadingShopContact] = useState(false);
  const [buyerOrderStats, setBuyerOrderStats] = useState({ total: 0, holding: 0 });
  const [isLoadingBuyerOrderStats, setIsLoadingBuyerOrderStats] = useState(false);

  const loadShopContact = useCallback(async () => {
    if (!showAsSeller) {
      setShopContact(null);
      return;
    }

    setIsLoadingShopContact(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const shop = await getSellerShopSettingsOnBackend(idToken);
      setShopContact(shop);
      dispatch(applyShopSettingsToProfile(shop));
    } catch (loadError) {
      console.warn('loadShopContact failed', loadError);
    } finally {
      setIsLoadingShopContact(false);
    }
  }, [dispatch, showAsSeller]);

  const loadSellerProducts = useCallback(async () => {
    if (!showAsSeller) {
      setSellerProducts([]);
      return;
    }

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const productsPage = await getMyProductsOnBackend(idToken, { page: 1, limit: 20 });
      setSellerProducts((productsPage.items || []).map(mapApiProductToCard));
    } catch {
      setSellerProducts([]);
    }
  }, [dispatch, showAsSeller]);

  useEffect(() => {
    if (!isProfileVisible || !user) {
      return;
    }

    dispatch(loadUserProfile());
  }, [dispatch, isProfileVisible, user, shopContactRefreshKey]);

  useEffect(() => {
    if (!isProfileVisible) {
      return;
    }
    // Clear leftover auth feedback from other screens (edit account, etc.)
    // so profile does not show stale success/error alerts.
    dispatch(clearAuthFeedback());
  }, [dispatch, isProfileVisible]);

  useEffect(() => {
    if (!isProfileVisible || !showAsSeller) {
      return;
    }

    loadSellerProducts();
    loadShopContact();
  }, [
    isProfileVisible,
    showAsSeller,
    loadSellerProducts,
    loadShopContact,
    productRefreshKey,
    shopContactRefreshKey,
  ]);

  useEffect(() => {
    if (!isProfileVisible || canSwitchToSeller) {
      return;
    }

    dispatch(syncSellerAccess());
  }, [dispatch, isProfileVisible, canSwitchToSeller]);

  const loadBuyerOrderStats = useCallback(async () => {
    if (!showAsBuyer) {
      return;
    }

    setIsLoadingBuyerOrderStats(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }

      const [allData, holdingData] = await Promise.all([
        getBuyerOrdersOnBackend({ idToken, tab: RESERVATION_TAB.ALL, page: 1, limit: 1 }),
        getBuyerOrdersOnBackend({ idToken, tab: RESERVATION_TAB.HOLDING, page: 1, limit: 1 }),
      ]);

      setBuyerOrderStats({
        total: Math.max(0, Number(allData?.total) || 0),
        holding: Math.max(0, Number(holdingData?.total) || 0),
      });
    } catch (loadError) {
      console.warn('loadBuyerOrderStats failed', loadError);
    } finally {
      setIsLoadingBuyerOrderStats(false);
    }
  }, [showAsBuyer]);

  useEffect(() => {
    if (!isProfileVisible || !showAsBuyer) {
      return;
    }

    loadBuyerOrderStats();
  }, [isProfileVisible, showAsBuyer, loadBuyerOrderStats]);

  const displayName = profile?.fullName || user?.displayName || 'Fastmark user';
  const userName = profile?.userName || user?.email?.split('@')[0] || '';
  const personalAvatarUrl = resolveImageUrl(profile?.photoUrl);
  // Tài khoản luôn dùng identity + avatar cá nhân; shop chỉ có bio/giờ/địa chỉ.
  const avatarUrl = personalAvatarUrl;
  const avatarLabelName = displayName;

  const shopDescription = pickShopDescription(
    shopSettings?.description,
    shopSettings?.shopDescription,
    shopContact?.description,
    shopContact?.shopDescription,
    profile?.shopDescription
  );
  const showShopDescription = showAsSeller;
  const shopDescriptionText =
    shopDescription || 'Chưa có mô tả. Hãy cập nhật trong Cài đặt shop.';

  const catalogStats = useMemo(
    () => ({
      products: sellerProducts.length,
      likes: sellerProducts.reduce((sum, product) => sum + (Number(product.likeCount) || 0), 0),
    }),
    [sellerProducts]
  );

  const stats = useMemo(
    () => ({
      products: showAsSeller ? catalogStats.products : profile?.tongSP ?? 0,
      sold: profile?.soldCount ?? 0,
      likes: showAsSeller ? catalogStats.likes : profile?.likesCount ?? 0,
      reviews: profile?.tongDG ?? 0,
      rating: profile?.diemTB ?? 0,
      following: profile?.followingCount ?? 0,
    }),
    [catalogStats, showAsSeller, profile]
  );

  async function handlePickAvatar() {
    try {
      const picked = await pickImageBase64();
      if (!picked) {
        return;
      }

      setIsUploadingAvatar(true);

      await dispatch(
        uploadUserAvatar({
          imageBase64: picked.imageBase64,
          mimeType: picked.mimeType,
        })
      ).unwrap();
      dispatch(clearAuthFeedback());
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện.');
    } catch (pickError) {
      dispatch(clearAuthFeedback());
      Alert.alert(
        'Lỗi',
        typeof pickError === 'string'
          ? pickError
          : pickError?.message || 'Không upload được avatar.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  if (showAsBuyer) {
    const buyerMenuItems = [
      {
        key: 'favorites',
        icon: 'heart-outline',
        title: 'Sản phẩm yêu thích',
        subtitle: 'Danh sách sản phẩm bạn đã thích',
        onPress: () => onOpenFavoriteProducts?.(),
      },
      {
        key: 'edit',
        icon: 'create-outline',
        title: 'Chỉnh sửa hồ sơ',
        subtitle: 'Cập nhật thông tin cá nhân',
        onPress: () => onEditAccount?.(),
      },
      {
        key: 'report',
        icon: 'shield-checkmark-outline',
        title: 'Báo cáo',
        subtitle: 'Hệ thống lỗi hoặc loại khác',
        onPress: () => onOpenReport?.(),
      },
    ];

    return (
      <View style={styles.buyerScreen}>
        <ScrollView
          style={styles.buyerScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.buyerScrollContent,
            {
              paddingTop: 8,
              paddingBottom: screenInsets.tabRootScrollPaddingBottom,
            },
          ]}
        >
          <View style={styles.buyerHeaderRow}>
            <Text style={styles.buyerHeaderTitle}>Tài khoản của tôi</Text>
          </View>

          <View style={styles.buyerHeroCard}>
            <View style={styles.buyerProfileRow}>
              <ProfileAvatar
                name={avatarLabelName}
                photoUrl={avatarUrl}
                onPress={handlePickAvatar}
                isUploading={isUploadingAvatar}
              />
              <View style={styles.buyerProfileInfo}>
                <Text style={styles.buyerDisplayName} numberOfLines={1}>
                  {displayName}
                </Text>
                {userName ? (
                  <Text style={styles.buyerUserName} numberOfLines={1}>
                    @{userName}
                  </Text>
                ) : null}
                <View style={styles.buyerFollowRow}>
                  <Pressable onPress={() => onOpenFollowConnections?.('following')}>
                    <Text style={styles.buyerFollowText}>
                      <Text style={styles.buyerFollowValue}>{formatCount(stats.following)}</Text>
                      {' '}Đang theo dõi
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.buyerWalletInner, pressed && styles.buttonPressed]}
              onPress={() => onOpenWallet?.()}
            >
              <View style={styles.buyerWalletIcon}>
                <Ionicons name="wallet" size={18} color="#076F32" />
              </View>
              <View style={styles.buyerWalletInfo}>
                <Text style={styles.buyerWalletLabel}>Ví FastMark</Text>
                <Text style={styles.buyerWalletBalance}>
                  {formatPrice(profile?.walletBalance || 0)}
                </Text>
                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    onOpenWalletTopUp?.();
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.buyerWalletCta}>Nạp tiền ngay →</Text>
                </Pressable>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          </View>

          <View style={styles.buyerOrderStatsCard}>
            <BuyerOrderStatTile
              icon="bag-handle-outline"
              iconColor="#076F32"
              iconBg="#E6F4EC"
              title="Đơn hàng"
              value={
                isLoadingBuyerOrderStats ? '…' : formatCount(buyerOrderStats.total)
              }
              onPress={() => onOpenBuyerOrders?.(RESERVATION_TAB.ALL)}
            />
            <View style={styles.buyerOrderStatsDivider} />
            <BuyerOrderStatTile
              icon="bookmark-outline"
              iconColor="#c2410c"
              iconBg="#ffedd5"
              title="Giữ hàng"
              value={
                isLoadingBuyerOrderStats ? '…' : formatCount(buyerOrderStats.holding)
              }
              onPress={() => onOpenBuyerOrders?.(RESERVATION_TAB.HOLDING)}
            />
          </View>

          <View style={styles.buyerMenuCard}>
            {buyerMenuItems.map((item, index) => (
              <View key={item.key}>
                {index > 0 ? <View style={styles.buyerMenuDivider} /> : null}
                <BuyerMenuItem
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={item.onPress}
                />
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.buyerLogoutCard, pressed && styles.buttonPressed]}
            onPress={() => onLogout?.()}
          >
            <View style={styles.buyerLogoutIcon}>
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            </View>
            <View style={styles.buyerMenuCopy}>
              <Text style={styles.buyerLogoutText}>Đăng xuất</Text>
              <Text style={styles.buyerMenuSubtitle}>Đăng xuất khỏi tài khoản</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#f87171" />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: screenInsets.tabRootScrollPaddingBottom },
        ]}
      >
        <View style={styles.profileCard}>
          {showAsSeller ? (
            <View style={styles.profileTopBar}>
              <View style={styles.profileTopBarSpacer} />
              <Pressable
                onPress={() => setMenuOpen(true)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Tiện ích"
              >
                <Ionicons name="menu-outline" size={22} color="#0f172a" />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.profileHeaderRow}>
            <ProfileAvatar
              name={avatarLabelName}
              photoUrl={avatarUrl}
              onPress={handlePickAvatar}
              isUploading={isUploadingAvatar}
            />
            <View style={styles.profileHeaderInfo}>
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName}
              </Text>
              {userName ? (
                <Text style={styles.userName} numberOfLines={1}>
                  @{userName}
                </Text>
              ) : null}
              {showAsSeller && (shopContact?.categoryName || shopSettings?.categoryName) ? (
                <Text style={styles.businessCategoryLabel} numberOfLines={1}>
                  {shopContact?.categoryName || shopSettings?.categoryName}
                </Text>
              ) : null}
              {showAsSeller ? (
                <View style={styles.ratingRow}>
                  <StarRating rating={stats.rating || 0} size={14} showValue />
                  <Text style={styles.reviewCount}>
                    ({formatCount(stats.reviews)} đánh giá)
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {showShopDescription ? (
            isLoadingShopContact && !shopDescription ? (
              <ActivityIndicator color="#076F32" style={styles.contactLoading} />
            ) : (
              <Text style={styles.bioText}>{shopDescriptionText}</Text>
            )
          ) : null}

          <View style={styles.followRow}>
            <Pressable onPress={() => onOpenFollowConnections?.('following')}>
              <Text style={styles.followText}>
                <Text style={styles.followValue}>{formatCount(stats.following)}</Text> đang theo dõi
              </Text>
            </Pressable>
          </View>

          {showAsSeller ? (
            <View style={styles.shopStatsRow}>
              <View style={styles.shopStatItem}>
                <Text style={styles.shopStatValue}>{formatCount(stats.products)}</Text>
                <Text style={styles.shopStatLabel}>Sản phẩm</Text>
              </View>
              <View style={styles.shopStatItem}>
                <Text style={styles.shopStatValue}>{formatCount(stats.sold)}</Text>
                <Text style={styles.shopStatLabel}>Đã bán</Text>
              </View>
              <View style={styles.shopStatItem}>
                <Text style={styles.shopStatValue}>{formatCount(stats.likes)}</Text>
                <Text style={styles.shopStatLabel}>Lượt thích</Text>
              </View>
            </View>
          ) : null}

          {showAsSeller ? (
            <>
              <View style={styles.contactCard}>
                <Text style={styles.contactTitle}>Thông tin liên hệ</Text>
                {isLoadingShopContact ? (
                  <ActivityIndicator color="#076F32" style={styles.contactLoading} />
                ) : (
                  <>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactLabel}>SĐT</Text>
                      <Text style={styles.contactValue}>
                        {shopContact?.shopPhone || shopContact?.userPhone || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactLabel}>Địa chỉ</Text>
                      <Text style={styles.contactValue}>
                        {shopContact?.address || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactLabel}>Địa chỉ hệ thống</Text>
                      <Text style={styles.contactValue}>
                        {shopContact?.systemAddress || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactLabel}>Giờ mở cửa</Text>
                      <Text style={styles.contactValue}>
                        {shopContact?.openTime && shopContact?.closeTime
                          ? `${shopContact.openTime} - ${shopContact.closeTime}`
                          : 'Chưa cập nhật'}
                      </Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactLabel}>Trạng thái</Text>
                      <Text
                        style={[
                          styles.contactValue,
                          shopContact?.isOpen === 0 && styles.closedText,
                        ]}
                      >
                        {shopContact?.isOpen === 0 ? 'Đang đóng cửa' : 'Đang mở cửa'}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.sellerToolsRow}>
                <Pressable
                  onPress={() => onOpenSellerShopSettings?.()}
                  style={({ pressed }) => [
                    styles.sellerToolButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.sellerToolText}>Cài đặt shop</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenSellerSubscription?.()}
                  style={({ pressed }) => [
                    styles.sellerToolButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.sellerToolText}>Gói bán</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenSellerBanner?.()}
                  style={({ pressed }) => [
                    styles.sellerToolButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.sellerToolText}>Banner</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenSellerReviews?.()}
                  style={({ pressed }) => [
                    styles.sellerToolButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.sellerToolText}>Quản lý đánh giá</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {showAsSeller ? (
        <ProfileSideDrawer
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          displayName={displayName}
          userName={userName}
          photoUrl={avatarUrl}
          walletBalance={Number(profile?.walletBalance) || 0}
          sections={[
            {
              key: 'resources',
              title: 'Tài nguyên',
              items: [
                {
                  key: 'wallet',
                  icon: 'wallet-outline',
                  label: 'Ví FastMark',
                  onPress: () => onOpenWallet?.(),
                },
              ],
            },
            {
              key: 'shop',
              title: 'Công cụ gian hàng',
              items: [
                {
                  key: 'settings',
                  icon: 'storefront-outline',
                  label: 'Cài đặt cửa hàng',
                  onPress: () => onOpenSellerShopSettings?.(),
                },
                {
                  key: 'preview',
                  icon: 'eye-outline',
                  label: 'Chế độ xem',
                  onPress: () => onOpenBuyerView?.(),
                },
                {
                  key: 'switch-buyer',
                  icon: 'person-outline',
                  label: 'Chuyển sang người mua',
                  onPress: () => onSwitchToBuyerMode?.(),
                },
              ],
            },
            {
              key: 'account',
              title: 'Tài khoản',
              items: [
                {
                  key: 'edit',
                  icon: 'create-outline',
                  label: 'Sửa thông tin tài khoản',
                  onPress: () => onEditAccount?.(),
                },
                {
                  key: 'logout',
                  icon: 'log-out-outline',
                  label: 'Đăng xuất',
                  danger: true,
                  onPress: () => onLogout?.(),
                },
              ],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
    minHeight: 0,
  },
  buyerScreen: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    minHeight: 0,
  },
  buyerScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  buyerScrollContent: {
    paddingHorizontal: 16,
  },
  buyerHeaderRow: {
    marginBottom: 18,
  },
  buyerHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
  },
  buyerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  buyerHeroCard: {
    backgroundColor: '#E6F4EC',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  buyerWalletInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginTop: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#A7D9B8',
    paddingTop: 14,
  },
  buyerOrderStatsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8f0eb',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buyerOrderStatsDivider: {
    width: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  buyerOrderStatTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  buyerOrderStatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerOrderStatCopy: {
    flex: 1,
    minWidth: 0,
  },
  buyerOrderStatTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  buyerOrderStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
    lineHeight: 26,
  },
  buyerOrderStatSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  buyerProfileInfo: {
    flex: 1,
    minWidth: 0,
  },
  buyerDisplayName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  buyerUserName: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  buyerFollowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  buyerFollowText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  buyerFollowValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  buyerFollowDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#cbd5e1',
  },
  buyerWalletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#076F32',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
    shadowColor: '#076F32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  buyerWalletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerWalletInfo: {
    flex: 1,
    minWidth: 0,
  },
  buyerWalletLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  buyerWalletBalance: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 1,
  },
  buyerWalletCta: {
    marginTop: 2,
    color: '#076F32',
    fontSize: 12,
    fontWeight: '700',
  },
  buyerMenuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8f0eb',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  buyerMenuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 70,
  },
  buyerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  buyerMenuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerMenuCopy: {
    flex: 1,
    minWidth: 0,
  },
  buyerMenuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  buyerMenuSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  buyerLogoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 8,
  },
  buyerLogoutIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerLogoutText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#dc2626',
  },
  scrollContent: {
    paddingTop: 8,
  },
  profileCard: {
    marginTop: 0,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    position: 'relative',
  },
  profileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileTopBarSpacer: {
    flex: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconButtonText: {
    fontSize: 18,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 88,
    height: 88,
    marginRight: 14,
    position: 'relative',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e2e8f0',
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  avatarPlusButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarPlusText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: -1,
  },
  profileHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  personalNameHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  shopUsername: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
    marginBottom: 4,
  },
  businessCategoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  reviewCount: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  bioText: {
    marginTop: 14,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 21,
  },
  followRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  walletCard: {
    marginTop: 16,
    backgroundColor: t.primaryDark,
    borderRadius: 16,
    padding: 16,
  },
  walletCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  walletCardBalance: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 8,
  },
  walletCardCta: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '700',
  },
  buyerMenuList: {
    marginTop: 16,
    gap: 10,
  },
  buyerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  buyerMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerMenuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  buyerMenuLogout: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  buyerMenuLogoutIcon: {
    backgroundColor: '#fecaca',
  },
  buyerMenuLogoutText: {
    color: '#dc2626',
  },
  shopStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  shopStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  shopStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  shopStatLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  ordersEntry: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#c5e3df',
  },
  ordersEntryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#076F32',
  },
  followText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  followValue: {
    color: '#076F32',
    fontWeight: '900',
  },
  followDivider: {
    color: '#cbd5e1',
  },
  contactCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  contactLoading: {
    marginVertical: 8,
  },
  contactRow: {
    gap: 4,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 20,
  },
  closedText: {
    color: '#b91c1c',
  },
  sellerToolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  sellerShortcutBlock: {
    marginTop: 14,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sellerShortcutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  sellerHubCard: {
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#E6F4EC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sellerHubTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532d',
  },
  sellerHubSub: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: '#055528',
    lineHeight: 17,
  },
  sellerHubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sellerHubItem: {
    width: '47%',
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 8,
  },
  sellerHubItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#055528',
  },
  sellerToolButton: {
    minWidth: '30%',
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#A7D9B8',
    paddingHorizontal: 10,
  },
  sellerToolText: {
    color: '#076F32',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 16,
  },
  primaryActionButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#076F32',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#e5e7eb',
  },
  errorText: {
    marginHorizontal: 16,
    marginTop: 12,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  successText: {
    marginHorizontal: 16,
    marginTop: 12,
    color: '#076F32',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#076F32',
    fontWeight: '900',
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: '#076F32',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  likedSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productImageWrap: {
    height: 130,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  productStatsBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
  },
  productStatText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  productEmoji: {
    fontSize: 54,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  loadingProductsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  loadingProductsText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  discountBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  productName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 40,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  productPrice: {
    color: '#076F32',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  productOriginalPrice: {
    color: '#94a3b8',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  productSold: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  productDonVi: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  productSoldCount: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  dimmedImage: {
    opacity: 0.45,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderRadius: 12,
    zIndex: 3,
  },
  outOfStockText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  buyerCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  buyerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  buyerText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  modeSwitchButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  modeSwitchButtonAlt: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  modeSwitchButtonText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  modeSwitchButtonTextAlt: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '800',
  },
  registerButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadgePending: {
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statusBadgeRejected: {
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statusBadgeText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  verificationMeta: {
    width: '100%',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
    textAlign: 'left',
  },
  emptyLikedCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  emptyLikedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptyLikedText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
