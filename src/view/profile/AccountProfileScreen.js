import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthError,
  selectAuthProfile,
  selectAuthSuccessMessage,
  selectAuthUser,
  selectCanSwitchToSeller,
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { uploadUserAvatar, syncSellerAccess, loadUserProfile, applyShopSettingsToProfile } from '../../viewmodel/auth/authSlice';
import {
  getSellerRegisterButtonLabel,
} from '../seller/sellerRegistrationFlow';
import { getMyProductsOnBackend } from '../../api/productApi';
import { getSellerShopSettingsOnBackend, uploadSellerShopAvatarOnBackend } from '../../api/sellerOpsApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import StarRating from '../store/components/StarRating';
import BuyerQuickMenu from '../shared/components/BuyerQuickMenu';
import AvatarBadge from '../shared/components/AvatarBadge';

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
      >
        {isUploading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.avatarPlusText}>+</Text>
        )}
      </Pressable>
    </View>
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
  onOpenNotificationSettings,
  onOpenInbox,
  onOpenBuyerOrders,
  onOpenSellerShopSettings,
  onOpenSellerReviews,
  onOpenSellerOrders,
  onOpenSellerStats,
  onOpenBuyerView,
  onStartSellerRegister,
  onSwitchToSellerMode,
  onSwitchToBuyerMode,
  onLogout,
  onOpenFollowConnections,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const role = useSelector(selectUserRole);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const showAsSeller = profileMode === 'seller';
  const showAsBuyer = profileMode === 'buyer';
  const sellerVerification = useSelector(selectSellerVerification);
  const sellerButtonLabel = getSellerRegisterButtonLabel({ role, verification: sellerVerification });

  function handleSellerAction() {
    if (canSwitchToSeller) {
      onSwitchToSellerMode?.();
      return;
    }
    onStartSellerRegister?.();
  }
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [shopContact, setShopContact] = useState(null);
  const [isLoadingShopContact, setIsLoadingShopContact] = useState(false);

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

      const products = await getMyProductsOnBackend(idToken);
      setSellerProducts(products.map(mapApiProductToCard));
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

  const displayName = profile?.fullName || user?.displayName || 'Fastmark user';
  const userName = profile?.userName || user?.email?.split('@')[0] || '';
  const personalAvatarUrl = resolveImageUrl(profile?.photoUrl) || resolveImageUrl(user?.photoURL);
  const shopAvatarUrl = resolveImageUrl(
    shopContact?.avatar ||
      shopContact?.shopAvatar ||
      shopSettings?.avatar ||
      shopSettings?.shopAvatar ||
      profile?.shopAvatar
  );
  // Buyer avt (User.Avatar) và shop avt (ShopProfile.avatar) tách hoàn toàn — không fallback lẫn nhau.
  const avatarUrl = showAsSeller ? shopAvatarUrl : personalAvatarUrl;
  const shopDisplayName = shopContact?.shopName || shopSettings?.shopName || profile?.shopName || '';
  const avatarLabelName = showAsSeller ? shopDisplayName || displayName : displayName;

  const shopDescription = pickShopDescription(
    shopSettings?.description,
    shopSettings?.shopDescription,
    shopContact?.description,
    shopContact?.shopDescription,
    profile?.shopDescription
  );
  // Shop tiểu sử chỉ hiện ở chế độ người bán — không gắn vào tài khoản cá nhân.
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
      products: showAsSeller ? catalogStats.products : profile?.totalProducts ?? 0,
      sold: profile?.soldCount ?? 0,
      likes: showAsSeller ? catalogStats.likes : profile?.likesCount ?? 0,
      reviews: profile?.totalReviews ?? 0,
      rating: profile?.averageRating ?? 0,
      following: profile?.followingCount ?? 0,
      followers: profile?.followersCount ?? 0,
    }),
    [catalogStats, showAsSeller, profile]
  );

  async function handlePickAvatar() {
    try {
      setLocalError('');
      setLocalSuccess('');
      const picked = await pickImageBase64();
      if (!picked) {
        return;
      }

      setIsUploadingAvatar(true);

      if (showAsSeller) {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          throw new Error('Phiên đăng nhập đã hết hạn.');
        }

        const result = await uploadSellerShopAvatarOnBackend({
          idToken,
          imageBase64: picked.imageBase64,
          mimeType: picked.mimeType,
        });
        const shop = result?.shop;
        if (shop) {
          setShopContact(shop);
          dispatch(applyShopSettingsToProfile(shop));
        }
        setLocalSuccess(result?.message || 'Cập nhật ảnh gian hàng thành công.');
        return;
      }

      await dispatch(
        uploadUserAvatar({
          imageBase64: picked.imageBase64,
          mimeType: picked.mimeType,
        })
      ).unwrap();
    } catch (pickError) {
      setLocalError(
        typeof pickError === 'string'
          ? pickError
          : pickError?.message || 'Không upload được avatar.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const feedbackMessage = localError || error;
  const feedbackSuccess = localSuccess || successMessage;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.profileTopBar}>
            <View style={styles.profileTopBarSpacer} />
            {showAsSeller ? (
              <Pressable
                onPress={() => setMenuOpen((current) => !current)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Tiện ích"
              >
                <Ionicons name="menu-outline" size={22} color="#0f172a" />
              </Pressable>
            ) : (
              <BuyerQuickMenu
                sellerButtonLabel={sellerButtonLabel}
                onEditAccount={() => onEditAccount?.()}
                onSellerAction={handleSellerAction}
                onLogout={() => onLogout?.()}
                style={styles.buyerMenuWrap}
                buttonStyle={styles.iconButton}
              />
            )}
          </View>

          {menuOpen && showAsSeller ? (
            <View style={styles.menuDropdown}>
              {showAsSeller ? (
                <>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onOpenSellerShopSettings?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Cài đặt cửa hàng</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onOpenBuyerView?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Chế độ xem</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onSwitchToBuyerMode?.();
                    }}
                    style={[styles.menuItem, styles.menuItemLast]}
                  >
                    <Text style={styles.menuItemText}>Chuyển sang người mua</Text>
                  </Pressable>
                </>
              ) : null}
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
                {showAsSeller && shopDisplayName ? shopDisplayName : displayName}
              </Text>
              {showAsSeller && shopDisplayName ? (
                <Text style={styles.personalNameHint} numberOfLines={1}>
                  Chủ shop: {displayName}
                </Text>
              ) : null}
              {userName ? (
                <Text style={styles.userName} numberOfLines={1}>
                  @{userName}
                </Text>
              ) : null}
              {showAsSeller && (shopContact?.shopUsername || shopSettings?.shopUsername) ? (
                <Text style={styles.shopUsername} numberOfLines={1}>
                  Shop: @{shopContact?.shopUsername || shopSettings?.shopUsername}
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
              <ActivityIndicator color="#0d7377" style={styles.contactLoading} />
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
            <Text style={styles.followDivider}>•</Text>
            <Pressable onPress={() => onOpenFollowConnections?.('followers')}>
              <Text style={styles.followText}>
                <Text style={styles.followValue}>{formatCount(stats.followers)}</Text> người theo dõi
              </Text>
            </Pressable>
          </View>

          {showAsBuyer ? (
            <Pressable
              onPress={onOpenBuyerOrders}
              style={({ pressed }) => [styles.ordersEntry, pressed && styles.buttonPressed]}
            >
              <Text style={styles.ordersEntryText}>Đơn hàng của bạn</Text>
            </Pressable>
          ) : null}

          {showAsSeller ? (
            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>Thông tin liên hệ</Text>
              {isLoadingShopContact ? (
                <ActivityIndicator color="#0d7377" style={styles.contactLoading} />
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
                    <Text style={[styles.contactValue, shopContact?.isOpen === 0 && styles.closedText]}>
                      {shopContact?.isOpen === 0 ? 'Đang đóng cửa' : 'Đang mở cửa'}
                    </Text>
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
              )}
            </View>
          ) : null}

          {showAsBuyer ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={onEditAccount}
                style={({ pressed }) => [styles.primaryActionButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.primaryActionText}>Chỉnh sửa hồ sơ</Text>
              </Pressable>
              <Pressable
                onPress={handleSellerAction}
                style={({ pressed }) => [styles.secondaryActionButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.secondaryActionText}>{sellerButtonLabel}</Text>
              </Pressable>
            </View>
          ) : null}

          {showAsSeller ? (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCount(stats.products)}</Text>
                <Text style={styles.statLabel}>TỔNG SẢN PHẨM</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCount(stats.sold)}</Text>
                <Text style={styles.statLabel}>ĐÃ BÁN</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCount(stats.likes)}</Text>
                <Text style={styles.statLabel}>TỔNG LƯỢT THÍCH</Text>
              </View>
            </View>
          ) : null}
        </View>

        {feedbackMessage ? <Text style={styles.errorText}>{feedbackMessage}</Text> : null}
        {feedbackSuccess ? <Text style={styles.successText}>{feedbackSuccess}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
    minHeight: 0,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 28,
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
  buyerMenuWrap: {
    position: 'relative',
  },
  iconButtonText: {
    fontSize: 18,
  },
  menuDropdown: {
    position: 'absolute',
    top: 58,
    right: 18,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 220,
    zIndex: 20,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  menuItemDanger: {
    color: '#b91c1c',
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 78,
    height: 78,
    marginRight: 14,
    position: 'relative',
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#e2e8f0',
  },
  avatarFallback: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#0d7377',
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
    backgroundColor: '#0d7377',
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
    color: '#0d7377',
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
  ordersEntry: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#e8f3f1',
    borderWidth: 1,
    borderColor: '#c5e3df',
  },
  ordersEntryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d7377',
  },
  followText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  followValue: {
    color: '#0d7377',
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
    marginTop: 14,
  },
  sellerToolButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sellerToolText: {
    color: '#0d7377',
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
    backgroundColor: '#0d7377',
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
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: '#0d7377',
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
    color: '#0d7377',
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
    color: '#047857',
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
    color: '#0d7377',
    fontWeight: '900',
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: '#0d7377',
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
    color: '#0d7377',
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
    backgroundColor: '#ecfdf5',
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
    color: '#047857',
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
    backgroundColor: '#0d7377',
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
