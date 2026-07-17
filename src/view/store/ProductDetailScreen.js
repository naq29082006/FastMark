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
import { useSelector } from 'react-redux';

import { formatPrice, formatPriceRange } from '../../core/utils/productFormat';
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
import DealOfferModal from '../buyer/DealOfferModal';
import ReservationModal from '../buyer/ReservationModal';
import ReportSheet from '../shared/components/ReportSheet';
import OutOfStockOverlay from '../shared/components/OutOfStockOverlay';
import CircularBackButton from '../shared/components/CircularBackButton';
import AvatarBadge from '../shared/components/AvatarBadge';
import PhoneVerifyGateFlow from '../shared/PhoneVerifyGateFlow';
import { storeLogger as log } from '../../core/utils/logger';
import { RESERVATION_TAB } from '../../constants/sellerOrders';

const SCREEN_WIDTH = Dimensions.get('window').width;
const VARIANT_COLUMNS = 3;
const VARIANT_GAP = 8;
const VARIANT_TILE_WIDTH =
  (SCREEN_WIDTH - 40 - VARIANT_GAP * (VARIANT_COLUMNS - 1)) / VARIANT_COLUMNS;

function getVariantThumb(variant, fallback = '') {
  const firstImage = (variant?.images || []).find((image) => image?.imageUrl);
  return firstImage?.imageUrl || fallback;
}

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export default function ProductDetailScreen({
  productId,
  onBack,
  onStorePress,
  onOpenChat,
  onReserve,
  onDeal,
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
  const [dealModalVisible, setDealModalVisible] = useState(false);
  const [reserveModalVisible, setReserveModalVisible] = useState(false);
  const [actionVariantId, setActionVariantId] = useState(null);
  const [phoneGateVisible, setPhoneGateVisible] = useState(false);

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

  const totalSold = useMemo(() => {
    const variantSold = variants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.soldCount) || 0),
      0
    );
    if (variantSold > 0) {
      return variantSold;
    }
    return Number(product?.soldCount) || 0;
  }, [variants, product?.soldCount]);

  const displayRemaining = selectedVariant
    ? Math.max(0, Number(selectedVariant.quantity) || 0)
    : totalRemaining;

  const displaySold = selectedVariant
    ? Math.max(0, Number(selectedVariant.soldCount) || 0)
    : totalSold;

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

  function openDealFlow() {
    if (product?.isUnavailable || Number(product?.status) === 0) {
      Alert.alert('Không có sẵn', 'Sản phẩm này đã bị người bán xóa hoặc ẩn.');
      return;
    }
    const variantForAction = resolveActionVariant();
    if (requiresVariantSelection && !variantForAction) {
      Alert.alert('Chọn biến thể', 'Vui lòng chọn phân loại sản phẩm trước khi deal giá.');
      return;
    }
    runWithPhoneGate(() => {
      if (onDeal) {
        onDeal(product, store, variantForAction);
        return;
      }
      setActionVariantId(variantForAction?.id || null);
      setDealModalVisible(true);
    });
  }

  function handleReservePress() {
    openReserveFlow();
  }

  function handleDealPress() {
    openDealFlow();
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

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
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

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 88 + insets.bottomSpacing }]}
      >
        <View style={styles.imageSection}>
          <CircularBackButton onPress={onBack} variant="surface" style={styles.backBtn} />
          <Pressable
            onPress={() => setReportVisible(true)}
            style={styles.reportBtn}
            accessibilityRole="button"
            accessibilityLabel="Báo cáo sản phẩm"
          >
            <Text style={styles.reportBtnText}>⋯</Text>
          </Pressable>

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
              <Text style={styles.productEmoji}>{product.image_emoji}</Text>
            </View>
          )}

          {productUnavailable ? (
            <View style={styles.heroOutOfStockOverlay} pointerEvents="none">
              <OutOfStockOverlay label="Không có sẵn" />
            </View>
          ) : null}

          {galleryImages.length > 1 ? (
            <View style={styles.galleryDotsWrap}>
              <View style={styles.galleryDots}>
                {galleryImages.map((uri, index) => (
                  <View
                    key={`${uri}-${index}`}
                    style={[styles.galleryDot, index === activeImageIndex && styles.galleryDotActive]}
                  />
                ))}
              </View>
              <Text style={styles.galleryCounter}>
                {activeImageIndex + 1}/{galleryImages.length}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.productName}>{product.name}</Text>
            <Pressable onPress={handleToggleLike} hitSlop={8} style={styles.likeBtn}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={16}
                color={isLiked ? '#ef4444' : '#64748b'}
              />
              <Text style={styles.likeCountText}>{likeCount}</Text>
            </Pressable>
          </View>

          <Text style={styles.productPrice}>{priceLabel}</Text>

          {store ? (
            <Pressable
              style={({ pressed }) => [styles.shopCard, pressed && styles.shopCardPressed]}
              onPress={() => onStorePress?.(store.id)}
              disabled={!onStorePress}
            >
              <AvatarBadge
                name={store.shop_name || store.name}
                uri={store.image_url || store.cover_image_url}
                size={44}
              />
              <View style={styles.shopCardBody}>
                <Text style={styles.shopCardName} numberOfLines={1}>
                  {store.shop_name || store.name}
                </Text>
                {store.shop_username ? (
                  <Text style={styles.shopCardUsername} numberOfLines={1}>
                    @{store.shop_username}
                  </Text>
                ) : null}
                {store.system_address ? (
                  <View style={styles.shopCardAddressRow}>
                    <Ionicons name="location" size={13} color="#ea580c" />
                    <Text style={styles.shopCardAddress} numberOfLines={2}>
                      {store.system_address}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}

          {product.categoryName ? (
            <View style={styles.categoryChip}>
              {isRemoteIcon(product.categoryIcon) ? (
                <Image source={{ uri: product.categoryIcon }} style={styles.categoryChipImage} />
              ) : product.categoryIcon ? (
                <Text style={styles.categoryChipEmoji}>{product.categoryIcon}</Text>
              ) : (
                <Ionicons name="pricetag" size={14} color="#0f766e" />
              )}
              <Text style={styles.categoryChipText} numberOfLines={1}>
                {product.categoryName}
              </Text>
            </View>
          ) : null}

          <View style={styles.statsRow}>
            {product.donVi ? (
              <>
                <Text style={styles.statsText}>
                  <Text style={styles.metaLabel}>Đơn vị tính: </Text>
                  <Text style={styles.metaValue}>{product.donVi}</Text>
                </Text>
                <Text style={styles.statsDivider}>|</Text>
              </>
            ) : null}
            <Text style={styles.statsText}>
              <Text style={styles.metaLabel}>Còn lại: </Text>
              <Text style={styles.metaValue}>
                {displayRemaining > 0 ? displayRemaining : 'Hết hàng'}
              </Text>
            </Text>
            <Text style={styles.statsDivider}>|</Text>
            <Text style={styles.statsText}>
              <Text style={styles.metaLabel}>Đã bán: </Text>
              <Text style={styles.metaValue}>{displaySold}</Text>
            </Text>
          </View>
          {variants.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Phân loại sản phẩm</Text>
              <View style={styles.variantGrid}>
                {variants.map((variant) => {
                  const isSelected = String(selectedVariantId) === String(variant.id);
                  const stockLeft = Math.max(0, Number(variant.quantity ?? variant.Quantity) || 0);
                  const variantOutOfStock = stockLeft <= 0 || totalRemaining <= 0;
                  const variantDisabled = Boolean(product.isUnavailable) || variantOutOfStock;
                  const thumb = getVariantThumb(variant, product.thumbnail);

                  return (
                    <Pressable
                      key={variant.id}
                      disabled={variantDisabled}
                      style={[
                        styles.variantTile,
                        isSelected && styles.variantTileActive,
                        variantDisabled && styles.variantTileDisabled,
                      ]}
                      onPress={() => handleSelectVariant(variant)}
                    >
                      <View style={styles.variantThumbWrap}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.variantThumb} />
                        ) : (
                          <View style={styles.variantThumbFallback}>
                            <Text style={styles.variantThumbEmoji}>{product.image_emoji || '📦'}</Text>
                          </View>
                        )}
                        {variantOutOfStock ? (
                          <View style={styles.variantSoldOutMask} pointerEvents="none">
                            <Text style={styles.variantSoldOutText}>Hết hàng</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.variantTileName,
                          variantDisabled && styles.variantTileNameDisabled,
                        ]}
                        numberOfLines={2}
                      >
                        {variant.variantName || 'Loại'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionLabel}>Mô tả sản phẩm</Text>
          <Text style={styles.description}>
            {product.description || 'Chưa có mô tả cho sản phẩm này.'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottomSpacing, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.reserveBtn, pressed && styles.pressed]}
          onPress={handleReservePress}
        >
          <Text style={styles.reserveBtnText}>Giữ hàng</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.dealBtn, pressed && styles.pressed]}
          onPress={handleDealPress}
        >
          <Text style={styles.dealBtnText}>Deal giá</Text>
        </Pressable>
      </View>

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo sản phẩm"
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
      />

      <DealOfferModal
        visible={dealModalVisible}
        product={product}
        store={store}
        preselectedVariantId={actionVariantId}
        onClose={() => setDealModalVisible(false)}
        onSuccess={() => {
          setDealModalVisible(false);
          onOrderSuccess?.(RESERVATION_TAB.PENDING_PRICE);
        }}
      />
      <ReservationModal
        visible={reserveModalVisible}
        product={product}
        store={store}
        preselectedVariantId={actionVariantId}
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
    backgroundColor: '#f8fafc',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
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
    color: '#0f766e',
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
    backgroundColor: '#e2e8f0',
  },
  heroOutOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportBtnText: {
    fontSize: 22,
    color: '#0f172a',
    fontWeight: '900',
    lineHeight: 24,
  },
  imageBox: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageSlide: {
    width: SCREEN_WIDTH,
    height: 300,
    resizeMode: 'cover',
  },
  productEmoji: {
    fontSize: 80,
  },
  galleryDotsWrap: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  galleryDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  galleryCounter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  galleryDotActive: {
    width: 18,
    backgroundColor: '#ffffff',
  },
  infoSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  productName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  likeCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f766e',
    marginBottom: 10,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  shopCardPressed: {
    opacity: 0.85,
  },
  shopCardBody: {
    flex: 1,
    gap: 2,
  },
  shopCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopCardUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  shopCardAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 2,
  },
  shopCardAddress: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
    lineHeight: 16,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    maxWidth: '100%',
  },
  categoryChipImage: {
    width: 16,
    height: 16,
    borderRadius: 4,
    resizeMode: 'cover',
  },
  categoryChipEmoji: {
    fontSize: 14,
  },
  categoryChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f766e',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  statsText: {
    fontSize: 13,
    lineHeight: 20,
  },
  statsDivider: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  metaLabel: {
    color: '#64748b',
    fontWeight: '600',
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: '700',
  },
  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: VARIANT_GAP,
  },
  variantTile: {
    width: VARIANT_TILE_WIDTH,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'stretch',
  },
  variantTileActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  variantThumbWrap: {
    position: 'relative',
    width: '100%',
    height: 78,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 6,
  },
  variantThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  variantThumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantThumbEmoji: {
    fontSize: 22,
  },
  variantSoldOutMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantSoldOutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  variantTileDisabled: {
    opacity: 1,
  },
  variantTileName: {
    width: '100%',
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'left',
    lineHeight: 14,
  },
  variantTileNameDisabled: {
    color: '#94a3b8',
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
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  reserveBtn: {
    backgroundColor: '#e0f2f1',
  },
  reserveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f766e',
    lineHeight: 20,
  },
  dealBtn: {
    backgroundColor: '#fef3c7',
  },
  dealBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#b45309',
    lineHeight: 20,
  },
});
