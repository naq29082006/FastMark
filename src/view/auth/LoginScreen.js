import { useEffect, useState } from 'react';
import {
  Image,
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
import { clearAuthFeedback, loginUser } from '../../viewmodel/auth/authSlice';
import { validateLoginForm } from '../../viewmodel/auth/authFormValidation';
import { getGoogleAuthSetupError } from '../../viewmodel/auth/googleAuthConfig';
import AuthDivider from './components/AuthDivider';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';
import GoogleSignInButton from './GoogleSignInButton';

export default function LoginScreen({ onGoRegister, onGoForgot }) {
  const dispatch = useDispatch();
  const actionStatus = useSelector(selectAuthActionStatus);
  const configError = useSelector(selectAuthConfigError);
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ login: '', password: '' });
  const [localError, setLocalError] = useState('');

  const isLoading = actionStatus === 'loading';
  const isDisabled = isLoading || Boolean(configError);
  const googleSetupError = getGoogleAuthSetupError();
  const displayError = configError || localError || (!fieldErrors.login && !fieldErrors.password ? error : '');

  useEffect(() => {
    dispatch(clearAuthFeedback());
  }, [dispatch]);

  function clearFieldError(field) {
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit() {
    const validationError = validateLoginForm({ login, password });
    if (validationError) {
      setFieldErrors({
        login: validationError.field === 'login' ? validationError.message : '',
        password: validationError.field === 'password' ? validationError.message : '',
      });
      setLocalError('');
      return;
    }

    setFieldErrors({ login: '', password: '' });
    setLocalError('');
    dispatch(clearAuthFeedback());

    try {
      await dispatch(loginUser({ login: login.trim(), password })).unwrap();
    } catch (loginError) {
      const payload =
        loginError && typeof loginError === 'object'
          ? loginError
          : { message: String(loginError || 'Đăng nhập thất bại.'), field: '' };

      const message = payload.message || 'Đăng nhập thất bại.';
      const field = payload.field || '';

      if (field === 'login') {
        setFieldErrors({ login: message, password: '' });
      } else if (field === 'password') {
        setFieldErrors({ login: '', password: message });
      } else if (/không tồn tại|không tìm thấy/i.test(message)) {
        setFieldErrors({ login: message, password: '' });
      } else if (/mật khẩu|google/i.test(message)) {
        setFieldErrors({ login: '', password: message });
      } else {
        setLocalError(message);
      }
    }
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
        <View style={styles.brandWrap}>
          <Image
            source={require('../../../assets/welcome.png')}
            style={styles.brandLogo}
            resizeMode="cover"
          />
          <Text style={styles.brandTitle}>Đăng nhập tài khoản</Text>
        </View>

        <View style={styles.card}>
          <AuthInput
            label="Email hoặc Username"
            value={login}
            onChangeText={(value) => {
              setLogin(value);
              clearFieldError('login');
              setLocalError('');
            }}
            error={fieldErrors.login}
            autoCapitalize="none"
            autoComplete="username"
          />

          <AuthInput
            label="Mật khẩu"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearFieldError('password');
              setLocalError('');
            }}
            error={fieldErrors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />

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
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Text>
          </Pressable>

          <Pressable onPress={() => onGoForgot?.()} style={styles.forgotLinkWrap} hitSlop={8}>
            <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
          </Pressable>

          <AuthDivider label="Hoặc đăng nhập với" />

          {googleSetupError ? (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>{googleSetupError}</Text>
            </View>
          ) : null}

          <GoogleSignInButton disabled={isLoading} onError={setLocalError} />
        </View>

        <Pressable
          onPress={onGoRegister}
          style={({ pressed }) => [
            styles.registerButton,
            pressed && styles.registerButtonPressed,
          ]}
        >
          <Text style={styles.registerButtonText}>Đăng ký tài khoản mới</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 18,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: AUTH_COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  card: {
    paddingVertical: 8,
  },
  forgotLinkWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: '700',
    color: AUTH_COLORS.primary,
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
  registerButton: {
    marginTop: 24,
    minHeight: 54,
    borderRadius: AUTH_RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.primary,
  },
  registerButtonPressed: {
    opacity: 0.85,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: AUTH_COLORS.primary,
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
