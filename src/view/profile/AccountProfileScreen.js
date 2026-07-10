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
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthError,
  selectAuthProfile,
  selectAuthSuccessMessage,
  selectAuthUser,
  selectIsSeller,
  selectSellerVerification,
} from '../../viewmodel/auth/authSelectors';
import { uploadUserAvatar, syncSellerAccess, loadUserProfile, applyShopSettingsToProfile } from '../../viewmodel/auth/authSlice';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import { getMyProductsOnBackend } from '../../api/productApi';
import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import StarRating from '../store/components/StarRating';
import {
  LikedProductTabIcon,
  SellerProductTabIcon,
} from './ProfileTabIcons';

const PROFILE_TABS = [
  {
    key: 'catalog',
    buyerLabel: 'Mặt hàng gần bạn',
    sellerLabel: 'Danh mục',
    Icon: SellerProductTabIcon,
  },
  { key: 'liked', label: 'Sản phẩm đã thích', Icon: LikedProductTabIcon },
];

const DEMO_LIKED_PRODUCTS = [
  {
    id: 'liked-1',
    name: 'Cam sành Tiền Giang',
    price: 35000,
    sold: 420,
    emoji: '🍊',
  },
  {
    id: 'liked-2',
    name: 'Rau muống sạch buổi sáng',
    price: 12000,
    sold: 210,
    emoji: '🥬',
  },
];

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

function getSellerRegisterButtonLabel({ isSeller, sellerVerification }) {
  if (isSeller) {
    return 'Chuyển sang người bán';
  }

  if (sellerVerification?.status === SELLER_VERIFICATION_STATUS.PENDING) {
    return 'Xem hồ sơ chờ duyệt';
  }

  if (sellerVerification?.status === SELLER_VERIFICATION_STATUS.REJECTED) {
    return 'Chỉnh sửa hồ sơ đăng ký';
  }

  return 'Đăng ký người bán';
}

function formatVerificationDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('vi-VN');
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

import { formatPriceRange } from '../../core/utils/productFormat';

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

