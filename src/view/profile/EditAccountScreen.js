import { useEffect, useState } from 'react';
import {
  Alert,
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

import CircularBackButton from '../shared/components/CircularBackButton';
import { checkRegisterAvailabilityOnBackend } from '../../api/authBackendApi';

import {
  selectAuthProfile,
  selectAuthProfileStatus,
  selectAuthUser,
} from '../../viewmodel/auth/authSelectors';
import {
  applyProfileWithCache,
  changePassword,
  clearAuthFeedback,
  updateUserProfile,
} from '../../viewmodel/auth/authSlice';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

function normalizeFullName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeUserName(value) {
  return String(value || '').trim();
}

function getFullNameError(value) {
  const normalized = normalizeFullName(value);
  if (normalized.length < 2) {
    return 'Họ tên phải có ít nhất 2 ký tự.';
  }
  if (normalized.length > 50) {
    return 'Họ tên không được vượt quá 50 ký tự.';
  }
  return '';
}

function getUserNameFormatError(value) {
  const normalized = normalizeUserName(value);
  if (!normalized) {
    return 'Vui lòng nhập username.';
  }
  if (normalized.length < 3 || normalized.length > 20) {
    return 'Username phải từ 3 đến 20 ký tự.';
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username chỉ được dùng chữ, số và dấu gạch dưới.';
  }
  return '';
}

function getCurrentPasswordError(value) {
  if (!String(value || '').trim()) {
    return 'Vui lòng nhập mật khẩu hiện tại.';
  }
  return '';
}

function getNewPasswordError(value) {
  const password = String(value || '');
  if (!password) {
    return 'Vui lòng nhập mật khẩu mới.';
  }
  if (password.length < 6) {
    return 'Mật khẩu mới cần tối thiểu 6 ký tự.';
  }
  return '';
}

function getConfirmPasswordError(value, newPassword) {
  if (!String(value || '')) {
    return 'Vui lòng xác nhận mật khẩu mới.';
  }
  if (value !== newPassword) {
    return 'Mật khẩu xác nhận chưa khớp.';
  }
  return '';
}

export default function EditAccountScreen({ onBack, onChangePhone }) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const profileStatus = useSelector(selectAuthProfileStatus);
  const user = useSelector(selectAuthUser);

  const isEmailAccount = profile?.authProvider === 'email';
  const [section, setSection] = useState('profile');
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    userName: '',
    phone: '',
    photoUrl: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({
    fullName: '',
    userName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isCheckingUserName, setIsCheckingUserName] = useState(false);

  const isProfileLoading = profileStatus === 'loading';
  const currentUserName = normalizeUserName(profile?.userName || '');

  useEffect(() => {
    setProfileForm({
      fullName: profile?.fullName || user?.displayName || '',
      userName: profile?.userName || '',
      phone: profile?.phone || '',
      photoUrl: profile?.photoUrl || '',
    });
    setFieldErrors({
      fullName: '',
      userName: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [profile, user]);

  useEffect(() => {
    dispatch(clearAuthFeedback());
    if (!isEmailAccount && section === 'security') {
      setSection('profile');
    }
  }, [dispatch, section, isEmailAccount]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthFeedback());
    };
  }, [dispatch]);

  function updateProfileField(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: '' }));
    }
  }

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: '' }));
    }
  }

  function handleFullNameBlur() {
    const normalized = normalizeFullName(profileForm.fullName);
    setProfileForm((current) => ({ ...current, fullName: normalized }));
    setFieldErrors((current) => ({ ...current, fullName: getFullNameError(normalized) }));
  }

  async function handleUserNameBlur() {
    const normalized = normalizeUserName(profileForm.userName);
    setProfileForm((current) => ({ ...current, userName: normalized }));

    const formatError = getUserNameFormatError(normalized);
    if (formatError) {
      setFieldErrors((current) => ({ ...current, userName: formatError }));
      return;
    }

    if (normalized.toLowerCase() === currentUserName.toLowerCase()) {
      setFieldErrors((current) => ({ ...current, userName: '' }));
      return;
    }

    setIsCheckingUserName(true);
    try {
      const availability = await checkRegisterAvailabilityOnBackend({ userName: normalized });
      if (availability?.userNameTaken) {
        setFieldErrors((current) => ({
          ...current,
          userName: 'Username đã được sử dụng.',
        }));
      } else {
        setFieldErrors((current) => ({ ...current, userName: '' }));
      }
    } catch (checkError) {
      setFieldErrors((current) => ({
        ...current,
        userName: checkError.message || 'Không kiểm tra được username.',
      }));
    } finally {
      setIsCheckingUserName(false);
    }
  }

  function handleCurrentPasswordBlur() {
    setFieldErrors((current) => ({
      ...current,
      currentPassword: getCurrentPasswordError(passwordForm.currentPassword),
    }));
  }

  function handleNewPasswordBlur() {
    const newPasswordError = getNewPasswordError(passwordForm.newPassword);
    setFieldErrors((current) => ({
      ...current,
      newPassword: newPasswordError,
      confirmPassword: passwordForm.confirmPassword
        ? getConfirmPasswordError(passwordForm.confirmPassword, passwordForm.newPassword)
        : current.confirmPassword,
    }));
  }

  function handleConfirmPasswordBlur() {
    setFieldErrors((current) => ({
      ...current,
      confirmPassword: getConfirmPasswordError(
        passwordForm.confirmPassword,
        passwordForm.newPassword
      ),
    }));
  }

  async function handleSaveProfile() {
    if (!user) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập lại trước khi cập nhật hồ sơ.');
      return;
    }

    const fullNameError = getFullNameError(profileForm.fullName);
    const userNameFormatError = getUserNameFormatError(profileForm.userName);
    setFieldErrors((current) => ({
      ...current,
      fullName: fullNameError,
      userName: userNameFormatError || current.userName,
    }));

    if (fullNameError || userNameFormatError || fieldErrors.userName || isCheckingUserName) {
      return;
    }

    const normalizedUserName = normalizeUserName(profileForm.userName);
    if (normalizedUserName.toLowerCase() !== currentUserName.toLowerCase()) {
      try {
        const availability = await checkRegisterAvailabilityOnBackend({
          userName: normalizedUserName,
        });
        if (availability?.userNameTaken) {
          setFieldErrors((current) => ({
            ...current,
            userName: 'Username đã được sử dụng.',
          }));
          return;
        }
      } catch (checkError) {
        Alert.alert('Lỗi', checkError.message || 'Không kiểm tra được username.');
        return;
      }
    }

    const payload = {
      fullName: normalizeFullName(profileForm.fullName),
      userName: normalizedUserName,
    };

    setIsSavingProfile(true);
    dispatch(clearAuthFeedback());
    try {
      dispatch(applyProfileWithCache({ ...profileForm, ...payload }));
      await dispatch(updateUserProfile(payload)).unwrap();
      dispatch(clearAuthFeedback());
      Alert.alert('Thành công', 'Đã lưu thông tin tài khoản.');
    } catch (saveError) {
      dispatch(clearAuthFeedback());
      const message =
        typeof saveError === 'string'
          ? saveError
          : saveError?.message || 'Không lưu được thông tin tài khoản.';
      Alert.alert('Lỗi', message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleChangePassword() {
    const currentPasswordError = getCurrentPasswordError(passwordForm.currentPassword);
    const newPasswordError = getNewPasswordError(passwordForm.newPassword);
    const confirmPasswordError = getConfirmPasswordError(
      passwordForm.confirmPassword,
      passwordForm.newPassword
    );

    setFieldErrors((current) => ({
      ...current,
      currentPassword: currentPasswordError,
      newPassword: newPasswordError,
      confirmPassword: confirmPasswordError,
    }));

    if (currentPasswordError || newPasswordError || confirmPasswordError) {
      return;
    }

    setIsChangingPassword(true);
    dispatch(clearAuthFeedback());

    dispatch(changePassword(passwordForm))
      .unwrap()
      .then((result) => {
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setFieldErrors((current) => ({
          ...current,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        dispatch(clearAuthFeedback());
        Alert.alert('Thành công', result?.message || 'Đã đổi mật khẩu.');
      })
      .catch((message) => {
        dispatch(clearAuthFeedback());
        Alert.alert(
          'Lỗi',
          typeof message === 'string' ? message : 'Không đổi được mật khẩu.'
        );
      })
      .finally(() => {
        setIsChangingPassword(false);
      });
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topBar}>
        <CircularBackButton onPress={onBack} variant="light" />
        <Text style={styles.topBarTitle}>Sửa thông tin tài khoản</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {isEmailAccount ? (
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
            onPress={() => setSection('security')}
          >
            <Text style={[styles.segmentText, section === 'security' && styles.segmentTextActive]}>
              Mật khẩu
            </Text>
          </Pressable>
        </View>
      ) : null}

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
              onFocus={() => setFieldErrors((current) => ({ ...current, fullName: '' }))}
              onBlur={handleFullNameBlur}
              autoComplete="name"
              placeholder="Nhập họ và tên"
              error={fieldErrors.fullName}
              hint="Tối thiểu 2 ký tự."
            />

            <LabeledInput
              label="Username"
              value={profileForm.userName}
              onChangeText={(value) => updateProfileField('userName', value)}
              onFocus={() => setFieldErrors((current) => ({ ...current, userName: '' }))}
              onBlur={handleUserNameBlur}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="vd: nguyen_van_a"
              error={fieldErrors.userName}
              hint="3-20 ký tự, chỉ chữ, số và dấu gạch dưới."
            />

            <View style={styles.phoneBlock}>
              <Text style={styles.phoneLabel}>Số điện thoại</Text>
              <Text style={styles.phoneValue}>
                {profile?.phone || profileForm.phone || 'Chưa cập nhật'}
              </Text>
              <Text style={styles.phoneHint}>
                Số điện thoại chỉ được lưu sau khi xác minh OTP thành công.
              </Text>
              {onChangePhone ? (
                <Pressable
                  onPress={onChangePhone}
                  style={({ pressed }) => [
                    styles.changePhoneButton,
                    pressed && styles.changePhoneButtonPressed,
                  ]}
                >
                  <Text style={styles.changePhoneButtonText}>
                    {profile?.phone ? 'Đổi số điện thoại' : 'Thêm số điện thoại'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <ActionButton
              disabled={isCheckingUserName || isSavingProfile}
              label={
                isSavingProfile
                  ? 'Đang lưu...'
                  : isCheckingUserName
                    ? 'Đang kiểm tra...'
                    : 'Lưu thay đổi'
              }
              onPress={handleSaveProfile}
            />
          </>
        ) : (
          <>
            <LabeledInput
              label="Mật khẩu hiện tại"
              value={passwordForm.currentPassword}
              onChangeText={(value) => updatePasswordField('currentPassword', value)}
              onFocus={() => setFieldErrors((current) => ({ ...current, currentPassword: '' }))}
              onBlur={handleCurrentPasswordBlur}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              placeholder="••••••••"
              editable={!isChangingPassword}
              error={fieldErrors.currentPassword}
            />
            <LabeledInput
              label="Mật khẩu mới"
              value={passwordForm.newPassword}
              onChangeText={(value) => updatePasswordField('newPassword', value)}
              onFocus={() => setFieldErrors((current) => ({ ...current, newPassword: '' }))}
              onBlur={handleNewPasswordBlur}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Tối thiểu 6 ký tự"
              editable={!isChangingPassword}
              error={fieldErrors.newPassword}
              hint="Tối thiểu 6 ký tự."
            />
            <LabeledInput
              label="Xác nhận mật khẩu mới"
              value={passwordForm.confirmPassword}
              onChangeText={(value) => updatePasswordField('confirmPassword', value)}
              onFocus={() => setFieldErrors((current) => ({ ...current, confirmPassword: '' }))}
              onBlur={handleConfirmPasswordBlur}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              editable={!isChangingPassword}
              error={fieldErrors.confirmPassword}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput({ label, error, hint, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94a3b8"
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
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
    paddingTop: 8,
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
  phoneBlock: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  phoneLabel: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  phoneValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  phoneHint: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  changePhoneButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f3f1',
    borderWidth: 1,
    borderColor: '#b7dfd8',
  },
  changePhoneButtonPressed: {
    opacity: 0.85,
  },
  changePhoneButtonText: {
    color: '#0d7377',
    fontSize: 14,
    fontWeight: '800',
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
  inputError: {
    borderColor: '#fca5a5',
  },
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
