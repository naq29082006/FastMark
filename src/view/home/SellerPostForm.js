import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { createProductOnBackend, getProductCategoriesOnBackend } from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { syncSellerAccess } from '../../viewmodel/auth/authSlice';
import { useDispatch } from 'react-redux';

function createVariant() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantName: '',
    price: '',
    quantity: '',
    images: [],
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
  async function handlePickImages() {
    try {
      const picked = await pickImages({ multiple: true });
      if (!picked.length) {
        return;
      }
      onChange({
        ...variant,
        images: [...variant.images, ...picked],
      });
    } catch (error) {
      onChange({ ...variant, error: error.message });
    }
  }

  function removeImage(imageIndex) {
    onChange({
      ...variant,
      images: variant.images.filter((_, idx) => idx !== imageIndex),
    });
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
        <TextInput
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
          <TextInput
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
          <TextInput
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
        <Text style={styles.label}>Ảnh biến thể</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
          {variant.images.map((image, imageIndex) => (
            <View key={`${variant.id}-${imageIndex}`} style={styles.imageThumbWrap}>
              <Image source={{ uri: image.uri }} style={styles.imageThumb} />
              <Pressable
                onPress={() => removeImage(imageIndex)}
                style={styles.removeImageButton}
              >
                <Text style={styles.removeImageText}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={handlePickImages}
            style={({ pressed }) => [styles.addImageButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.addImageText}>+ Ảnh</Text>
          </Pressable>
        </ScrollView>
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
  const [thumbnail, setThumbnail] = useState(null);
  const [variants, setVariants] = useState([createVariant()]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handlePickThumbnail() {
    setError('');

    try {
      const picked = await pickImages({ multiple: false });
      if (!picked.length) {
        return;
      }
      setThumbnail(picked[0]);
    } catch (pickError) {
      setError(pickError.message || 'Không chọn được ảnh thumbnail.');
    }
  }

  async function handleSubmit() {
    setError('');
    setSuccessMessage('');

    if (!productName.trim()) {
      setError('Vui lòng nhập tên sản phẩm.');
      return;
    }

    if (!categoryId) {
      setError('Vui lòng chọn danh mục sản phẩm.');
      return;
    }

    if (!thumbnail) {
      setError('Vui lòng chọn ảnh thumbnail.');
      return;
    }

    const normalizedVariants = variants.map((variant) => ({
      variantName: variant.variantName.trim(),
      price: Number(variant.price),
      quantity: Number(variant.quantity || 0),
      images: variant.images.map((image) => ({
        imageBase64: image.base64,
        mimeType: image.mimeType,
      })),
    }));

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
      if (!variant.images.length) {
        setError(`Biến thể ${index + 1}: cần ít nhất một ảnh.`);
        return;
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
          thumbnailBase64: thumbnail.base64,
          thumbnailMimeType: thumbnail.mimeType,
          variants: normalizedVariants,
        },
      });

      const createdProductId = result?.product?.id;
      setSuccessMessage('Đăng sản phẩm thành công.');
      setProductName('');
      setDescription('');
      setDonVi('');
      setCategoryId('');
      setThumbnail(null);
      setVariants([createVariant()]);
      dispatch(syncSellerAccess());

      if (createdProductId) {
        onProductCreated?.(createdProductId);
      }
    } catch (submitError) {
      setError(submitError.message || 'Không đăng được sản phẩm.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Tạo sản phẩm mới với ảnh, mô tả và biến thể</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Tên sản phẩm</Text>
          <TextInput
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
            <ActivityIndicator color="#0d7377" />
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
          <Text style={styles.label}>Ảnh thumbnail</Text>
          <View style={styles.thumbnailRow}>
            {thumbnail ? (
              <View style={styles.thumbnailWrap}>
                <Image source={{ uri: thumbnail.uri }} style={styles.thumbnailImage} />
                <Pressable
                  onPress={() => setThumbnail(null)}
                  style={styles.removeImageButton}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handlePickThumbnail}
                style={({ pressed }) => [styles.thumbnailPicker, pressed && styles.buttonPressed]}
              >
                <Text style={styles.addImageText}>+ Chọn ảnh</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.helperText}>Ảnh đại diện hiển thị trên danh sách sản phẩm.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
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
          <TextInput
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

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
    </ScrollView>
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
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    lineHeight: 22,
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
    borderColor: '#0d7377',
    backgroundColor: '#e8f3f1',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalOptionTextActive: {
    color: '#0d7377',
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
    color: '#0d7377',
    fontSize: 13,
    fontWeight: '800',
  },
  addVariantButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f3f1',
    borderWidth: 1,
    borderColor: '#b7dfd8',
    marginBottom: 16,
  },
  addVariantText: {
    color: '#0d7377',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  successText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d7377',
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
