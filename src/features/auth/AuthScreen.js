import * as WebBrowser from 'expo-web-browser';
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
  selectAuthActionStatus,
  selectAuthConfigError,
  selectAuthError,
  selectAuthSuccessMessage,
} from './authSelectors';
import { clearAuthFeedback, loginUser, registerUser } from './authSlice';
import GoogleSignInButton from './GoogleSignInButton';
import { getGoogleAuthSetupError } from './googleAuthConfig';

// Required for Expo OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function AuthScreen() {
  const dispatch = useDispatch();
  const actionStatus = useSelector(selectAuthActionStatus);
  const configError = useSelector(selectAuthConfigError);
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [localError, setLocalError] = useState('');

  const isRegister = mode === 'register';
  const isLoading = actionStatus === 'loading';
  const isFormDisabled = isLoading || Boolean(configError);
  const googleSetupError = getGoogleAuthSetupError();
  const isGoogleDisabled = isLoading || Boolean(googleSetupError);

  useEffect(() => {
    setLocalError('');
    dispatch(clearAuthFeedback());
  }, [dispatch, mode]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
  }

  function validateForm() {
    if (isRegister && !form.fullName.trim()) {
      return 'Vui lòng nhập họ tên.';
    }
    if (!form.email.trim() || !form.password) {
      return 'Vui lòng nhập email và mật khẩu.';
    }
    if (isRegister && form.password !== form.confirmPassword) {
      return 'Mật khẩu xác nhận chưa khớp.';
    }
    if (form.password.length < 6) {
      return 'Mật khẩu cần tối thiểu 6 ký tự.';
    }
    return '';
  }

  function handleSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    dispatch((isRegister ? registerUser : loginUser)(form));
  }

  const displayError = configError || localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>F</Text>
          </View>
          <Text style={styles.brandName}>Fastmark</Text>
          <Text style={styles.brandTagline}>Khám phá địa điểm quanh bạn</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Tab Switch */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, !isRegister && styles.tabActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
                Đăng nhập
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, isRegister && styles.tabActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
                Đăng ký
              </Text>
            </Pressable>
          </View>

          {/* Email / Password fields */}
          {isRegister && (
            <LabeledInput
              label="Họ tên"
              value={form.fullName}
              onChangeText={(v) => updateField('fullName', v)}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
            />
          )}
          <LabeledInput
            label="Email"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <LabeledInput
            label="Mật khẩu"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="Tối thiểu 6 ký tự"
          />
          {isRegister && (
            <LabeledInput
              label="Xác nhận mật khẩu"
              value={form.confirmPassword}
              onChangeText={(v) => updateField('confirmPassword', v)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
            />
          )}

          {/* Error / Success */}
          {displayError ? (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{displayError}</Text>
            </View>
          ) : null}
          {successMessage ? (
            <View style={[styles.alertBox, styles.alertBoxSuccess]}>
              <Text style={[styles.alertText, styles.alertTextSuccess]}>{successMessage}</Text>
            </View>
          ) : null}

          {/* Primary CTA */}
          <Pressable
            accessibilityRole="button"
            disabled={isFormDisabled}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isLoading) && styles.primaryButtonPressed,
              isFormDisabled && styles.primaryButtonDisabled,
            ]}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading
                ? 'Đang xử lý...'
                : isRegister
                  ? 'Tạo tài khoản'
                  : 'Đăng nhập'}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>hoặc tiếp tục với</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          {googleSetupError ? (
            <View style={styles.googleSetupBox}>
              <Text style={styles.googleSetupText}>{googleSetupError}</Text>
            </View>
          ) : (
            <GoogleSignInButton
              disabled={isGoogleDisabled}
              onError={setLocalError}
            />
          )}
        </View>

        <Text style={styles.footerNote}>
          Bằng cách đăng nhập, bạn đồng ý với Điều khoản sử dụng của Fastmark.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0faf8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  // ── Brand Header ─────────────────────────────────────────
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  brandIconText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandTagline: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // ── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },

  // ── Tabs ─────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0f766e',
    fontWeight: '900',
  },

  // ── Form fields ──────────────────────────────────────────
  field: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },

  // ── Alert ────────────────────────────────────────────────
  alertBox: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b91c1c',
  },
  alertBoxSuccess: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: '#22c55e',
  },
  alertTextSuccess: {
    color: '#15803d',
  },

  // ── Primary Button ────────────────────────────────────────
  primaryButton: {
    height: 52,
    marginTop: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },

  // ── Divider ───────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // ── Google setup hint ─────────────────────────────────────
  googleSetupBox: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  googleSetupText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    lineHeight: 18,
  },

  // ── Footer ────────────────────────────────────────────────
  footerNote: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
});
