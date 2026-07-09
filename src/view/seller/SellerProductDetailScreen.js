import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

  function renderVariantImage(image, variant) {
    const outOfStock = Number(variant.quantity) <= 0;

    return (
      <View key={image.id} style={styles.variantImageWrap}>
        <Image
          source={{ uri: image.imageUrl }}
          style={[styles.variantImage, outOfStock && styles.dimmedImage]}
        />
        {outOfStock ? (
          <View style={styles.variantOutOfStockOverlay}>
            <Text style={styles.outOfStockText}>Hết hàng</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0d7377" size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Không tìm thấy sản phẩm.'}</Text>
        <Pressable onPress={onBack} style={formStyles.addVariantButton}>
          <Text style={formStyles.addVariantText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>← Quay lại</Text>
        </Pressable>
        <Text style={styles.topTitle}>{isEditing ? 'Chỉnh sửa sản phẩm' : 'Chi tiết sản phẩm'}</Text>
        <Pressable onPress={() => (isEditing ? handleCancelEdit() : setIsEditing(true))}>
          <Text style={styles.editText}>{isEditing ? 'Hủy sửa' : 'Sửa'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

            <Text style={styles.sectionTitle}>Biến thể</Text>
            {product.variants?.map((variant) => (
              <View key={variant.id} style={styles.variantViewCard}>
                <Text style={styles.variantName}>{variant.variantName}</Text>
                <Text style={styles.variantMeta}>
                  {formatPrice(variant.price)} • SL: {variant.quantity}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(variant.images || []).map((image) => renderVariantImage(image, variant))}
                </ScrollView>
              </View>
            ))}

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  topBar: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  backText: { color: '#0d7377', fontWeight: '700' },
  editText: { color: '#0d7377', fontWeight: '800' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
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
  detailPrice: { color: '#0d7377', fontWeight: '800' },
  productName: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  priceRange: { fontSize: 18, fontWeight: '800', color: '#0d7377' },
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
  variantViewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  variantName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  variantMeta: { color: '#64748b', fontWeight: '600' },
  variantImageWrap: {
    position: 'relative',
    marginRight: 8,
  },
  variantImage: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  variantOutOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderRadius: 10,
  },
  dimmedImage: {
    opacity: 0.45,
  },
  outOfStockText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
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
    color: '#047857',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 10,
    fontWeight: '700',
  },
});
