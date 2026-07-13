import { useEffect, useState } from 'react';
import {
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
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';

import CircularBackButton from '../shared/components/CircularBackButton';

import {
  selectAuthError,
  selectAuthProfile,
  selectAuthProfileStatus,
  selectAuthSuccessMessage,
  selectAuthUser,
} from '../../viewmodel/auth/authSelectors';
import {
  applyProfileWithCache,
  changePassword,
  clearAuthFeedback,
  updateUserProfile,
  uploadUserAvatar,
} from '../../viewmodel/auth/authSlice';

export default function EditAccountScreen({ onBack }) {
  const dispatch = useDispatch();
  const error = useSelector(selectAuthError);
  const profile = useSelector(selectAuthProfile);
  const profileStatus = useSelector(selectAuthProfileStatus);
  const successMessage = useSelector(selectAuthSuccessMessage);
  const user = useSelector(selectAuthUser);
  const [section, setSection] = useState('profile');
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    photoUrl: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const isProfileLoading = profileStatus === 'loading';
  const displayName = profile?.fullName || user?.displayName || 'Fastmark user';
  const avatarUrl = profileForm.photoUrl || profile?.photoUrl || user?.photoURL || '';

  useEffect(() => {
    setProfileForm({
      fullName: profile?.fullName || user?.displayName || '',
      phone: profile?.phone || '',
      photoUrl: profile?.photoUrl || user?.photoURL || '',
    });
  }, [profile, user]);

  useEffect(() => {
    setLocalError('');
    dispatch(clearAuthFeedback());
  }, [dispatch, section]);

  function updateProfileField(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
  }

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
  }

  function handleSaveProfile() {
    if (!user) {
      setLocalError('Vui lòng đăng nhập lại trước khi cập nhật hồ sơ.');
      return;
    }

    if (!profileForm.fullName.trim()) {
      setLocalError('Vui lòng điền họ tên.');
      return;
    }

    setLocalError('');
    dispatch(applyProfileWithCache(profileForm));
    dispatch(updateUserProfile(profileForm));
  }

  async function handlePickAvatar() {
    if (!user) {
      setLocalError('Vui lòng đăng nhập lại trước khi đổi ảnh đại diện.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLocalError('Cần quyền truy cập thư viện ảnh để chọn avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      setLocalError('Không đọc được ảnh đã chọn. Vui lòng thử lại.');
      return;
    }

    setLocalError('');
    setIsUploadingAvatar(true);

    dispatch(
      uploadUserAvatar({
        imageBase64: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
      })
    )
      .unwrap()
      .then((payload) => {
        setProfileForm((current) => ({
          ...current,
          photoUrl: payload.profile?.photoUrl || current.photoUrl,
        }));
      })
      .catch((message) => {
        setLocalError(typeof message === 'string' ? message : 'Không upload được ảnh đại diện.');
      })
      .finally(() => {
        setIsUploadingAvatar(false);
      });
  }

  function handleChangePassword() {
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setLocalError('Vui lòng nhập đủ thông tin đổi mật khẩu.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setLocalError('Mật khẩu mới chưa khớp.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setLocalError('Mật khẩu mới cần tối thiểu 6 ký tự.');
      return;
    }

    setLocalError('');
    setIsChangingPassword(true);

    dispatch(changePassword(passwordForm))
      .unwrap()
      .then(() => {
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      })
      .catch((message) => {
        setLocalError(typeof message === 'string' ? message : 'Không đổi được mật khẩu.');
      })
      .finally(() => {
        setIsChangingPassword(false);
      });
  }

  const feedbackError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <CircularBackButton onPress={onBack} variant="light" />
        <Text style={styles.topBarTitle}>Sửa thông tin tài khoản</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segment, section === 'profile' && styles.segmentActive]}
          onPress={() => setSection('profile')}
        >
          <Text style={[styles.segmentText, section === 'profile' && styles.segmentTextActive]}>
            Hồ sơ
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, section === 'security' && styles.segmentActive]}
          pressRetentionOffset={8}
          onPress={() => setSection('security')}
        >
          <Text style={[styles.segmentText, section === 'security' && styles.segmentTextActive]}>
            Mật khẩu
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {section === 'profile' ? (
          <>
            <View style={styles.avatarSection}>
              <AvatarPreview name={displayName} photoUrl={avatarUrl} size={96} />
              <Pressable
                accessibilityRole="button"
                disabled={isUploadingAvatar}
                style={({ pressed }) => [
                  styles.avatarButton,
                  pressed && styles.avatarButtonPressed,
                  isUploadingAvatar && styles.avatarButtonDisabled,
                ]}
                onPress={handlePickAvatar}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.avatarButtonText}>Chọn ảnh đại diện</Text>
                )}
              </Pressable>
            </View>

            <LabeledInput
              label="Họ tên"
              value={profileForm.fullName}
              onChangeText={(value) => updateProfileField('fullName', value)}
              autoComplete="name"
              placeholder="Nhập họ và tên"
            />
            <LabeledInput
              label="Số điện thoại"
              value={profileForm.phone}
              onChangeText={(value) => updateProfileField('phone', value)}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="Nhập số điện thoại"
            />
            <ActionButton label="Lưu thay đổi" onPress={handleSaveProfile} />
          </>
        ) : (
          <>
            <LabeledInput
              label="Mật khẩu hiện tại"
              value={passwordForm.currentPassword}
              onChangeText={(value) => updatePasswordField('currentPassword', value)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              placeholder="••••••••"
              editable={!isChangingPassword}
            />
            <LabeledInput
              label="Mật khẩu mới"
              value={passwordForm.newPassword}
              onChangeText={(value) => updatePasswordField('newPassword', value)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Tối thiểu 6 ký tự"
              editable={!isChangingPassword}
            />
            <LabeledInput
              label="Xác nhận mật khẩu mới"
              value={passwordForm.confirmPassword}
              onChangeText={(value) => updatePasswordField('confirmPassword', value)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              editable={!isChangingPassword}
            />
            <ActionButton
              disabled={isChangingPassword}
              label={isChangingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
              onPress={handleChangePassword}
            />
          </>
        )}

        {isProfileLoading && !profile ? (
          <Text style={styles.infoText}>Đang tải dữ liệu hồ sơ...</Text>
        ) : null}

        {feedbackError ? <Text style={styles.errorText}>{feedbackError}</Text> : null}

        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AvatarPreview({ name, photoUrl, size }) {
  const initial = (name || 'U').charAt(0).toUpperCase();

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.avatarImage,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

function LabeledInput({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#94a3b8" style={styles.input} />
    </View>
  );
}

function ActionButton({ disabled = false, label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  topBarTitle: {
    flex: 1,
    marginHorizontal: 12,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarSpacer: {
    width: 36,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#0f766e',
    fontWeight: '900',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarCircle: {
    backgroundColor: 'rgba(15,118,110,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    backgroundColor: 'rgba(15,118,110,0.15)',
  },
  avatarText: {
    color: '#0f766e',
    fontWeight: '900',
  },
  avatarButton: {
    minHeight: 44,
    marginTop: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  avatarButtonPressed: {
    opacity: 0.82,
  },
  avatarButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  avatarButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  field: {
    marginTop: 14,
  },
  label: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
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
  },
  actionButton: {
    minHeight: 50,
    marginTop: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  infoText: {
    marginTop: 14,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 14,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  successText: {
    marginTop: 14,
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
  },
});
