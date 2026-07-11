import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import ContactActions from './components/ContactActions';
import StarRating from './components/StarRating';
import ReportSheet from '../shared/components/ReportSheet';
import { storeLogger as log } from '../../core/utils/logger';
function VariantImage({ image }) {
  const uri = image?.imageUrl;
  if (!uri) {
    return null;
  }

  return <Image source={{ uri }} style={styles.variantImage} />;
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
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

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

  const priceLabel = useMemo(() => {
    if (!product) {
      return '';
    }
    return formatPriceRange(
      product.minPrice ?? product.price,
      product.maxPrice ?? product.price
    );
  }, [product]);

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

  function handleOpenChat() {
    if (!store?.id) {
      return;
    }
    onOpenChat?.({ shopId: store.id, shopName: store.name });
  }

  const variants = product.variants || [];
  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageSection}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <Pressable
            onPress={() => setReportVisible(true)}
            style={styles.reportBtn}
            accessibilityRole="button"
            accessibilityLabel="Báo cáo sản phẩm"
          >
            <Text style={styles.reportBtnText}>⋯</Text>
          </Pressable>
          <View style={styles.imageBox}>
            {product.thumbnail ? (
              <Image source={{ uri: product.thumbnail }} style={styles.heroImage} />
            ) : (
              <Text style={styles.productEmoji}>{product.image_emoji}</Text>
            )}
          </View>
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

          <Text style={styles.productPrice}>{priceLabel}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>Đã bán: {product.soldCount || 0}</Text>
            {product.donVi ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaItem}>ĐVT: {product.donVi}</Text>
              </>
            ) : null}
            {product.isOutOfStock ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.outOfStockBadge}>Hết hàng</Text>
              </>
            ) : null}
          </View>

          {product.categoryName ? (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryLabel}>Danh mục:</Text>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{product.categoryName}</Text>
              </View>
            </View>
          ) : null}

          {variants.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Phân loại sản phẩm ({variants.length})</Text>
              {variants.map((variant) => (
                <View key={variant.id} style={styles.variantCard}>
                  <View style={styles.variantHeader}>
                    <Text style={styles.variantName}>{variant.variantName || 'Loại'}</Text>
                    <Text style={styles.variantPrice}>{formatPrice(variant.price)}</Text>
                  </View>
                  <Text style={styles.variantStock}>
                    Còn lại: {variant.quantity > 0 ? variant.quantity : 'Hết hàng'}
                  </Text>
                  {(variant.images || []).length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.variantImageRow}>
                        {variant.images.map((image) => (
                          <VariantImage key={image.id || image.imageUrl} image={image} />
                        ))}
                      </View>
                    </ScrollView>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
          <Text style={styles.description}>
            {product.description || 'Chưa có mô tả cho sản phẩm này.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.reserveBtn, pressed && styles.pressed]}
          onPress={() => onReserve?.(product, store)}
        >
          <Text style={styles.actionBtnIcon}>📦</Text>
          <Text style={styles.reserveBtnText}>Giữ hàng</Text>
          <Text style={styles.actionBtnHint}>Đặt trước</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.dealBtn, pressed && styles.pressed]}
          onPress={() => onDeal?.(product, store)}
        >
          <Text style={styles.actionBtnIcon}>💬</Text>
          <Text style={styles.dealBtnText}>Deal giá</Text>
          <Text style={styles.actionBtnHintDeal}>Thương lượng</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
          onPress={() => {
            handleOpenChat();
            onMessageSeller?.(product, store);
          }}
        >
          <Text style={styles.chatButtonText}>💬 Chat</Text>
        </Pressable>
        {store ? (
          <View style={styles.contactWrap}>
            <ContactActions phone={store.phone} zalo={store.zalo} compact />
          </View>
        ) : null}
      </View>

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo sản phẩm"
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
      />    </View>
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
    paddingBottom: 110,
  },
  imageSection: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
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
  backBtnText: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '700',
  },
  reportBtn: {
    position: 'absolute',
    top: 48,
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
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productEmoji: {
    fontSize: 80,
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
    marginBottom: 8,
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
  productPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f766e',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  metaItem: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  outOfStockBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
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
  pressed: {
    opacity: 0.85,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  variantCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  variantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  variantName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
  },
  variantStock: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  variantImageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  variantImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  contactWrap: {
    flex: 1,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  actionBtnIcon: {
    fontSize: 18,
  },
  actionBtnHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  actionBtnHintDeal: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400e',
  },
  reserveBtn: {
    backgroundColor: '#e0f2f1',
  },
  reserveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f766e',
  },
  dealBtn: {
    backgroundColor: '#fef3c7',
  },
  dealBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  messageBtn: {
    flex: 1.6,
    backgroundColor: '#0f766e',
  },
  messageBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