function ProductCard({ product, onPress }) {
  const priceLabel = formatPriceRange(
    product.minPrice ?? product.price,
    product.maxPrice ?? product.originalPrice ?? product.price
  );
  const isOutOfStock = Boolean(product.isOutOfStock);

  const content = (
    <>
      <View style={styles.productImageWrap}>
        <View style={styles.productStatsBadge}>
          <Text style={styles.productStatText}>👁 {product.viewCount || 0}</Text>
          <Text style={styles.productStatText}>♥ {product.likeCount || 0}</Text>
        </View>
        {product.thumbnail ? (
          <Image
            source={{ uri: product.thumbnail }}
            style={[styles.productImage, isOutOfStock && styles.dimmedImage]}
          />
        ) : (
          <Text style={[styles.productEmoji, isOutOfStock && styles.dimmedImage]}>
            {product.emoji || '📦'}
          </Text>
        )}
        {isOutOfStock ? (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Hết hàng</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <Text
        style={styles.productPrice}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {priceLabel}
      </Text>
      <View style={styles.productMetaRow}>
        <Text style={styles.productDonVi} numberOfLines={1}>
          {product.donVi || '—'}
        </Text>
        <Text style={styles.productSoldCount} numberOfLines={1}>
          Đã bán: {product.soldCount || 0}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.productCard, pressed && styles.buttonPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.productCard}>{content}</View>;
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
  const initial = (name || 'U').charAt(0).toUpperCase();
  const [imageError, setImageError] = useState(false);
  const resolvedUrl = resolveImageUrl(photoUrl);

  useEffect(() => {
    setImageError(false);
  }, [resolvedUrl]);

  return (
    <View style={styles.avatarWrap}>
      {resolvedUrl && !imageError ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={styles.avatarImage}
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{initial}</Text>
        </View>
      )}
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
  onOpenSellerShopSettings,
  onOpenSellerOrders,
  onOpenSellerStats,
  onStartSellerRegister,
  onSwitchToSellerMode,
  onSwitchToBuyerMode,
  canSwitchToSeller = false,
  onLogout,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const isSeller = useSelector(selectIsSeller);
  const showAsSeller = profileMode === 'seller';
  const showAsBuyer = profileMode === 'buyer';
  const sellerVerification = useSelector(selectSellerVerification);
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);
  const [activeTab, setActiveTab] = useState('catalog');
  const [menuOpen, setMenuOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState('');
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

    setIsLoadingProducts(true);
    setProductsError('');

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const products = await getMyProductsOnBackend(idToken);
      setSellerProducts(products.map(mapApiProductToCard));
      await dispatch(syncSellerAccess());
    } catch (loadError) {
      setProductsError(loadError.message || 'Không tải được sản phẩm.');
      setSellerProducts([]);
    } finally {
      setIsLoadingProducts(false);
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
    dispatch(syncSellerAccess());
  }, [
    dispatch,
    isProfileVisible,
    showAsSeller,
    loadSellerProducts,
    loadShopContact,
    productRefreshKey,
    shopContactRefreshKey,
  ]);

  useEffect(() => {
    if (!isSeller) {
      dispatch(syncSellerAccess());
    }
  }, [dispatch, isSeller, profile?.role]);

  const displayName = profile?.fullName || user?.displayName || 'Fastmark user';
  const userName = profile?.userName || user?.email?.split('@')[0] || '';
  const avatarUrl = resolveImageUrl(profile?.photoUrl) || resolveImageUrl(user?.photoURL);

  const shopDescription = pickShopDescription(
    shopSettings?.description,
    shopSettings?.shopDescription,
    shopContact?.description,
    shopContact?.shopDescription,
    profile?.shopDescription
  );
  const showShopDescription = showAsSeller || Boolean(shopDescription);
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

  const visibleProducts = useMemo(() => {
    if (activeTab === 'liked') {
      return DEMO_LIKED_PRODUCTS;
    }

    return showAsSeller ? sellerProducts : [];
  }, [activeTab, showAsSeller, sellerProducts]);

  function renderCatalogTab() {
    if (showAsSeller) {
      if (isLoadingProducts && sellerProducts.length === 0) {
        return (
          <View style={styles.loadingProductsWrap}>
            <ActivityIndicator color="#0d7377" />
            <Text style={styles.loadingProductsText}>Đang tải sản phẩm...</Text>
          </View>
        );
      }

      if (productsError && sellerProducts.length === 0) {
        return (
          <View style={styles.emptyLikedCard}>
            <Text style={styles.emptyLikedTitle}>Không tải được sản phẩm</Text>
            <Text style={styles.emptyLikedText}>{productsError}</Text>
            <Pressable
              onPress={loadSellerProducts}
              style={({ pressed }) => [styles.registerButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.registerButtonText}>Thử lại</Text>
            </Pressable>
          </View>
        );
      }

      if (sellerProducts.length === 0) {
        return (
          <View style={styles.emptyLikedCard}>
            <Text style={styles.emptyLikedTitle}>Chưa có sản phẩm</Text>
            <Text style={styles.emptyLikedText}>
              Hãy vào tab Sản phẩm để đăng sản phẩm đầu tiên của bạn.
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.productGrid}>
          {sellerProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() => onOpenProduct?.(product.id)}
            />
          ))}
        </View>
      );
    }

    return (
      <View style={styles.buyerCard}>
        {sellerVerification?.status === SELLER_VERIFICATION_STATUS.PENDING ? (
          <>
            <View style={styles.statusBadgePending}>
              <Text style={styles.statusBadgeText}>Đang chờ duyệt</Text>
            </View>
            <Text style={styles.buyerTitle}>Hồ sơ đang được xem xét</Text>
            <Text style={styles.buyerText}>
              Admin đang duyệt hồ sơ của bạn. Bạn có thể xem lại và chỉnh sửa hồ sơ trước khi được duyệt.
            </Text>
            {sellerVerification.submittedAt ? (
              <Text style={styles.verificationMeta}>
                Gửi lúc: {formatVerificationDate(sellerVerification.submittedAt)}
              </Text>
            ) : null}
            {sellerVerification.address ? (
              <Text style={styles.verificationMeta}>Địa chỉ: {sellerVerification.address}</Text>
            ) : null}
            <Pressable
              onPress={onStartSellerRegister}
              style={({ pressed }) => [styles.registerButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.registerButtonText}>Xem và chỉnh sửa hồ sơ</Text>
            </Pressable>
          </>
        ) : sellerVerification?.status === SELLER_VERIFICATION_STATUS.REJECTED ? (
          <>
            <View style={styles.statusBadgeRejected}>
              <Text style={styles.statusBadgeText}>Bị từ chối</Text>
            </View>
            <Text style={styles.buyerTitle}>Hồ sơ bị từ chối</Text>
            <Text style={styles.buyerText}>
              {sellerVerification.lyDoTuChoi ||
                'Hồ sơ đăng ký người bán chưa đạt yêu cầu. Vui lòng chỉnh sửa và gửi lại.'}
            </Text>
            <Pressable
              onPress={onStartSellerRegister}
              style={({ pressed }) => [styles.registerButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.registerButtonText}>Chỉnh sửa và gửi lại</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.buyerTitle}>Cần đăng ký người bán</Text>
            <Text style={styles.buyerText}>
              {profile?.sellerPhoneVerified
                ? 'Số điện thoại đã xác minh. Hãy gửi hồ sơ CCCD và địa chỉ. Sau khi admin duyệt, danh mục sản phẩm của bạn sẽ hiển thị tại đây.'
                : 'Bạn cần đăng ký tài khoản người bán để mở danh mục sản phẩm và đăng tin bán hàng.'}
            </Text>
            <Pressable
              onPress={onStartSellerRegister}
              style={({ pressed }) => [styles.registerButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.registerButtonText}>
                {profile?.sellerPhoneVerified ? 'Tiếp tục đăng ký' : 'Đăng ký người bán hàng'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  function renderLikedTab() {
    if (visibleProducts.length > 0) {
      return (
        <View style={styles.productGrid}>
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>
      );
    }

    return (
      <View style={styles.likedSection}>
        <View style={styles.emptyLikedCard}>
          <Text style={styles.emptyLikedTitle}>Chưa có sản phẩm đã thích</Text>
          <Text style={styles.emptyLikedText}>
            Hãy thích sản phẩm khi mua sắm để xem lại tại đây.
          </Text>
        </View>
      </View>
    );
  }

  async function handlePickAvatar() {
    try {
      setLocalError('');
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
    } catch (pickError) {
      setLocalError(typeof pickError === 'string' ? pickError : 'Không upload được avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const feedbackMessage = localError || error;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.profileTopBar}>
            <View style={styles.profileTopBarSpacer} />
            <Pressable
              onPress={() => setMenuOpen((current) => !current)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.iconButtonText}>⚙</Text>
            </Pressable>
          </View>

          {menuOpen ? (
            <View style={styles.menuDropdown}>
              {showAsSeller ? (
                <>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onOpenSellerStats?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Thống kê</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onOpenSellerOrders?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Quản lý đơn hàng</Text>
                  </Pressable>
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
                      onSwitchToBuyerMode?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Chuyển sang người mua</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onEditAccount?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Sửa thông tin tài khoản</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onOpenActivity?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Hoạt động của tôi</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onOpenNotificationSettings?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Cài đặt thông báo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMenuOpen(false);
                      onLogout?.();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={[styles.menuItemText, styles.menuItemDanger]}>Đăng xuất</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.profileHeaderRow}>
            <ProfileAvatar
              name={displayName}
              photoUrl={avatarUrl}
              onPress={handlePickAvatar}
              isUploading={isUploadingAvatar}
            />
            <View style={styles.profileHeaderInfo}>
              <Text style={styles.displayName} numberOfLines={1}>
                {showAsSeller && (shopContact?.shopName || shopSettings?.shopName)
                  ? shopContact?.shopName || shopSettings?.shopName
                  : displayName}
              </Text>
              {showAsSeller && (shopContact?.shopName || shopSettings?.shopName) ? (
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
            <Text style={styles.followText}>
              <Text style={styles.followValue}>{formatCount(stats.following)}</Text> đang theo dõi
            </Text>
            <Text style={styles.followDivider}>•</Text>
            <Text style={styles.followText}>
              <Text style={styles.followValue}>{formatCount(stats.followers)}</Text> người theo dõi
            </Text>
          </View>

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
                </>
              )}
            </View>
          ) : null}

          {showAsSeller ? (
            <View style={styles.sellerToolsRow}>
              <Pressable
                onPress={onOpenSellerStats}
                style={({ pressed }) => [styles.sellerToolButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.sellerToolText}>Thống kê</Text>
              </Pressable>
              <Pressable
                onPress={onOpenSellerOrders}
                style={({ pressed }) => [styles.sellerToolButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.sellerToolText}>Quản lý đơn</Text>
              </Pressable>
              <Pressable
                onPress={onOpenSellerShopSettings}
                style={({ pressed }) => [styles.sellerToolButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.sellerToolText}>Cài đặt shop</Text>
              </Pressable>
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
                onPress={onOpenInbox}
                style={({ pressed }) => [styles.secondaryActionButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.secondaryActionText}>💬 Nhắn tin</Text>
              </Pressable>
            </View>
          ) : null}

          {showAsBuyer ? (
            <Pressable
              onPress={isSeller ? onSwitchToSellerMode : onStartSellerRegister}
              style={({ pressed }) => [styles.modeSwitchButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.modeSwitchButtonText}>
                {getSellerRegisterButtonLabel({ isSeller, sellerVerification })}
              </Text>
            </Pressable>
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
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        {!showAsSeller ? (
          <>
            <View style={styles.tabBar}>
              {PROFILE_TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const color = isActive ? '#0d7377' : '#94a3b8';
                const TabIcon = tab.Icon;

                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    style={styles.tabItem}
                  >
                    <TabIcon color={color} size={22} filled={isActive} />
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {showAsBuyer ? tab.buyerLabel || tab.label : tab.sellerLabel || tab.label}
                    </Text>
                    {isActive ? <View style={styles.tabIndicator} /> : null}
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'catalog' ? renderCatalogTab() : renderLikedTab()}
          </>
        ) : null}
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
    paddingTop: 52,
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
    flexGrow: 1,
    flexBasis: '30%',
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
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryActionButton: {
    flex: 1,
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
    flex: 1,
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
