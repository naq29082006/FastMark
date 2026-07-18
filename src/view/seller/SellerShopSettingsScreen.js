import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  getSellerShopSettingsOnBackend,
  updateSellerShopSettingsOnBackend,
} from '../../api/sellerOpsApi';
import { syncSellerAccess, applyShopSettingsToProfile } from '../../viewmodel/auth/authSlice';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import { reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import SellerLocationPickerScreen from './SellerLocationPickerScreen';
import TimePickerField from '../shared/components/TimePickerField';

export default function SellerShopSettingsScreen({ onBack, onChangePhone, onSaved }) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  const [address, setAddress] = useState('');
  const [systemAddress, setSystemAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [description, setDescription] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [allowReserve, setAllowReserve] = useState(true);
  const [depositPercent, setDepositPercent] = useState(0);
  const [pinHours, setPinHours] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const shop = await getSellerShopSettingsOnBackend(idToken);
      setAddress(shop.address || '');
      setSystemAddress(shop.systemAddress || '');
      setLatitude(Number.isFinite(Number(shop.latitude)) ? Number(shop.latitude) : null);
      setLongitude(Number.isFinite(Number(shop.longitude)) ? Number(shop.longitude) : null);
      setDescription(shop.description || '');
      setOpenTime(shop.openTime || '');
      setCloseTime(shop.closeTime || '');
      setIsOpen(Number(shop.isOpen) === 1);
      setAllowReserve(shop.allowReserve !== false);
      setDepositPercent(Math.max(0, Math.min(100, Number(shop.depositPercent) || 0)));
      setPinHours(Boolean(shop.pinHours));
      dispatch(applyShopSettingsToProfile(shop));
    } catch (loadError) {
      Alert.alert('Lỗi', loadError.message || 'Không tải được cài đặt cửa hàng.');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleUseCurrentLocation() {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Cần quyền truy cập vị trí để lấy tọa độ.');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;
      setLatitude(nextLat);
      setLongitude(nextLng);

      const displayName = await reverseGeocodeLocation(nextLat, nextLng);
      setSystemAddress(displayName || '');
    } catch (locationError) {
      Alert.alert('Lỗi', locationError.message || 'Không lấy được vị trí hiện tại.');
    } finally {
      setIsLocating(false);
    }
  }

  function handleLocationPicked({ latitude: lat, longitude: lng, systemAddress: picked }) {
    setLatitude(lat);
    setLongitude(lng);
    setSystemAddress(picked || '');
    setIsPickingLocation(false);
  }

  async function handleSave() {
    if (!address.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ cửa hàng.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Lỗi', 'Vui lòng chọn vị trí trên bản đồ hoặc lấy vị trí hiện tại.');
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const updated = await updateSellerShopSettingsOnBackend({
        idToken,
        payload: {
          description: description.trim(),
          address: address.trim(),
          systemAddress: systemAddress.trim(),
          latitude,
          longitude,
          openTime,
          closeTime,
          isOpen: isOpen ? 1 : 0,
          allowReserve,
          depositPercent: Math.max(0, Math.min(100, Number(depositPercent) || 0)),
          pinHours,
        },
      });
      dispatch(applyShopSettingsToProfile(updated));
      await dispatch(syncSellerAccess());
      onSaved?.(updated);
      Alert.alert('Thành công', 'Đã lưu cài đặt gian hàng.');
    } catch (saveError) {
      Alert.alert('Lỗi', saveError.message || 'Không lưu được cài đặt.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isPickingLocation) {
    return (
      <SellerLocationPickerScreen
        initialLocation={
          Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude }
            : null
        }
        onBack={() => setIsPickingLocation(false)}
        onConfirm={handleLocationPicked}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.screenWrap}>
        <ProfileSubScreen title="Cài đặt cửa hàng" onBack={onBack}>
          <View style={styles.centered}>
            <ActivityIndicator color="#076F32" size="large" />
          </View>
        </ProfileSubScreen>
      </View>
    );
  }

  const displayPhone = profile?.shopPhone || profile?.phone || 'Chưa cập nhật';
  const phoneVerified = Boolean(profile?.sellerPhoneVerified);

  return (
    <View style={styles.screenWrap}>
      <ProfileSubScreen title="Cài đặt cửa hàng" onBack={onBack}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin gian hàng</Text>
          <Text style={styles.hintText}>Tên & username lấy từ tài khoản</Text>
          <Text style={styles.readOnlyValue}>
            {profile?.fullName || 'Chưa có họ tên'} · @{profile?.userName || '—'}
          </Text>
          <Text style={[styles.hintText, { marginBottom: 12 }]}>
            Đổi họ tên / username ở tab Tài khoản. Shop chỉ quản lý bio, giờ mở cửa và địa chỉ.
          </Text>
        </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Số điện thoại</Text>
        <Text style={styles.readOnlyValue}>{displayPhone}</Text>
        <Text style={styles.hintText}>
          Số điện thoại liên hệ được quản lý ở tài khoản và phải xác minh bằng mã OTP.
        </Text>
        {phoneVerified ? (
          <Text style={styles.verifiedText}>Đã xác minh</Text>
        ) : (
          <Text style={styles.unverifiedText}>Chưa xác minh</Text>
        )}
        <Pressable
          onPress={onChangePhone}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>Đổi số điện thoại</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Địa chỉ</Text>
        <Field
          label="Địa chỉ người dùng nhập"
          value={address}
          onChangeText={setAddress}
          placeholder="Số nhà, ngõ, tên đường, phường/xã..."
          multiline
        />

        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>Vị trí cửa hàng</Text>
          <Text style={styles.locationValue}>
            {Number.isFinite(latitude) && Number.isFinite(longitude)
              ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : 'Chưa chọn vị trí'}
          </Text>

          {systemAddress ? (
            <View style={styles.systemAddressBox}>
              <Text style={styles.systemAddressLabel}>Địa chỉ hệ thống</Text>
              <Text style={styles.systemAddressText}>{systemAddress}</Text>
            </View>
          ) : null}

          <View style={styles.locationButtonRow}>
            <Pressable
              disabled={isLocating}
              onPress={handleUseCurrentLocation}
              style={({ pressed }) => [
                styles.locationButton,
                pressed && styles.buttonPressed,
                isLocating && styles.buttonDisabled,
              ]}
            >
              {isLocating ? (
                <ActivityIndicator color="#076F32" />
              ) : (
                <Text style={styles.locationButtonText}>Vị trí hiện tại</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setIsPickingLocation(true)}
              style={({ pressed }) => [styles.locationButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.locationButtonText}>Chọn trên bản đồ</Text>
            </Pressable>
          </View>
        </View>

        <Field
          label="Mô tả cửa hàng"
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Giờ hoạt động</Text>
        <TimePickerField
          label="Giờ mở cửa"
          value={openTime}
          onChange={setOpenTime}
          placeholder="08:00"
        />
        <TimePickerField
          label="Giờ đóng cửa"
          value={closeTime}
          onChange={setCloseTime}
          placeholder="21:00"
        />
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Đang mở cửa</Text>
            <Text style={styles.switchHint}>Bật/tắt trạng thái mở cửa hiện tại</Text>
          </View>
          <Switch
            value={isOpen}
            onValueChange={setIsOpen}
            trackColor={{ false: '#cbd5e1', true: '#7dd3c7' }}
            thumbColor={isOpen ? '#076F32' : '#f8fafc'}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Ghim giờ mở/đóng cửa</Text>
            <Text style={styles.switchHint}>
              Hiện khung giờ trên trang shop công khai (khi có gói active)
            </Text>
          </View>
          <Switch
            value={pinHours}
            onValueChange={setPinHours}
            trackColor={{ false: '#cbd5e1', true: '#7dd3c7' }}
            thumbColor={pinHours ? '#076F32' : '#f8fafc'}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Giữ hàng & đặt cọc</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Cho phép giữ hàng</Text>
            <Text style={styles.switchHint}>Buyer có thể gửi yêu cầu giữ sản phẩm</Text>
          </View>
          <Switch
            value={allowReserve}
            onValueChange={setAllowReserve}
            trackColor={{ false: '#cbd5e1', true: '#7dd3c7' }}
            thumbColor={allowReserve ? '#076F32' : '#f8fafc'}
          />
        </View>
        {allowReserve ? (
          <>
            <Text style={styles.label}>Phần trăm đặt cọc (0 = không cọc)</Text>
            <View style={styles.depositChipRow}>
              {[0, 10, 30, 50].map((pct) => {
                const active = depositPercent === pct;
                return (
                  <Pressable
                    key={pct}
                    onPress={() => setDepositPercent(pct)}
                    style={[styles.depositChip, active && styles.depositChipActive]}
                  >
                    <Text style={[styles.depositChipText, active && styles.depositChipTextActive]}>
                      {pct}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>

      <Pressable
        disabled={isSaving}
        onPress={handleSave}
        style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed, isSaving && styles.buttonDisabled]}
      >
        <Text style={styles.saveButtonText}>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
      </Pressable>
      </ProfileSubScreen>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onFocus,
  onBlur,
  multiline,
  placeholder,
  autoCapitalize,
  autoCorrect,
  error,
  hint,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[styles.input, multiline && styles.textArea, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
  },
  centered: { alignItems: 'center', paddingVertical: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  readOnlyValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  hintText: { fontSize: 13, color: '#64748b', lineHeight: 20, marginTop: 6 },
  verifiedText: { color: '#076F32', fontWeight: '700', fontSize: 13, marginTop: 6 },
  unverifiedText: { color: '#b45309', fontWeight: '700', fontSize: 13, marginTop: 6 },
  secondaryButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#076F32', fontWeight: '800' },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#fca5a5',
  },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  fieldError: {
    marginTop: 6,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldHint: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  locationBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 4 },
  locationValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  systemAddressBox: { marginTop: 10 },
  systemAddressLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  systemAddressText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  locationButtonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  locationButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b7dfd8',
  },
  locationButtonText: { color: '#076F32', fontWeight: '800', fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  switchInfo: { flex: 1, paddingRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  switchHint: { fontSize: 12, color: '#64748b', marginTop: 2 },
  depositChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  depositChip: {
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  depositChipActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  depositChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  depositChipTextActive: {
    color: '#076F32',
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
});
