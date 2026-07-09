import { useMemo, useState } from 'react';
import {
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

export function createVariant() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantName: '',
    price: '',
    quantity: '',
    images: [],
  };
}

export async function pickImages({ multiple = true } = {}) {
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

export function CategoryCombobox({ categories, value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(value)) || null,
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

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Chọn danh mục</Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {categories.map((category) => {
                const isActive = String(category.id) === String(value);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => {
                      onChange(String(category.id));
                      setIsOpen(false);
                    }}
                    style={[styles.modalOption, isActive && styles.modalOptionActive]}
                  >
                    <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                      {category.categoryName}
                    </Text>
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

export function ThumbnailField({ thumbnail, onChange, onError }) {
  async function handlePickThumbnail() {
    try {
      const picked = await pickImages({ multiple: false });
      if (picked[0]) {
        onChange(picked[0]);
      }
    } catch (error) {
      onError?.(error.message || 'Không chọn được ảnh thumbnail.');
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Ảnh thumbnail</Text>
      <View style={styles.thumbnailRow}>
        {thumbnail ? (
          <View style={styles.thumbnailWrap}>
            <Image source={{ uri: thumbnail.uri }} style={styles.thumbnailImage} />
            <Pressable onPress={() => onChange(null)} style={styles.removeImageButton}>
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
      <Text style={styles.helperText}>Bấm × để xóa và chọn ảnh khác.</Text>
    </View>
  );
}

export function VariantBlock({ variant, index, onChange, onRemove, canRemove }) {
  async function handlePickImages() {
    try {
      const picked = await pickImages({ multiple: true });
      if (!picked.length) {
        return;
      }
      onChange({
        ...variant,
        images: [...variant.images, ...picked],
        error: '',
      });
    } catch (error) {
      onChange({ ...variant, error: error.message });
    }
  }

  function removeImage(imageIndex) {
    onChange({
      ...variant,
      images: variant.images.filter((_, idx) => idx !== imageIndex),
      error: '',
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
          onChangeText={(value) => onChange({ ...variant, variantName: value, error: '' })}
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
            onChangeText={(value) => onChange({ ...variant, price: value, error: '' })}
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
            onChangeText={(value) => onChange({ ...variant, quantity: value, error: '' })}
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
              <Pressable onPress={() => removeImage(imageIndex)} style={styles.removeImageButton}>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    marginTop: 4,
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
  },
  imageThumbWrap: {
    position: 'relative',
    marginRight: 10,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
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
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

export { styles as sellerFormStyles };
