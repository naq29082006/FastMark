import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { createProductOnBackend, getProductCategoriesOnBackend } from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { syncSellerAccess } from '../../viewmodel/auth/authSlice';
import { showErrorAlert } from '../../core/utils/appAlert';
import { useDispatch } from 'react-redux';
import ProductPromotionSection, {
  buildPromotionPayload,
} from '../seller/ProductPromotionSection';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';

function createVariant() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantName: '',
    price: '',
    quantity: '',
    image: null,
  };
}

async function pickImages({ multiple = true } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập thư viện ảnh.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) {
    return [];
  }

  return result.assets
    .filter((asset) => asset.base64)
    .map((asset) => ({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType || 'image/jpeg',
    }));
}

function CategoryCombobox({ categories, value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === value) || null,
    [categories, value]
  );

  return (
    <>
      <Pressable
        disabled={disabled || categories.length === 0}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.combobox,
          disabled && styles.comboboxDisabled,
          pressed && !disabled && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.comboboxText, !selectedCategory && styles.comboboxPlaceholder]}>
          {selectedCategory?.categoryName || 'Chọn danh mục'}
        </Text>
        <Text style={styles.comboboxArrow}>▼</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Chọn danh mục</Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {categories.map((category) => {
                const isActive = category.id === value;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => {
                      onChange(category.id);
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalOption,
                      isActive && styles.modalOptionActive,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                      {category.categoryName}
                    </Text>
                    {category.description ? (
                      <Text style={styles.modalOptionDescription}>{category.description}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function VariantBlock({ variant, index, onChange, onRemove, canRemove }) {
  async function handlePickImage() {
    try {
      const picked = await pickImages({ multiple: false });
      if (!picked[0]) {
        return;
      }
      onChange({
        ...variant,
        image: picked[0],
        error: '',
      });
    } catch (error) {
      onChange({ ...variant, error: error.message });
    }
  }

  return (
    <View style={styles.variantCard}>
      <View style={styles.variantHeader}>
        <Text style={styles.variantTitle}>Biến thể {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove}>
            <Text style={styles.removeVariantText}>Xóa</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Tên biến thể</Text>
        <KeyboardAwareTextInput
          value={variant.variantName}
          onChangeText={(nextValue) => onChange({ ...variant, variantName: nextValue, error: '' })}
          placeholder="VD: 500g, 1kg, Loại 1"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, styles.halfField]}>
          <Text style={styles.label}>Giá (đ)</Text>
          <KeyboardAwareTextInput
            value={variant.price}
            onChangeText={(nextValue) => onChange({ ...variant, price: nextValue, error: '' })}
            placeholder="35000"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <View style={[styles.field, styles.halfField]}>
          <Text style={styles.label}>Số lượng</Text>
          <KeyboardAwareTextInput
            value={variant.quantity}
            onChangeText={(nextValue) => onChange({ ...variant, quantity: nextValue, error: '' })}
            placeholder="100"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Ảnh biến thể (1 ảnh)</Text>
        <View style={styles.thumbnailRow}>
          {variant.image ? (
            <View style={styles.thumbnailWrap}>
              <Image source={{ uri: variant.image.uri }} style={styles.thumbnailImage} />
              <Pressable
                onPress={() => onChange({ ...variant, image: null, error: '' })}
                style={styles.removeImageButton}
              >
                <Text style={styles.removeImageText}>×</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handlePickImage}
              style={({ pressed }) => [styles.thumbnailPicker, pressed && styles.buttonPressed]}
            >
              <Text style={styles.addImageText}>+ Chọn ảnh</Text>
            </Pressable>
          )}
        </View>
      </View>

      {variant.error ? <Text style={styles.errorText}>{variant.error}</Text> : null}
    </View>
  );
}

export default function SellerPostForm({ onProductCreated }) {
  const dispatch = useDispatch();
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [donVi, setDonVi] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [thumbnails, setThumbnails] = useState([]);
  const [variants, setVariants] = useState([createVariant()]);
  const [promotion, setPromotion] = useState({
    enabled: false,
    discountPercent: '',
    startDate: '',
    endDate: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const promotionBasePrice = useMemo(() => {
    const prices = (variants || [])
      .map((v) => Number(v.price))
      .filter((p) => Number.isFinite(p) && p > 0);
    return prices.length ? Math.min(...prices) : 0;
  }, [variants]);

  const promotionBaseMaxPrice = useMemo(() => {
    const prices = (variants || [])
      .map((v) => Number(v.price))
      .filter((p) => Number.isFinite(p) && p > 0);
    return prices.length ? Math.max(...prices) : 0;
  }, [variants]);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const rows = await getProductCategoriesOnBackend();
        if (isMounted) {
          setCategories(rows);
        }
      } catch {
        if (isMounted) {
          setCategories([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateVariant(index, nextVariant) {
    setVariants((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextVariant : item))
    );
  }

  function addVariant() {
    setVariants((current) => [...current, createVariant()]);
  }

  function removeVariant(index) {
    setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handlePickThumbnails() {
    setError('');

    try {
      const picked = await pickImages({ multiple: true });
      if (!picked.length) {
        return;
      }
      setThumbnails((current) => [...current, ...picked]);
    } catch (pickError) {
      showErrorAlert(pickError.message || 'Không chọn được ảnh sản phẩm.');
    }
  }

  async function handleSubmit() {
    setError('');

    if (!productName.trim()) {
      setError('Vui lòng nhập tên sản phẩm.');
      return;
    }

    if (!categoryId) {
      setError('Vui lòng chọn danh mục sản phẩm.');
      return;
    }

    if (!thumbnails.length) {
      setError('Vui lòng chọn ít nhất một ảnh sản phẩm.');
      return;
    }

    const normalizedVariants = variants.map((variant) => {
      const image = variant.image
        ? variant.image.base64
          ? { imageBase64: variant.image.base64, mimeType: variant.image.mimeType }
          : { imageUrl: variant.image.imageUrl || variant.image.uri }
        : null;

      return {
        variantName: variant.variantName.trim(),
        price: Number(variant.price),
        quantity: Number(variant.quantity || 0),
        image,
      };
    });

    for (let index = 0; index < normalizedVariants.length; index += 1) {
      const variant = normalizedVariants[index];
      if (!variant.variantName) {
        setError(`Biến thể ${index + 1}: vui lòng nhập tên.`);
        return;
      }
      if (!Number.isFinite(variant.price) || variant.price < 0) {
        setError(`Biến thể ${index + 1}: giá không hợp lệ.`);
        return;
      }
      if (!variant.image) {
        setError(`Biến thể ${index + 1}: cần một ảnh.`);
        return;
      }
    }

    if (promotion.enabled) {
      const percent = Number(promotion.discountPercent);
      if (!Number.isFinite(percent) || percent < 1 || percent > 99) {
        setError('Khuyến mãi: nhập phần trăm giảm giá từ 1% đến 99%.');
        return;
      }
      if (promotionBasePrice <= 0) {
        setError('Khuyến mãi: thêm biến thể có giá hợp lệ trước khi bật khuyến mãi.');
        return;
      }
      if (promotion.startDate && promotion.endDate) {
        const start = new Date(`${promotion.startDate}T00:00:00`);
        const end = new Date(`${promotion.endDate}T00:00:00`);
        if (
          Number.isFinite(start.getTime()) &&
          Number.isFinite(end.getTime()) &&
          end.getTime() < start.getTime()
        ) {
          setError('Khuyến mãi: ngày kết thúc phải sau ngày bắt đầu.');
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const result = await createProductOnBackend({
        idToken,
        payload: {
          productName: productName.trim(),
          description: description.trim(),
          donVi: donVi.trim(),
          categoryId,
          thumbnails: thumbnails.map((image) =>
            image.base64
              ? { imageBase64: image.base64, mimeType: image.mimeType }
              : { imageUrl: image.imageUrl || image.uri }
          ),
          variants: normalizedVariants,
          ...buildPromotionPayload(promotion),
        },
      });

      const createdProductId = result?.product?.id;
      setProductName('');
      setDescription('');
      setDonVi('');
      setCategoryId('');
      setThumbnails([]);
      setVariants([createVariant()]);
      setPromotion({
        enabled: false,
        discountPercent: '',
        startDate: '',
        endDate: '',
      });
      dispatch(syncSellerAccess());
      Alert.alert(
        'Thành công',
        result?.publiclyVisible === false
          ? result.message ||
              'Đã lưu bài. Gian hàng chưa có gói active nên bài bị ẩn công khai.'
          : result?.message || 'Đăng sản phẩm thành công.'
      );

      if (createdProductId) {
        onProductCreated?.(createdProductId);
      }
    } catch (submitError) {
      const message = submitError.message || 'Không đăng được sản phẩm.';
      if (submitError.statusCode === 403 || /gói bán hàng/i.test(message)) {
        Alert.alert('Cần mua gói bán hàng', message, [{ text: 'Đóng' }]);
      } else {
        Alert.alert('Lỗi', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Tên sản phẩm</Text>
          <KeyboardAwareTextInput
            value={productName}
            onChangeText={setProductName}
            placeholder="VD: Cam sành Tiền Giang"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Danh mục</Text>
          {isLoadingCategories ? (
            <ActivityIndicator color="#076F32" />
          ) : categories.length > 0 ? (
            <CategoryCombobox
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          ) : (
            <Text style={styles.helperText}>Chưa có danh mục. Admin cần thêm danh mục trước.</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ảnh sản phẩm (gallery)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
            {thumbnails.map((image, imageIndex) => (
              <View key={`thumb-${imageIndex}-${image.uri}`} style={styles.imageThumbWrap}>
                <Image source={{ uri: image.uri }} style={styles.imageThumb} />
                <Pressable
                  onPress={() =>
                    setThumbnails((current) => current.filter((_, idx) => idx !== imageIndex))
                  }
                  style={styles.removeImageButton}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={handlePickThumbnails}
              style={({ pressed }) => [styles.addImageButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.addImageText}>+ Ảnh</Text>
            </Pressable>
          </ScrollView>
          <Text style={styles.helperText}>
            Ảnh đầu tiên là ảnh đại diện. Cần ít nhất một ảnh.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mô tả</Text>
          <KeyboardAwareTextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Mô tả chi tiết sản phẩm"
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.textArea]}
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Đơn vị</Text>
          <KeyboardAwareTextInput
            value={donVi}
            onChangeText={setDonVi}
            placeholder="kg, hộp, quả..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        {variants.map((variant, index) => (
          <VariantBlock
            key={variant.id}
            variant={variant}
            index={index}
            canRemove={variants.length > 1}
            onChange={(nextVariant) => updateVariant(index, nextVariant)}
            onRemove={() => removeVariant(index)}
          />
        ))}

        <Pressable
          onPress={addVariant}
          style={({ pressed }) => [styles.addVariantButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.addVariantText}>+ Thêm biến thể</Text>
        </Pressable>

        <ProductPromotionSection
          enabled={promotion.enabled}
          basePrice={promotionBasePrice}
          baseMaxPrice={promotionBaseMaxPrice}
          discountPercent={promotion.discountPercent}
          startDate={promotion.startDate}
          endDate={promotion.endDate}
          onChange={(partial) => setPromotion((prev) => ({ ...prev, ...partial }))}
          disabled={isSubmitting}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Đăng sản phẩm</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontSize: 15,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  combobox: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comboboxDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.7,
  },
  comboboxText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  comboboxPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  comboboxArrow: {
    color: '#64748b',
    fontSize: 12,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  modalOptionActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalOptionTextActive: {
    color: '#076F32',
  },
  modalOptionDescription: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
  },
  thumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailPicker: {
    width: 120,
    height: 120,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#b7dfd8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  thumbnailWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  thumbnailImage: {
    width: 120,
    height: 120,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  variantCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  variantTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  removeVariantText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  imageRow: {
    flexGrow: 0,
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 4,
  },
  imageThumbWrap: {
    position: 'relative',
    marginRight: 10,
    overflow: 'visible',
  },
  imageThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 2,
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: -1,
  },
  addImageButton: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#b7dfd8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  addImageText: {
    color: '#076F32',
    fontSize: 13,
    fontWeight: '800',
  },
  addVariantButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#b7dfd8',
    marginBottom: 16,
  },
  addVariantText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  submitButton: {
    minHeight: 50,
    marginTop: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
