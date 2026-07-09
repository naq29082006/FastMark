import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { updateProfileOnBackend } from '../../api/authBackendApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectAuthProfile, selectAuthUser } from '../../viewmodel/auth/authSelectors';
import { loadUserProfile } from '../../viewmodel/auth/authSlice';
import ProfileSubScreen from '../profile/ProfileSubScreen';

export default function SellerPhoneSetupScreen({ onBack, onContinue, mode = 'register' }) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const [phone, setPhone] = useState(profile?.phone || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSavePhone() {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError('Số điện thoại phải gồm đúng 10 chữ số.');
      return;
    }

    if (!user) {
      setError('Vui lòng đăng nhập lại.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const backendData = await updateProfileOnBackend({
        idToken,
        fullName: profile?.fullName || user.displayName || 'Fastmark user',
        phone: normalizedPhone,
      });

      const savedPhone = String(backendData?.user?.phone || '').trim();
      if (!/^\d{10}$/.test(savedPhone)) {
        throw new Error('Không lưu được số điện thoại lên hệ thống.');
      }

      await dispatch(loadUserProfile()).unwrap();
      onContinue(savedPhone);
    } catch (saveError) {
      setError(
        typeof saveError === 'string'
          ? saveError
          : saveError?.message || 'Không lưu được số điện thoại.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isChangeMode = mode === 'change';

  return (
    <ProfileSubScreen title={isChangeMode ? 'Đổi số điện thoại' : 'Thêm số điện thoại'} onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {isChangeMode ? 'Cập nhật số điện thoại liên hệ' : 'Cần số điện thoại để đăng ký người bán'}
        </Text>
        <Text style={styles.subtitle}>
          {isChangeMode
            ? 'Nhập số mới, sau đó xác minh bằng mã OTP để cập nhật số liên hệ cửa hàng.'
            : 'Hệ thống sẽ dùng số điện thoại này để xác minh trước khi vào form đăng ký.'}
        </Text>

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          value={phone}
          onChangeText={(value) => {
            setPhone(value.replace(/\D/g, '').slice(0, 10));
            setError('');
          }}
          keyboardType="phone-pad"
          placeholder="Nhập 10 chữ số"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={isSaving}
          onPress={handleSavePhone}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isSaving && styles.buttonDisabled,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{isChangeMode ? 'Tiếp tục xác minh' : 'Lưu và tiếp tục'}</Text>
          )}
        </Pressable>
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 21,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontSize: 15,
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d7377',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
