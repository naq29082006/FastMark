import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthActionStatus,
  selectAuthConfigError,
  selectAuthError,
  selectAuthSuccessMessage,
} from '../../viewmodel/auth/authSelectors';
import { clearAuthFeedback, registerUser } from '../../viewmodel/auth/authSlice';
import { checkRegisterAvailabilityOnBackend } from '../../api/authBackendApi';
import { validateRegisterForm } from '../../viewmodel/auth/authFormValidation';
import { getGoogleAuthSetupError } from '../../viewmodel/auth/googleAuthConfig';
import CircularBackButton from '../shared/components/CircularBackButton';
import AuthDivider from './components/AuthDivider';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';
import GoogleSignInButton from './GoogleSignInButton';

export default function RegisterScreen({ onGoLogin, onGoBack }) {
  const dispatch = useDispatch();
  const actionStatus = useSelector(selectAuthActionStatus);
  const configError = useSelector(selectAuthConfigError);
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [localError, setLocalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const isLoading = actionStatus === 'loading';
  const isDisabled = isLoading || Boolean(configError);
  const googleSetupError = getGoogleAuthSetupError();
  const displayError = configError || localError || error;

  useEffect(() => {
    dispatch(clearAuthFeedback());
  }, [dispatch]);

  function setFieldError(field, message) {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  }

  function validateFullNameField() {
    const value = fullName.trim();
    if (!value) {
      setFieldError('fullName', 'Vui lòng nhập họ và tên.');
      return false;
    }
    if (value.length < 2 || value.length > 50) {
      setFieldError('fullName', 'Họ tên phải từ 2 đến 50 ký tự.');
      return false;
    }
    setFieldError('fullName', '');
    return true;
  }

  async function validateUserNameField() {
    const value = userName.trim();
    if (!value) {
      setFieldError('userName', 'Vui lòng nhập username.');
      return false;
    }
    if (value.length < 3 || value.length > 20) {
      setFieldError('userName', 'Username phải từ 3 đến 20 ký tự.');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setFieldError('userName', 'Username chỉ được dùng chữ, số và dấu gạch dưới.');
      return false;
    }

    try {
      const { userNameTaken } = await checkRegisterAvailabilityOnBackend({ userName: value });
      if (userNameTaken) {
        setFieldError('userName', 'Username này đã tồn tại.');
        return false;
      }
    } catch {
      // Không chặn khi API check lỗi; đăng ký sẽ kiểm tra lại phía server.
    }
    setFieldError('userName', '');
    return true;
  }

  async function validateEmailField() {
    const value = email.trim();
    if (!value) {
      setFieldError('email', 'Vui lòng nhập email.');
      return false;
    }
    if (value.length < 6 || value.length > 100) {
      setFieldError('email', 'Email phải từ 6 đến 100 ký tự.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError('email', 'Email không hợp lệ.');
      return false;
    }

    try {
      const { emailTaken } = await checkRegisterAvailabilityOnBackend({ email: value });
      if (emailTaken) {
        setFieldError('email', 'Email này đã được sử dụng.');
        return false;
      }
    } catch {
      // Không chặn khi API check lỗi; đăng ký sẽ kiểm tra lại phía server.
    }
    setFieldError('email', '');
    return true;
  }

  function validatePasswordField() {
    if (!password) {
      setFieldError('password', 'Vui lòng nhập mật khẩu.');
      return false;
    }
    if (password.length < 6 || password.length > 32) {
      setFieldError('password', 'Mật khẩu phải từ 6 đến 32 ký tự.');
      return false;
    }
    setFieldError('password', '');
    return true;
  }

  function validateConfirmPasswordField() {
    if (!confirmPassword) {
      setFieldError('confirmPassword', 'Vui lòng nhập lại mật khẩu.');
      return false;
    }
    if (confirmPassword !== password) {
      setFieldError('confirmPassword', 'Mật khẩu xác nhận chưa khớp.');
      return false;
    }
    setFieldError('confirmPassword', '');
    return true;
  }

  async function handleSubmit() {
    const checks = [
      validateFullNameField(),
      validatePasswordField(),
      validateConfirmPasswordField(),
      await validateUserNameField(),
      await validateEmailField(),
    ];
    if (checks.some((ok) => !ok)) {
      return;
    }

    const validationError = validateRegisterForm({
      fullName,
      email,
      userName,
      password,
      confirmPassword,
      acceptedTerms,
    });

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError('');
    dispatch(
      registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        userName: userName.trim(),
        password,
      })
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <CircularBackButton
            onPress={onGoBack}
            variant="surface"
            size={40}
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>Đăng ký tài khoản mới</Text>
        </View>

        <View style={styles.card}>
          <AuthInput
            label="Họ và tên"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setLocalError('');
              setFieldError('fullName', '');
            }}
            onBlur={validateFullNameField}
            error={fieldErrors.fullName}
            autoCapitalize="words"
            autoComplete="name"
          />

          <AuthInput
            label="Username"
            value={userName}
            onChangeText={(value) => {
              setUserName(value);
              setLocalError('');
              setFieldError('userName', '');
            }}
            onBlur={validateUserNameField}
            error={fieldErrors.userName}
            autoCapitalize="none"
            autoComplete="username"
          />

          <AuthInput
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setLocalError('');
              setFieldError('email', '');
            }}
            onBlur={validateEmailField}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <AuthInput
            label="Mật khẩu"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setLocalError('');
              setFieldError('password', '');
            }}
            onBlur={validatePasswordField}
            error={fieldErrors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <AuthInput
            label="Xác nhận mật khẩu"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setLocalError('');
              setFieldError('confirmPassword', '');
            }}
            onBlur={validateConfirmPasswordField}
            error={fieldErrors.confirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />

          <Pressable
            style={styles.termsRow}
            onPress={() => setAcceptedTerms((value) => !value)}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>
              Tôi đồng ý với các <Text style={styles.termsLink}>Điều khoản dịch vụ</Text> và{' '}
              <Text style={styles.termsLink}>Chính sách bảo mật</Text> của FastMark.
            </Text>
          </Pressable>

          {displayError ? (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{displayError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={[styles.alertBox, styles.alertSuccess]}>
              <Text style={[styles.alertText, styles.alertTextSuccess]}>{successMessage}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={isDisabled}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isLoading) && styles.primaryButtonPressed,
              isDisabled && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Text>
          </Pressable>

          <AuthDivider label="Hoặc đăng ký bằng" />

          {googleSetupError ? (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>{googleSetupError}</Text>
            </View>
          ) : null}

          <GoogleSignInButton disabled={isLoading} onError={setLocalError} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: AUTH_COLORS.text,
  },
  backButton: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    backgroundColor: '#ffffff',
  },
  card: {
    paddingVertical: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: AUTH_COLORS.primary,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
    fontWeight: '500',
  },
  termsLink: {
    color: AUTH_COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  alertBox: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.errorBg,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  alertSuccess: {
    backgroundColor: AUTH_COLORS.successBg,
    borderLeftColor: '#22c55e',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    color: AUTH_COLORS.errorText,
    lineHeight: 18,
  },
  alertTextSuccess: {
    color: AUTH_COLORS.successText,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: AUTH_RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.primary,
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  hintBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  hintText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#92400e',
    fontWeight: '600',
  },
  footerLinkWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    fontWeight: '500',
  },
  footerLink: {
    color: AUTH_COLORS.primary,
    fontWeight: '800',
  },
});
