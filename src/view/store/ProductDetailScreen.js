import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatPrice, formatPriceRange } from '../../core/utils/productFormat';
import { loadProductById, loadStoreById } from '../../viewmodel/store/storeViewModel';
import { submitReportOnBackend } from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import ReportSheet from '../shared/components/ReportSheet';
import CircularBackButton from '../shared/components/CircularBackButton';
import { storeLogger as log } from '../../core/utils/logger';

const SCREEN_WIDTH = Dimensions.get('window').width;
const VARIANT_COLUMNS = 3;
const VARIANT_GAP = 8;
const VARIANT_TILE_WIDTH =
  (SCREEN_WIDTH - 40 - VARIANT_GAP * (VARIANT_COLUMNS - 1)) / VARIANT_COLUMNS;

function getVariantThumb(variant, fallback = '') {
  const firstImage = (variant?.images || []).find((image) => image?.imageUrl);
  return firstImage?.imageUrl || fallback;
}

export default function ProductDetailScreen({
  productId,
  onBack,
  onStorePress,
  onOpenChat,
  onReserve,
  onDeal,
  onMessageSeller,
}) {
  const insets = useScreenInsets();
  const galleryRef = useRef(null);
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  const variants = product?.variants || [];

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) || null,
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
    if (selectedVariantId === variant.id) {
      setSelectedVariantId(null);
      setActiveImageIndex(0);
      galleryRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }

    setSelectedVariantId(variant.id);
    setActiveImageIndex(0);
    galleryRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function handleReservePress() {
    if (requiresVariantSelection && !selectedVariant) {
      Alert.alert('Chọn biến thể', 'Vui lòng chọn phân loại sản phẩm trước khi giữ hàng.');
      return;
    }
    onReserve?.(product, store, selectedVariant);
  }

  function handleDealPress() {
    if (requiresVariantSelection && !selectedVariant) {
      Alert.alert('Chọn biến thể', 'Vui lòng chọn phân loại sản phẩm trước khi deal giá.');
      return;
    }
    onDeal?.(product, store, selectedVariant);
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

          {galleryImages.length > 1 ? (
            <View style={styles.galleryDots}>
              {galleryImages.map((uri, index) => (
                <View
                  key={`${uri}-${index}`}
                  style={[styles.galleryDot, index === activeImageIndex && styles.galleryDotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.productName}>{product.name}</Text>
            <Pressable
              onPress={() => setIsLiked((prev) => !prev)}
              hitSlop={8}
              style={styles.likeBtn}
            >
              <Text style={styles.likeIcon}>{isLiked ? '❤️' : '🤍'}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Mô tả sản phẩm</Text>
          <Text style={styles.description}>
            {product.description || 'Chưa có mô tả cho sản phẩm này.'}
          </Text>

          <Text style={styles.productPrice}>{priceLabel}</Text>

          {product.categoryName ? (
            <View style={styles.categoryRow}>
              <Text style={styles.metaLabel}>Danh mục:</Text>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{product.categoryName}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Số lượng còn lại: </Text>
              <Text style={styles.metaValue}>
                {displayRemaining > 0 ? displayRemaining : 'Hết hàng'}
              </Text>
              <Text style={styles.metaLabel}> · Đã bán: </Text>
              <Text style={styles.metaValue}>{displaySold}</Text>
            </Text>
            {product.donVi ? (
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Đơn vị tính: </Text>
                <Text style={styles.metaValue}>{product.donVi}</Text>
              </Text>
            ) : null}
            {product.isOutOfStock ? (
              <Text style={styles.outOfStockBadge}>Hết hàng</Text>
            ) : null}
          </View>

          {variants.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Phân loại sản phẩm</Text>
              <View style={styles.variantGrid}>
                {variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  const thumb = getVariantThumb(variant, product.thumbnail);

                  return (
                    <Pressable
                      key={variant.id}
                      style={[styles.variantTile, isSelected && styles.variantTileActive]}
                      onPress={() => handleSelectVariant(variant)}
                    >
                      <View style={styles.variantThumbWrap}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.variantThumb} />
                        ) : (
                          <Text style={styles.variantThumbEmoji}>{product.image_emoji}</Text>
                        )}
                      </View>
                      <View style={styles.variantTileInfo}>
                        <Text style={styles.variantTileName} numberOfLines={2}>
                          {variant.variantName || 'Loại'}
                        </Text>
                        <Text style={styles.variantTilePrice}>{formatPrice(variant.price)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
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
  galleryDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeIcon: {
    fontSize: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 14,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f766e',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    backgroundColor: '#e0f2f1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
  },
  metaBlock: {
    gap: 6,
    marginBottom: 18,
  },
  metaLine: {
    fontSize: 13,
    lineHeight: 20,
  },
  metaLabel: {
    color: '#64748b',
    fontWeight: '600',
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: '700',
  },
  outOfStockBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
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
    width: '100%',
    height: 78,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  variantThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  variantThumbEmoji: {
    fontSize: 22,
  },
  variantTileInfo: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 2,
  },
  variantTileName: {
    width: '100%',
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'left',
    lineHeight: 14,
  },
  variantTilePrice: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
    lineHeight: 14,
    textAlign: 'left',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
