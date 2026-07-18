import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import {
  deleteProductOnBackend,
  getMyProductOnBackend,
  getProductCategoriesOnBackend,
  updateProductOnBackend,
} from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { syncSellerAccess } from '../../viewmodel/auth/authSlice';
import { formatPrice, formatPriceRange } from '../../core/utils/productFormat';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import CircularBackButton from '../shared/components/CircularBackButton';
import {
  CategoryCombobox,
  ThumbnailField,
  VariantBlock,
  createVariant,
  sellerFormStyles as formStyles,
} from './SellerProductFormFields';

function createVariantFromApi(variant) {
  return {
    id: variant.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantName: variant.variantName || '',
    price: String(variant.price ?? ''),
    quantity: String(variant.quantity ?? ''),
    images: (variant.images || []).map((image) => ({
      uri: image.imageUrl,
      imageUrl: image.imageUrl,
    })),
  };
}

export default function SellerProductDetailScreen({ productId, onBack, onChanged }) {
  const dispatch = useDispatch();
  const insets = useScreenInsets();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [donVi, setDonVi] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [variants, setVariants] = useState([]);

  const priceLabel = useMemo(() => {
    if (!product) {
      return '';
    }
    return formatPriceRange(product.minPrice, product.maxPrice);
  }, [product]);

  const applyProductToForm = useCallback((nextProduct) => {
    setProduct(nextProduct);
    setProductName(nextProduct.productName || '');
    setDescription(nextProduct.description || '');
    setDonVi(nextProduct.donVi || '');
    setCategoryId(String(nextProduct.categoryId || ''));
    setThumbnail(
      nextProduct.thumbnail
        ? { uri: nextProduct.thumbnail, imageUrl: nextProduct.thumbnail }
        : null
    );
    setVariants((nextProduct.variants || []).map(createVariantFromApi));
  }, []);

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const [nextProduct, nextCategories] = await Promise.all([
        getMyProductOnBackend(idToken, productId),
        getProductCategoriesOnBackend(),
      ]);

      setCategories(nextCategories);
      applyProductToForm(nextProduct);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được sản phẩm.');
    } finally {
      setIsLoading(false);
    }
  }, [applyProductToForm, productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  function handleCancelEdit() {
    if (product) {
      applyProductToForm(product);
    }
    setIsEditing(false);
    setError('');
    setSuccessMessage('');
  }

  function updateVariant(index, nextVariant) {
    setVariants((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextVariant : item))
    );
  }

  async function handleSaveProduct() {
    setError('');
    setSuccessMessage('');

    if (!productName.trim() || !categoryId) {
      setError('Vui lòng nhập đủ tên và danh mục.');
      return;
    }

    const normalizedVariants = variants.map((variant) => ({
      variantName: variant.variantName.trim(),
      price: Number(variant.price),
      quantity: Number(variant.quantity || 0),
      images: variant.images.map((image) =>
        image.base64
          ? { imageBase64: image.base64, mimeType: image.mimeType }
          : { imageUrl: image.imageUrl || image.uri }
      ),
    }));

    for (let index = 0; index < normalizedVariants.length; index += 1) {
      const variant = normalizedVariants[index];
      if (!variant.variantName || !Number.isFinite(variant.price) || !variant.images.length) {
        setError(`Biến thể ${index + 1} chưa hợp lệ.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const payload = {
        productName: productName.trim(),
        description: description.trim(),
        donVi: donVi.trim(),
        categoryId,
        variants: normalizedVariants,
      };

      if (thumbnail?.base64) {
        payload.thumbnailBase64 = thumbnail.base64;
        payload.thumbnailMimeType = thumbnail.mimeType;
      } else if (thumbnail?.imageUrl || thumbnail?.uri) {
        payload.thumbnailUrl = thumbnail.imageUrl || thumbnail.uri;
      }

      const updated = await updateProductOnBackend({ idToken, productId, payload });
      applyProductToForm(updated);
      setIsEditing(false);
      setSuccessMessage('Đã cập nhật sản phẩm.');
      onChanged?.();
      dispatch(syncSellerAccess());
    } catch (saveError) {
      setError(saveError.message || 'Không lưu được sản phẩm.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
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
              onChanged?.();
              dispatch(syncSellerAccess());
              onBack?.();
            } catch (deleteError) {
              setError(deleteError.message || 'Không xóa được sản phẩm.');
            }
          },
        },
      ]
    );
  }

  function getVariantThumb(variant) {
    const firstImage = (variant.images || [])[0];
    return firstImage?.imageUrl || product?.thumbnail || '';
  }

  const headerTitle = isEditing ? 'Chỉnh sửa sản phẩm' : 'Chi tiết sản phẩm';

  function renderTopBar({ showEdit = false } = {}) {
    return (
      <View style={[styles.topBar, { paddingTop: insets.contentPaddingTop }]}>
        <CircularBackButton onPress={onBack} variant="plain" style={styles.headerIconButton} />
        <Text style={styles.topTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        {showEdit ? (
          <Pressable
            onPress={() => (isEditing ? handleCancelEdit() : setIsEditing(true))}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Hủy sửa' : 'Sửa sản phẩm'}
            style={({ pressed }) => [
              styles.headerIconButton,
              styles.headerActionButton,
              pressed && styles.headerActionPressed,
            ]}
          >
            <Ionicons
              name={isEditing ? 'close' : 'create-outline'}
              size={18}
              color="#0f172a"
            />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {renderTopBar()}
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.screen}>
        {renderTopBar()}
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Không tìm thấy sản phẩm.'}</Text>
          <Pressable onPress={onBack} style={formStyles.addVariantButton}>
            <Text style={formStyles.addVariantText}>Quay lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {renderTopBar({ showEdit: true })}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottomSpacing + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successBanner}>{successMessage}</Text> : null}

        {!isEditing ? (
          <>
            {product.thumbnail ? (
              <Image source={{ uri: product.thumbnail }} style={styles.heroImage} />
            ) : null}

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tên sản phẩm:</Text>
                <Text style={styles.detailValue}>{product.productName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Giá:</Text>
                <Text style={[styles.detailValue, styles.detailPrice]}>{priceLabel}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Đơn vị:</Text>
                <Text style={styles.detailValue}>{product.donVi || 'Chưa cập nhật'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chi tiết sản phẩm:</Text>
                <Text style={styles.detailValue}>{product.description || 'Chưa có mô tả.'}</Text>
              </View>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.sectionTitle}>Thống kê</Text>
              <Text style={styles.statsHint}>Hệ thống tự cập nhật khi người mua xem, tym và mua hàng.</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{product.viewCount || 0}</Text>
                  <Text style={styles.statLabel}>Lượt xem</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{product.likeCount || 0}</Text>
                  <Text style={styles.statLabel}>Lượt tym</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{product.soldCount || 0}</Text>
                  <Text style={styles.statLabel}>Đã bán</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Phân loại sản phẩm</Text>
            <View style={styles.variantGrid}>
              {(product.variants || []).map((variant) => {
                const stockLeft = Math.max(
                  0,
                  Number(variant.quantity ?? variant.Quantity) || 0
                );
                const outOfStock = stockLeft <= 0;
                const thumb = getVariantThumb(variant);

                return (
                  <View
                    key={variant.id}
                    style={[styles.variantTile, outOfStock && styles.variantTileDisabled]}
                  >
                    <View style={styles.variantThumbWrap} collapsable={false}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.variantThumb} />
                      ) : (
                        <View style={styles.variantThumbFallback}>
                          <Text style={styles.variantThumbEmoji}>📦</Text>
                        </View>
                      )}
                      {outOfStock ? (
                        <View style={styles.variantSoldOutMask} pointerEvents="none">
                          <Text style={styles.variantSoldOutText}>Hết hàng</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.variantTileName,
                        outOfStock && styles.variantTileNameDisabled,
                      ]}
                      numberOfLines={2}
                    >
                      {variant.variantName || 'Loại'}
                    </Text>
                    <Text
                      style={[
                        styles.variantTileMeta,
                        outOfStock && styles.variantTileNameDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {formatPrice(variant.price)} · SL {stockLeft}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Pressable onPress={handleDelete} style={styles.dangerButton}>
              <Text style={styles.dangerButtonText}>Xóa sản phẩm</Text>
            </Pressable>
          </>
        ) : (
          <View style={formStyles.card}>
            <Text style={formStyles.formTitle}>Thông tin sản phẩm</Text>

            <View style={formStyles.field}>
              <Text style={formStyles.label}>Tên sản phẩm *</Text>
              <TextInput
                value={productName}
                onChangeText={setProductName}
                placeholder="Nhập tên sản phẩm"
                placeholderTextColor="#94a3b8"
                style={formStyles.input}
              />
            </View>

            <View style={formStyles.field}>
              <Text style={formStyles.label}>Danh mục *</Text>
              <CategoryCombobox categories={categories} value={categoryId} onChange={setCategoryId} />
            </View>

            <ThumbnailField thumbnail={thumbnail} onChange={setThumbnail} onError={setError} />

            <View style={formStyles.field}>
              <Text style={formStyles.label}>Mô tả</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Mô tả sản phẩm"
                placeholderTextColor="#94a3b8"
                style={[formStyles.input, formStyles.textArea]}
              />
            </View>

            <View style={formStyles.field}>
              <Text style={formStyles.label}>Đơn vị</Text>
              <TextInput
                value={donVi}
                onChangeText={setDonVi}
                placeholder="kg, hộp, chai..."
                placeholderTextColor="#94a3b8"
                style={formStyles.input}
              />
            </View>

            <Text style={formStyles.sectionTitle}>Biến thể</Text>
            {variants.map((variant, index) => (
              <VariantBlock
                key={variant.id}
                index={index}
                variant={variant}
                canRemove={variants.length > 1}
                onChange={(nextVariant) => updateVariant(index, nextVariant)}
                onRemove={() => setVariants((current) => current.filter((_, idx) => idx !== index))}
              />
            ))}

            <Pressable
              onPress={() => setVariants((current) => [...current, createVariant()])}
              style={({ pressed }) => [formStyles.addVariantButton, pressed && formStyles.buttonPressed]}
            >
              <Text style={formStyles.addVariantText}>+ Thêm biến thể</Text>
            </Pressable>

            <Pressable
              disabled={isSaving}
              onPress={handleSaveProduct}
              style={({ pressed }) => [
                formStyles.submitButton,
                pressed && formStyles.buttonPressed,
                isSaving && formStyles.submitButtonDisabled,
              ]}
            >
              <Text style={formStyles.submitButtonText}>
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionPressed: {
    opacity: 0.72,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  heroImage: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#e2e8f0' },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  detailRow: { gap: 4 },
  detailLabel: { fontSize: 13, fontWeight: '800', color: '#475569' },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#0f172a', lineHeight: 22 },
  detailPrice: { color: '#076F32', fontWeight: '800' },
  productName: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  priceRange: { fontSize: 18, fontWeight: '800', color: '#076F32' },
  metaText: { color: '#64748b', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  statsHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  variantTile: {
    width: '31%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  variantTileDisabled: {
    opacity: 1,
    borderColor: '#e2e8f0',
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
    fontSize: 28,
  },
  variantSoldOutMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    elevation: 2,
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
  variantTileName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  variantTileNameDisabled: {
    color: '#94a3b8',
  },
  variantTileMeta: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dangerButtonText: { color: '#b91c1c', fontWeight: '800' },
  errorText: { color: '#b91c1c', fontWeight: '700', textAlign: 'center' },
  errorBanner: {
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    fontWeight: '700',
  },
  successBanner: {
    color: '#076F32',
    backgroundColor: '#E6F4EC',
    padding: 12,
    borderRadius: 10,
    fontWeight: '700',
  },
});
