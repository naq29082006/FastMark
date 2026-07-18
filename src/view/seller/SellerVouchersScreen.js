import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createSellerVoucherOnBackend,
  deleteSellerVoucherOnBackend,
  listSellerVouchersOnBackend,
  updateSellerVoucherOnBackend,
} from '../../api/voucherApi';
import { formatPrice } from '../../core/utils/productFormat';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import ProfileSubScreen from '../profile/ProfileSubScreen';

const DISCOUNT_PERCENT = 1;
const DISCOUNT_FIXED = 2;

function formatDiscount(voucher) {
  if (Number(voucher.discountType) === DISCOUNT_FIXED) {
    return `Giảm ${formatPrice(voucher.discountValue)}`;
  }
  return `Giảm ${voucher.discountValue}%`;
}

export default function SellerVouchersScreen({ onBack }) {
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState(DISCOUNT_PERCENT);
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [quantity, setQuantity] = useState('100');
  const [isActive, setIsActive] = useState(true);

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const rows = await listSellerVouchersOnBackend(idToken);
      setVouchers(rows);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không tải được voucher.');
      setVouchers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  function resetForm() {
    setCode('');
    setTitle('');
    setDescription('');
    setDiscountType(DISCOUNT_PERCENT);
    setDiscountValue('10');
    setMinOrderAmount('0');
    setQuantity('100');
    setIsActive(true);
    setShowForm(false);
  }

  async function handleCreate() {
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 3) {
      Alert.alert('Thiếu mã', 'Mã voucher phải từ 3 ký tự.');
      return;
    }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Sai giá trị', 'Nhập giá trị giảm hợp lệ.');
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await getCurrentUserIdToken();
      await createSellerVoucherOnBackend({
        idToken,
        payload: {
          code: trimmedCode,
          title: title.trim() || trimmedCode,
          description: description.trim(),
          discountType,
          discountValue: value,
          minOrderAmount: Math.max(0, Number(minOrderAmount) || 0),
          quantity: Math.max(0, Number(quantity) || 0),
          status: isActive ? 1 : 0,
        },
      });
      resetForm();
      await loadVouchers();
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không tạo được voucher.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(voucher) {
    try {
      const idToken = await getCurrentUserIdToken();
      await updateSellerVoucherOnBackend({
        idToken,
        voucherId: voucher.id,
        payload: { status: Number(voucher.status) === 1 ? 0 : 1 },
      });
      await loadVouchers();
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không cập nhật được voucher.');
    }
  }

  function confirmDelete(voucher) {
    Alert.alert('Xóa voucher', `Xóa mã ${voucher.code}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            await deleteSellerVoucherOnBackend({ idToken, voucherId: voucher.id });
            await loadVouchers();
          } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không xóa được voucher.');
          }
        },
      },
    ]);
  }

  return (
    <ProfileSubScreen title="Voucher khuyến mãi" onBack={onBack}>
      <Pressable
        style={styles.createBtn}
        onPress={() => setShowForm((current) => !current)}
      >
        <Text style={styles.createBtnText}>{showForm ? 'Đóng form' : '+ Tạo voucher'}</Text>
      </Pressable>

      {showForm ? (
        <View style={styles.formCard}>
          <Text style={styles.label}>Mã code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="VD: GIAM10"
          />
          <Text style={styles.label}>Tiêu đề</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Giảm giá cuối tuần"
          />
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Điều kiện áp dụng..."
          />
          <Text style={styles.label}>Loại giảm</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, discountType === DISCOUNT_PERCENT && styles.chipActive]}
              onPress={() => setDiscountType(DISCOUNT_PERCENT)}
            >
              <Text
                style={[
                  styles.chipText,
                  discountType === DISCOUNT_PERCENT && styles.chipTextActive,
                ]}
              >
                %
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, discountType === DISCOUNT_FIXED && styles.chipActive]}
              onPress={() => setDiscountType(DISCOUNT_FIXED)}
            >
              <Text
                style={[
                  styles.chipText,
                  discountType === DISCOUNT_FIXED && styles.chipTextActive,
                ]}
              >
                Số tiền
              </Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Giá trị giảm</Text>
          <TextInput
            style={styles.input}
            value={discountValue}
            onChangeText={setDiscountValue}
            keyboardType="numeric"
          />
          <Text style={styles.label}>Đơn tối thiểu (đ)</Text>
          <TextInput
            style={styles.input}
            value={minOrderAmount}
            onChangeText={setMinOrderAmount}
            keyboardType="numeric"
          />
          <Text style={styles.label}>Số lượng</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />
          <View style={styles.switchRow}>
            <Text style={styles.labelInline}>Đang bật</Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
          <Pressable
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleCreate}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>{isSaving ? 'Đang lưu...' : 'Lưu voucher'}</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color="#076F32" style={{ marginTop: 24 }} />
      ) : vouchers.length === 0 ? (
        <Text style={styles.empty}>Chưa có voucher nào.</Text>
      ) : (
        vouchers.map((voucher) => (
          <View key={voucher.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.code}>{voucher.code}</Text>
              <Text
                style={[
                  styles.status,
                  Number(voucher.status) === 1 ? styles.statusOn : styles.statusOff,
                ]}
              >
                {Number(voucher.status) === 1 ? 'Bật' : 'Tắt'}
              </Text>
            </View>
            <Text style={styles.title}>{voucher.title || voucher.code}</Text>
            <Text style={styles.meta}>{formatDiscount(voucher)}</Text>
            <Text style={styles.meta}>
              Đã dùng {voucher.usedCount || 0}
              {voucher.quantity > 0 ? ` / ${voucher.quantity}` : ''}
            </Text>
            <View style={styles.cardActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => toggleStatus(voucher)}>
                <Text style={styles.secondaryBtnText}>
                  {Number(voucher.status) === 1 ? 'Tắt' : 'Bật'}
                </Text>
              </Pressable>
              <Pressable style={styles.dangerBtn} onPress={() => confirmDelete(voucher)}>
                <Text style={styles.dangerBtnText}>Xóa</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  createBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#076F32',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  createBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  labelInline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#E6F4EC',
    borderColor: '#076F32',
  },
  chipText: {
    color: '#64748b',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#055528',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#055528',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  code: {
    fontSize: 16,
    fontWeight: '800',
    color: '#055528',
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusOn: {
    backgroundColor: '#E6F4EC',
    color: '#055528',
  },
  statusOff: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  title: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#076F32',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#055528',
    fontWeight: '700',
  },
  dangerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#dc2626',
    fontWeight: '700',
  },
});
