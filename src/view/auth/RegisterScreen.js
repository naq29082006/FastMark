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
import { validateRegisterForm } from '../../viewmodel/auth/authFormValidation';
import { getGoogleAuthSetupError } from '../../viewmodel/auth/googleAuthConfig';
import AuthBrand from './components/AuthBrand';
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

  const isLoading = actionStatus === 'loading';
  const isDisabled = isLoading || Boolean(configError);
  const googleSetupError = getGoogleAuthSetupError();
  const displayError = configError || localError || error;

  useEffect(() => {
    dispatch(clearAuthFeedback());
  }, [dispatch]);

  function handleSubmit() {
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={onGoBack} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <AuthBrand title="FastMark" subtitle="Tạo tài khoản mới" />

        <View style={styles.card}>
          <AuthInput
            label="Họ và tên"
            icon="👤"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setLocalError('');
            }}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
          />

          <AuthInput
            label="Email"
            icon="✉️"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setLocalError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="example@gmail.com"
          />

          <AuthInput
            label="Tên đăng nhập"
            icon="🪪"
            value={userName}
            onChangeText={(value) => {
              setUserName(value);
              setLocalError('');
            }}
            autoCapitalize="none"
            autoComplete="username"
            placeholder="nguyenvana"
          />

          <AuthInput
            label="Mật khẩu"
            icon="🔒"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setLocalError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="Tối thiểu 6 ký tự"
          />

          <AuthInput
            label="Xác nhận mật khẩu"
            icon="🔒"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setLocalError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
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

        <Pressable onPress={onGoLogin} style={styles.footerLinkWrap}>
          <Text style={styles.footerText}>
            Đã có tài khoản? <Text style={styles.footerLink}>Đăng nhập</Text>
          </Text>
        </Pressable>
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
    paddingTop: 52,
    paddingBottom: 36,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 30,
    color: AUTH_COLORS.text,
    marginTop: -2,
  },
  card: {
    backgroundColor: AUTH_COLORS.card,
    borderRadius: AUTH_RADIUS.card,
    padding: 22,
    borderWidth: 1,
    borderColor: '#eef2f2',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
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
