import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

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
  loadUserProfile,
  logoutUser,
  updateUserProfile,
} from '../../viewmodel/auth/authSlice';

export default function ProfilePanel() {
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

  const isProfileLoading = profileStatus === 'loading';
  const displayName = profile?.fullName || user?.displayName || 'Fastmark user';

  useEffect(() => {
    if (!user || profile) {
      return;
    }
    dispatch(loadUserProfile());
  }, [dispatch, user, profile]);

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.headerEmail} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
          onPress={() => dispatch(logoutUser())}
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </View>

      {/* Segmented Control */}
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
            <LabeledInput
              label="Ảnh đại diện URL"
              value={profileForm.photoUrl}
              onChangeText={(value) => updateProfileField('photoUrl', value)}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://..."
            />
            <ActionButton
              label="Lưu thay đổi"
              onPress={handleSaveProfile}
            />
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

        {feedbackError ? (
          <Text style={styles.errorText}>{feedbackError}</Text>
        ) : null}

        {successMessage ? (
          <Text style={styles.successText}>{successMessage}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#0f766e',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  headerEmail: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
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
