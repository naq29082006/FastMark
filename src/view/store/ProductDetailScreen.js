import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { formatPrice, formatPriceRange } from '../../core/utils/productFormat';
import { formatDistance } from '../../core/utils/geo';
import { getPhoneGateStep } from '../../core/utils/phoneVerification';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { loadProductById, loadStoreById } from '../../viewmodel/store/storeViewModel';
import { submitReportOnBackend } from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import ReservationModal from '../buyer/ReservationModal';
import QuantityStepper from '../buyer/QuantityStepper';
import ReportSheet from '../shared/components/ReportSheet';
import OutOfStockOverlay from '../shared/components/OutOfStockOverlay';
import CircularBackButton from '../shared/components/CircularBackButton';
import AvatarBadge from '../shared/components/AvatarBadge';
import PhoneVerifyGateFlow from '../shared/PhoneVerifyGateFlow';
import { storeLogger as log } from '../../core/utils/logger';
import { RESERVATION_TAB } from '../../constants/sellerOrders';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 320;
const QTY_CHIPS = [1, 2, 5, 10];

export default function ProductDetailScreen({
  productId,
  onBack,
  onStorePress,
  onOpenChat,
  onReserve,
  onMessageSeller,
  onOrderSuccess,
}) {
  const insets = useScreenInsets();
  const profile = useSelector(selectAuthProfile);
  const galleryRef = useRef(null);
  const pendingTradeActionRef = useRef(null);
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [actionVariantId, setActionVariantId] = useState(null);
  const [phoneGateVisible, setPhoneGateVisible] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setSelectedVariantId(null);
    setActiveImageIndex(0);

    log.info('ProductDetailScreen:load', { productId });

    loadProductById(productId)
      .then(async (productData) => {
        if (!isCurrent) return;
        setProduct(productData);
        setLikeCount(Number(productData?.likeCount) || 0);
        if (productData?.store_id) {
          const storeData = await loadStoreById(productData.store_id);
          if (isCurrent) setStore(storeData);
        }
        log.ok('ProductDetailScreen:loaded', {
          productId,
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
  }, [productId]);

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

  const maxQuantity = Math.max(0, displayRemaining);
  const unitLabel = product?.donVi ? String(product.donVi) : 'sp';

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

    if (selectedVariant) {
      const variantImages = (selectedVariant.images || [])
        .map((image) => image?.imageUrl)
        .filter(Boolean);
      if (variantImages.length > 0) {
        return variantImages;
      }
    }

    if (product.thumbnail) {
      return [product.thumbnail];
    }

    return [];
  }, [product, selectedVariant]);

  const priceLabel = useMemo(() => {
    if (!product) {
      return '';
    }

    if (selectedVariant) {
      return formatPrice(selectedVariant.price);
    }

    return formatPriceRange(
      product.minPrice ?? product.price,
      product.maxPrice ?? product.price
    );
  }, [product, selectedVariant]);

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

  function openReserveFlow() {
    if (product?.isUnavailable || Number(product?.status) === 0) {
      Alert.alert('Không có sẵn', 'Sản phẩm này đã bị người bán xóa hoặc ẩn.');
      return;
    }
    const variantForAction = resolveActionVariant();
    if (requiresVariantSelection && !variantForAction) {
      Alert.alert('Chọn biến thể', 'Vui lòng chọn phân loại sản phẩm trước khi giữ hàng.');
      return;
    }
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

  async function handleShare() {
    try {
      await Share.share({
        message: `${product.name} — ${priceLabel} trên Chợ Quê FastMark`,
      });
    } catch {
      // User cancelled share.
    }
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

  async function handleReportSubmit(reason) {
    setReportVisible(false);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }

      await submitReportOnBackend({
        idToken,
        reportType: 4,
        productId: product.id,
        productName: product.name,
        shopId: store?.id || product.store_id,
        shopName: store?.name,
        title: reason,
      });

      Alert.alert('Đã gửi báo cáo', `Cảm ơn bạn. Chúng tôi đã ghi nhận: "${reason}".`);
    } catch (error) {
      Alert.alert('Không gửi được báo cáo', error.message || 'Vui lòng thử lại sau.');
    }
  }

  const productUnavailable = Boolean(product.isUnavailable) || Number(product.status) === 0;
  const ratingValue = Number(store?.rating_avg) || 0;
  const reviewCount = Number(store?.review_count) || 0;
  const distanceLabel = formatDistance(product.distanceMeters);
  const hasDistance = distanceLabel && distanceLabel !== '--';
  const storeIsOpen = store ? store.is_open !== false : true;
  const descriptionText = product.description || 'Chưa có mô tả cho sản phẩm này.';
  const galleryCount = Math.max(galleryImages.length, 1);
  const galleryIndexLabel = `${Math.min(activeImageIndex + 1, galleryCount)}/${galleryCount}`;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 88 + insets.bottomSpacing }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageSection}>
          <CircularBackButton
            onPress={onBack}
            variant="surface"
            style={[styles.backBtn, { top: insets.floatingTop }]}
          />

          <View style={[styles.floatingActions, { top: insets.floatingTop }]}>
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
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={styles.floatingBtn}
              accessibilityRole="button"
              accessibilityLabel="Chia sẻ"
            >
              <Ionicons name="share-outline" size={20} color="#0f172a" />
            </Pressable>
          </View>

          {galleryImages.length > 0 ? (
            <FlatList
              ref={galleryRef}
              data={galleryImages}
              keyExtractor={(uri, index) => `${uri}-${index}`}
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
          ) : null}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>

          <View style={styles.priceDistanceRow}>
            <Text style={styles.productPrice}>{priceLabel}</Text>
            {hasDistance ? (
              <View style={styles.distanceBadge}>
                <Ionicons name="location" size={13} color="#076F32" />
                <Text style={styles.distanceBadgeText}>Cách bạn {distanceLabel}</Text>
              </View>
            ) : null}
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
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}

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

          <View style={styles.qtyBlock}>
            <Text style={styles.qtyLabel}>Số lượng ({unitLabel})</Text>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={maxQuantity}
              disabled={productUnavailable || maxQuantity <= 0}
            />
            <View style={styles.chipRow}>
              {QTY_CHIPS.map((chipQty) => {
                const isSelected = quantity === chipQty;
                const chipDisabled = productUnavailable || chipQty > maxQuantity || maxQuantity <= 0;

                return (
                  <Pressable
                    key={chipQty}
                    disabled={chipDisabled}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                      chipDisabled && styles.chipDisabled,
                    ]}
                    onPress={() => setQuantity(chipQty)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                        chipDisabled && styles.chipTextDisabled,
                      ]}
                    >
                      {chipQty} {unitLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={styles.descriptionRow}
            onPress={() => setDescriptionExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Xem mô tả sản phẩm"
          >
            <Ionicons name="list-outline" size={18} color="#076F32" />
            <Text
              style={styles.descriptionPreview}
              numberOfLines={descriptionExpanded ? undefined : 1}
            >
              {descriptionText}
            </Text>
            <Ionicons
              name={descriptionExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#94a3b8"
            />
          </Pressable>

          <Pressable
            style={styles.reportLink}
            onPress={() => setReportVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Báo cáo sản phẩm"
          >
            <Ionicons name="flag-outline" size={14} color="#94a3b8" />
            <Text style={styles.reportLinkText}>Báo cáo sản phẩm</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottomSpacing, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.reserveBtn, pressed && styles.pressed]}
          onPress={handleReservePress}
        >
          <Text style={styles.reserveBtnText}>Giữ hàng</Text>
        </Pressable>
      </View>

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo sản phẩm"
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
      />

      <ReservationModal
        visible={reserveModalVisible}
        product={product}
        store={store}
        preselectedVariantId={actionVariantId}
        initialQuantity={quantity > 0 ? quantity : 1}
        onClose={() => setReserveModalVisible(false)}
        onSuccess={() => {
          setReserveModalVisible(false);
          onOrderSuccess?.(RESERVATION_TAB.HOLDING);
        }}
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
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  floatingActions: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    gap: 10,
  },
  floatingBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
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
  priceDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  productPrice: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4EC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  distanceBadgeText: {
    fontSize: 12,
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
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  descriptionPreview: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 20,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  reportLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
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
});
