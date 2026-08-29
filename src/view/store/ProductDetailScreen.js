import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';

import { formatPrice, formatPriceRange, getProductPromoPriceLabels, getPromotionalUnitPrice } from '../../core/utils/productFormat';
import { resolveIsOutOfStock } from '../../core/utils/productAvailability';
import {
  formatDistance,
  getDistanceFromCurrentLocation,
  hasValidLocation,
  normalizeExpoLocation,
} from '../../core/utils/geo';
import { getPhoneGateStep } from '../../core/utils/phoneVerification';
import { callStore } from '../../core/utils/storeContact';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { deleteProductOnBackend } from '../../api/productApi';
import SellerProductDetailScreen from '../seller/SellerProductDetailScreen';
import { loadProductById, loadStoreById } from '../../viewmodel/store/storeViewModel';
import { submitReportOnBackend } from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import ReservationScreen from '../buyer/ReservationScreen';
import ReportSheet from '../shared/components/ReportSheet';
import ReportComposeModal from '../shared/components/ReportComposeModal';
import OutOfStockOverlay from '../shared/components/OutOfStockOverlay';
import SubScreenHeader, { APP_HEADER_ICON_BUTTON_STYLE } from '../shared/components/SubScreenHeader';
import AvatarBadge from '../shared/components/AvatarBadge';
import PhoneVerifyGateFlow from '../shared/PhoneVerifyGateFlow';
import { storeLogger as log } from '../../core/utils/logger';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import { toReservationFormResume } from '../../viewmodel/buyer/reservationResumeSession';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 320;
export default function ProductDetailScreen({
  productId,
  onBack,
  onStorePress,
  onReserve,
  onOrderSuccess,
  onOpenTopUp,
  resumeReserveRequest = null,
  onResumeReserveConsumed,
  /** home | map | products | profile */
  reservationSource = 'home',
  reservationStoreId = null,
}) {
  const insets = useScreenInsets();
  const profile = useSelector(selectAuthProfile);
  const galleryRef = useRef(null);
  const pendingTradeActionRef = useRef(null);
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [composeVisible, setComposeVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const pendingTopUpResume =
    resumeReserveRequest?.fromTopUp && resumeReserveRequest?.at
      ? resumeReserveRequest
      : null;
  const [reserveModalVisible, setReserveModalVisible] = useState(
    () => Boolean(pendingTopUpResume && !onReserve)
  );
  const [actionVariantId, setActionVariantId] = useState(
    () => pendingTopUpResume?.variantId || null
  );
  const [phoneGateVisible, setPhoneGateVisible] = useState(false);
  const [quantity, setQuantity] = useState(() =>
    Math.max(1, Number(pendingTopUpResume?.quantity) || 1)
  );
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [originLocation, setOriginLocation] = useState(null);
  const [showOwnerEdit, setShowOwnerEdit] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [reservationFormResume, setReservationFormResume] = useState(() =>
    toReservationFormResume(pendingTopUpResume)
  );

  const currentUserId = String(profile?.mongoUserId || profile?.id || '');
  const ownerUserId = String(store?.owner_user_id || '');
  const isProductOwner = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);

  useEffect(() => {
    if (!resumeReserveRequest?.at) {
      return;
    }

    const variantId = resumeReserveRequest.variantId || null;
    const qty = Math.max(1, Number(resumeReserveRequest.quantity) || 1);
    const formResume = toReservationFormResume(resumeReserveRequest);

    if (resumeReserveRequest.fromTopUp) {
      if (formResume) {
        setReservationFormResume(formResume);
      }
      if (variantId) {
        setSelectedVariantId(variantId);
        setActionVariantId(variantId);
      }
      setQuantity(qty);

      if (onReserve) {
        if (!product || loading) {
          return;
        }
        const variantForAction = variantId
          ? (product.variants || []).find((v) => String(v.id) === String(variantId))
          : null;
        onReserve(product, store, variantForAction);
        onResumeReserveConsumed?.();
        return;
      }

      setReserveModalVisible(true);
      onResumeReserveConsumed?.();
      return;
    }

    if (!product || loading) {
      return;
    }
    if (variantId) {
      setSelectedVariantId(variantId);
      setActionVariantId(variantId);
    }
    setQuantity(qty);
    if (formResume) {
      setReservationFormResume(formResume);
    }
    if (onReserve) {
      const variantForAction = variantId
        ? (product.variants || []).find((v) => String(v.id) === String(variantId))
        : null;
      onReserve(product, store, variantForAction);
    } else {
      setReserveModalVisible(true);
    }
    onResumeReserveConsumed?.();
  }, [resumeReserveRequest?.at, resumeReserveRequest?.fromTopUp, product?.id, loading]);

  useEffect(() => {
    let isCurrent = true;
    const normalizedProductId = String(productId || '').trim();
    setLoading(true);
    setSelectedVariantId(null);
    setActiveImageIndex(0);

    if (!normalizedProductId) {
      setProduct(null);
      setStore(null);
      setLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    log.info('ProductDetailScreen:load', { productId: normalizedProductId });

    loadProductById(normalizedProductId)
      .then(async (productData) => {
        if (!isCurrent) return;
        setProduct(productData);
        setLikeCount(Number(productData?.likeCount) || 0);
        if (productData?.store_id) {
          const storeData = await loadStoreById(productData.store_id);
          if (isCurrent) setStore(storeData);
        }
        log.ok('ProductDetailScreen:loaded', {
          productId: normalizedProductId,
          found: Boolean(productData),
          storeId: productData?.store_id || null,
        });
        setLoading(false);
      })
      .catch((error) => {
        log.fail('ProductDetailScreen:load-failed', error);
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [productId, reloadTick]);

  useEffect(() => {
    let active = true;

    async function loadFavoriteState() {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken || !active) {
          return;
        }
        const productIds = await getFavoriteProductIdsOnBackend(idToken);
        if (!active) {
          return;
        }
        setIsLiked((productIds || []).some((id) => String(id) === String(productId)));
      } catch {
        // Ignore favorite preload errors.
      }
    }

    loadFavoriteState();
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;

    async function loadOriginLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') {
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) {
          return;
        }
        setOriginLocation(normalizeExpoLocation(current));
      } catch {
        // Distance is optional when location is unavailable.
      }
    }

    loadOriginLocation();
    return () => {
      active = false;
    };
  }, []);

  const distanceMeters = useMemo(() => {
    if (!store || !hasValidLocation(originLocation)) {
      return Number.isFinite(Number(product?.distanceMeters))
        ? Number(product.distanceMeters)
        : Number.isFinite(Number(store?.distance_meters))
          ? Number(store.distance_meters)
          : null;
    }

    return (
      getDistanceFromCurrentLocation(originLocation, {
        latitude: store.latitude,
        longitude: store.longitude,
      }) ??
      (Number.isFinite(Number(product?.distanceMeters))
        ? Number(product.distanceMeters)
        : Number.isFinite(Number(store?.distance_meters))
          ? Number(store.distance_meters)
          : null)
    );
  }, [
    store,
    product?.distanceMeters,
    originLocation?.latitude,
    originLocation?.longitude,
  ]);

  const variants = product?.variants || [];

  const selectedVariant = useMemo(
    () => variants.find((variant) => String(variant.id) === String(selectedVariantId)) || null,
    [variants, selectedVariantId]
  );

  const totalRemaining = useMemo(
    () =>
      variants.reduce((sum, variant) => {
        const quantity = Number(variant.quantity) || 0;
        return sum + Math.max(0, quantity);
      }, 0),
    [variants]
  );

  const displayRemaining = selectedVariant
    ? Math.max(0, Number(selectedVariant.quantity) || 0)
    : totalRemaining;

  const displaySold = selectedVariant
    ? Math.max(0, Number(selectedVariant.soldCount) || 0)
    : Math.max(0, Number(product?.soldCount) || 0);

  const maxQuantity = Math.max(0, displayRemaining);

  useEffect(() => {
    if (!product || selectedVariantId) {
      return;
    }
    if (variants.length === 1 && (Number(variants[0].quantity) || 0) > 0) {
      setSelectedVariantId(String(variants[0].id));
    }
  }, [product, variants, selectedVariantId]);

  useEffect(() => {
    if (maxQuantity <= 0) {
      setQuantity(0);
      return;
    }
    setQuantity((prev) => Math.max(1, Math.min(Number(prev) || 1, maxQuantity)));
  }, [maxQuantity, selectedVariantId]);

  const requiresVariantSelection = variants.length > 0;

  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    // Nhiều biến thể + đã chọn: gallery 1 ảnh biến thể. Một biến thể → gallery sản phẩm.
    if (selectedVariant && variants.length > 1) {
      const variantUrl =
        selectedVariant.imageUrl ||
        selectedVariant.images?.[0]?.imageUrl ||
        '';
      if (variantUrl) {
        return [variantUrl];
      }
    }

    // Một biến thể hoặc chưa chọn: gallery ảnh sản phẩm (Product.images).
    // Bỏ ảnh trùng để key theo URL luôn duy nhất (không cần dùng index).
    const productGallery = Array.isArray(product.thumbnails)
      ? Array.from(new Set(product.thumbnails.filter(Boolean)))
      : [];
    if (productGallery.length > 0) {
      return productGallery;
    }

    if (product.thumbnail) {
      return [product.thumbnail];
    }

    return [];
  }, [product, selectedVariant, variants.length]);

  const priceLabel = useMemo(() => {
    if (!product) {
      return '';
    }

    if (selectedVariant) {
      return formatPrice(getPromotionalUnitPrice(product, selectedVariant.price));
    }

    if (product.isPromotion && Number(product.discountPercent) > 0) {
      return getProductPromoPriceLabels(product).saleLabel;
    }

    return formatPriceRange(
      product.minPrice ?? product.price,
      product.maxPrice ?? product.price
    );
  }, [product, selectedVariant]);

  const originalPriceLabel = useMemo(() => {
    if (!product?.isPromotion || !(Number(product.discountPercent) > 0)) {
      return '';
    }
    if (selectedVariant) {
      return formatPrice(selectedVariant.price);
    }
    return getProductPromoPriceLabels(product).originalLabel;
  }, [product, selectedVariant]);

  const discountPercentLabel =
    product?.isPromotion && Number(product.discountPercent) > 0
      ? `-${Number(product.discountPercent)}%`
      : '';

  function handleSelectVariant(variant) {
    if (product?.isUnavailable) {
      return;
    }
    if ((Number(variant.quantity) || 0) <= 0) {
      return;
    }

    if (String(selectedVariantId) === String(variant.id)) {
      setSelectedVariantId(null);
      setActiveImageIndex(0);
      galleryRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }

    setSelectedVariantId(String(variant.id));
    setActiveImageIndex(0);
    galleryRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function resolveActionVariant() {
    if (selectedVariant) {
      return selectedVariant;
    }
    return null;
  }

  function runWithPhoneGate(action) {
    if (!getPhoneGateStep(profile)) {
      action();
      return;
    }
    pendingTradeActionRef.current = action;
    setPhoneGateVisible(true);
  }

  function getReserveBlockAlert() {
    if (product?.isUnavailable || Number(product?.status) === 0) {
      return {
        title: 'Không có sẵn',
        message: 'Sản phẩm này đã bị người bán xóa hoặc ẩn.',
      };
    }

    const variantForAction = resolveActionVariant();
    const hasVariantStock = variants.some((variant) => (Number(variant.quantity) || 0) > 0);

    if (variants.length > 0) {
      if (totalRemaining <= 0 || !hasVariantStock) {
        return {
          title: 'Hết hàng',
          message: 'Sản phẩm này đã hết hàng. Vui lòng chọn sản phẩm khác.',
        };
      }
      if (variantForAction && (Number(variantForAction.quantity) || 0) <= 0) {
        return {
          title: 'Hết hàng',
          message: 'Phân loại này đã hết hàng. Vui lòng chọn phân loại khác.',
        };
      }
      if (requiresVariantSelection && !variantForAction) {
        return {
          title: 'Chọn biến thể',
          message: 'Vui lòng chọn phân loại sản phẩm trước khi giữ hàng.',
        };
      }
      return null;
    }

    if (resolveIsOutOfStock(product) || maxQuantity <= 0) {
      return {
        title: 'Hết hàng',
        message: 'Sản phẩm này đã hết hàng. Vui lòng chọn sản phẩm khác.',
      };
    }

    return null;
  }

  function openReserveFlow() {
    const blockAlert = getReserveBlockAlert();
    if (blockAlert) {
      Alert.alert(blockAlert.title, blockAlert.message);
      return;
    }
    const variantForAction = resolveActionVariant();
    runWithPhoneGate(() => {
      if (onReserve) {
        onReserve(product, store, variantForAction);
        return;
      }
      setActionVariantId(variantForAction?.id || null);
      setReserveModalVisible(true);
    });
  }

  function handleReservePress() {
    openReserveFlow();
  }

  async function handleToggleLike() {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((current) => Math.max(0, current + (wasLiked ? -1 : 1)));

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        setIsLiked(wasLiked);
        setLikeCount((current) => Math.max(0, current + (wasLiked ? 1 : -1)));
        Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để thích sản phẩm.');
        return;
      }

      if (wasLiked) {
        await removeFavoriteProductOnBackend(idToken, product.id);
      } else {
        await addFavoriteProductOnBackend({ idToken, productId: product.id });
      }
    } catch {
      setIsLiked(wasLiked);
      setLikeCount((current) => Math.max(0, current + (wasLiked ? 1 : -1)));
    }
  }

  function handleMenuPress() {
    setReportVisible(true);
  }

  function handleCallPress() {
    callStore(store?.phone);
  }

  if (reserveModalVisible) {
    return (
      <ReservationScreen
        loading={loading}
        loadError={!loading && !product ? 'Không tải được thông tin sản phẩm.' : null}
        product={product}
        store={store}
        preselectedVariantId={actionVariantId}
        initialQuantity={quantity > 0 ? quantity : 1}
        initialFormResume={reservationFormResume}
        onBack={() => {
          setReserveModalVisible(false);
          setReservationFormResume(null);
        }}
        onSuccess={() => {
          setReserveModalVisible(false);
          setReservationFormResume(null);
          onOrderSuccess?.(RESERVATION_TAB.PENDING);
        }}
        onOpenTopUp={onOpenTopUp}
        resumeSource={reservationSource}
        resumeStoreId={reservationStoreId}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#076F32" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorText}>Không tìm thấy sản phẩm</Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  function handleOwnerDelete() {
    Alert.alert(
      'Xóa sản phẩm',
      'Sản phẩm sẽ bị xóa vĩnh viễn và không thể khôi phục lại.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa sản phẩm',
          style: 'destructive',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              await deleteProductOnBackend(idToken, productId);
              onBack?.();
            } catch (deleteError) {
              Alert.alert('Không xóa được', deleteError.message || 'Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  }

  function handleReportReason(reason) {
    setReportVisible(false);
    setReportReason(reason);
    setComposeVisible(true);
  }

  async function handleReportComposeSubmit({ title, content, images }) {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }

      await submitReportOnBackend({
        idToken,
        reportType: 3,
        productId: product.id,
        productName: product.name,
        shopId: store?.id || product.store_id,
        shopName: store?.name,
        title,
        content,
        images,
      });

      setComposeVisible(false);
      setReportReason('');
      Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn. Chúng tôi đã ghi nhận tố cáo.');
    } catch (error) {
      Alert.alert('Không gửi được báo cáo', error.message || 'Vui lòng thử lại sau.');
    }
  }

  const productUnavailable = Boolean(product.isUnavailable) || Number(product.status) === 0;
  const productOutOfStock =
    !productUnavailable &&
    (variants.length > 0
      ? totalRemaining <= 0
      : resolveIsOutOfStock(product) || maxQuantity <= 0);
  const ratingValue = Number(store?.rating_avg) || 0;
  const reviewCount = Number(store?.review_count) || 0;
  const distanceLabel = formatDistance(distanceMeters);
  const hasDistance = Number.isFinite(Number(distanceMeters));
  const storeIsOpen = store ? store.is_open !== false : true;
  const descriptionText = product.description || 'Chưa có mô tả cho sản phẩm này.';
  const galleryCount = Math.max(galleryImages.length, 1);
  const galleryIndexLabel = `${Math.min(activeImageIndex + 1, galleryCount)}/${galleryCount}`;

  if (showOwnerEdit) {
    return (
      <SellerProductDetailScreen
        productId={productId}
        onBack={() => setShowOwnerEdit(false)}
        onChanged={() => {
          setShowOwnerEdit(false);
          setReloadTick((current) => current + 1);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader
        title="Chi tiết sản phẩm"
        onBack={onBack}
        rightSlot={
          isProductOwner ? null : (
            <Pressable
              onPress={handleMenuPress}
              style={({ pressed }) => [styles.headerMenuBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Báo cáo sản phẩm"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#0f172a" />
            </Pressable>
          )
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.nestedScrollPaddingBottom + 72 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageSection}>
          <View style={styles.floatingActions}>
            <Pressable
              onPress={handleToggleLike}
              style={styles.floatingBtn}
              accessibilityRole="button"
              accessibilityLabel="Yêu thích"
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? '#ef4444' : '#0f172a'}
              />
              <Text style={styles.floatingLikeCount}>{likeCount}</Text>
            </Pressable>
          </View>

          {galleryImages.length > 0 ? (
            <FlatList
              ref={galleryRef}
              data={galleryImages}
              keyExtractor={(uri) => String(uri)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveImageIndex(nextIndex);
              }}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.heroImageSlide} />
              )}
            />
          ) : (
            <View style={styles.imageBox}>
              <Text style={styles.productEmoji}>{product.image_emoji || '📦'}</Text>
            </View>
          )}

          {galleryImages.length > 0 ? (
            <View style={styles.galleryCounter} pointerEvents="none">
              <Text style={styles.galleryCounterText}>{galleryIndexLabel}</Text>
            </View>
          ) : null}

          {productUnavailable ? (
            <View style={styles.heroOutOfStockOverlay} pointerEvents="none">
              <OutOfStockOverlay label="Không có sẵn" />
            </View>
          ) : productOutOfStock ? (
            <View style={styles.heroOutOfStockOverlay} pointerEvents="none">
              <OutOfStockOverlay label="Hết hàng" />
            </View>
          ) : null}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>

          {product.isPromotion && originalPriceLabel ? (
            <View style={styles.priceBlock}>
              <View style={styles.promoMeta}>
                <Text style={styles.originalPrice}>{originalPriceLabel}</Text>
                {discountPercentLabel ? (
                  <Text style={styles.discountBadgeText}>{discountPercentLabel}</Text>
                ) : null}
              </View>
              <Text style={styles.productPrice}>{priceLabel}</Text>
            </View>
          ) : (
            <View style={styles.priceBlock}>
              <Text style={styles.productPrice}>{priceLabel}</Text>
            </View>
          )}
          <Text style={styles.stockSoldText}>
            Còn lại: {displayRemaining} · Đã bán: {displaySold}
          </Text>

          {variants.length > 1 ? (
            <View style={styles.qtyBlock}>
              <Text style={styles.qtyLabel}>Phân loại</Text>
              <View style={styles.chipRow}>
                {variants.map((variant) => {
                  const isSelected = String(selectedVariantId) === String(variant.id);
                  const stockLeft = Math.max(0, Number(variant.quantity) || 0);
                  const variantDisabled =
                    Boolean(product.isUnavailable) || stockLeft <= 0 || totalRemaining <= 0;

                  return (
                    <Pressable
                      key={variant.id}
                      disabled={variantDisabled}
                      style={[
                        styles.chip,
                        isSelected && styles.chipActive,
                        variantDisabled && styles.chipDisabled,
                      ]}
                      onPress={() => handleSelectVariant(variant)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                          variantDisabled && styles.chipTextDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {variant.variantName || 'Loại'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {String(product.categoryName || '').trim() ? (
            <View style={styles.categoryBadgeWrap}>
              <Text style={styles.categoryBadgeText}>
                {String(product.categoryName).trim()}
              </Text>
            </View>
          ) : null}

          <View style={styles.qtyBlock}>
            <Text style={styles.qtyLabel}>Chi tiết sản phẩm</Text>
            <Pressable
              style={styles.descriptionRow}
              onPress={() => setDescriptionExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel="Xem chi tiết sản phẩm"
            >
              <Text
                style={styles.descriptionPreview}
                numberOfLines={descriptionExpanded ? undefined : 3}
              >
                {descriptionText}
              </Text>
              <Ionicons
                name={descriptionExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#94a3b8"
              />
            </Pressable>
          </View>

          {store ? (
            <Pressable
              style={({ pressed }) => [styles.shopCard, pressed && styles.shopCardPressed]}
              onPress={() => onStorePress?.(store.id)}
              disabled={!onStorePress}
            >
              <AvatarBadge
                name={store.shop_name || store.name}
                uri={store.image_url || store.cover_image_url}
                size={48}
              />
              <View style={styles.shopCardBody}>
                <Text style={styles.shopCardName} numberOfLines={1}>
                  {store.shop_name || store.name}
                </Text>
                <View style={styles.shopMetaRow}>
                  <Ionicons name="star" size={13} color="#f59e0b" />
                  <Text style={styles.shopRatingText}>
                    {ratingValue > 0 ? ratingValue.toFixed(1) : '—'}
                  </Text>
                  <Text style={styles.shopReviewText}>
                    ({reviewCount > 0 ? `${reviewCount} đánh giá` : 'Chưa có đánh giá'})
                  </Text>
                </View>
                <View style={styles.shopOpenRow}>
                  <View
                    style={[
                      styles.shopOpenDot,
                      { backgroundColor: storeIsOpen ? '#22c55e' : '#94a3b8' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.shopOpenText,
                      { color: storeIsOpen ? '#076F32' : '#64748b' },
                    ]}
                  >
                    {storeIsOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
                  </Text>
                  {hasDistance ? (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="location" size={11} color="#076F32" />
                      <Text style={styles.distanceBadgeText}>Cách bạn {distanceLabel}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottomSpacing, 12) }]}>
        {isProductOwner ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.ownerEditBtn, pressed && styles.pressed]}
              onPress={() => setShowOwnerEdit(true)}
            >
              <Text style={styles.ownerEditBtnText}>Sửa</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.ownerDeleteBtn, pressed && styles.pressed]}
              onPress={handleOwnerDelete}
            >
              <Text style={styles.ownerDeleteBtnText}>Xóa</Text>
            </Pressable>
          </>
        ) : (
          <>
          <Pressable
            style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed]}
            onPress={handleCallPress}
            accessibilityRole="button"
            accessibilityLabel="Gọi điện"
          >
            <Ionicons name="call" size={22} color="#076F32" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.reserveBtn,
              (productUnavailable || productOutOfStock) && styles.reserveBtnDisabled,
              pressed && !productUnavailable && !productOutOfStock && styles.pressed,
            ]}
            disabled={productUnavailable || productOutOfStock}
            onPress={handleReservePress}
          >
            <Text
              style={[
                styles.reserveBtnText,
                (productUnavailable || productOutOfStock) && styles.reserveBtnTextDisabled,
              ]}
            >
              {productUnavailable ? 'Không có sẵn' : productOutOfStock ? 'Hết hàng' : 'Giữ hàng'}
            </Text>
          </Pressable>
          </>
        )}
        </View>

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo sản phẩm"
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportReason}
      />
      <ReportComposeModal
        visible={composeVisible}
        headerTitle="Chi tiết tố cáo sản phẩm"
        reasonTitle={reportReason}
        onClose={() => {
          setComposeVisible(false);
          setReportReason('');
        }}
        onSubmit={handleReportComposeSubmit}
      />

      <PhoneVerifyGateFlow
        visible={phoneGateVisible}
        onCancel={() => {
          setPhoneGateVisible(false);
          pendingTradeActionRef.current = null;
        }}
        onVerified={() => {
          setPhoneGateVisible(false);
          const action = pendingTradeActionRef.current;
          pendingTradeActionRef.current = null;
          action?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 12,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: '#076F32',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 88,
  },
  imageSection: {
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  heroOutOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  headerMenuBtn: APP_HEADER_ICON_BUTTON_STYLE,
  floatingActions: {
    position: 'absolute',
    right: 16,
    top: 12,
    zIndex: 10,
    flexDirection: 'row',
    gap: 10,
  },
  floatingBtn: {
    minHeight: 40,
    minWidth: 40,
    borderRadius: 20,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  floatingLikeCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  imageBox: {
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageSlide: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    resizeMode: 'cover',
  },
  productEmoji: {
    fontSize: 80,
  },
  galleryCounter: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  galleryCounterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  productName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 30,
    marginBottom: 10,
  },
  stockSoldText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  productPrice: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
  },
  priceBlock: {
    marginTop: 6,
    marginBottom: 8,
    gap: 4,
  },
  promoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  originalPrice: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  discountBadgeText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '900',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E6F4EC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#076F32',
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  shopCardPressed: {
    opacity: 0.85,
  },
  shopCardBody: {
    flex: 1,
    gap: 3,
  },
  shopCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shopRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  shopReviewText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  shopOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopOpenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  shopOpenText: {
    fontSize: 12,
    fontWeight: '700',
  },
  qtyBlock: {
    gap: 12,
    marginBottom: 18,
  },
  qtyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    borderColor: '#076F32',
    backgroundColor: '#f0fdf4',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  chipTextActive: {
    color: '#076F32',
  },
  chipTextDisabled: {
    color: '#94a3b8',
  },
  categoryBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
    lineHeight: 18,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  descriptionPreview: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.85,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  contactHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  iconActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  reserveBtn: {
    backgroundColor: '#076F32',
  },
  reserveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 20,
  },
  reserveBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  reserveBtnTextDisabled: {
    color: '#64748b',
  },
  ownerEditBtn: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  ownerEditBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#076F32',
  },
  ownerDeleteBtn: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  ownerDeleteBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
  },
});
