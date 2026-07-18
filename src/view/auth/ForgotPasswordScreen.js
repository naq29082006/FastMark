import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  requestPasswordResetOnBackend,
  resetPasswordOnBackend,
  verifyPasswordResetOtpOnBackend,
} from '../../api/authBackendApi';
import CircularBackButton from '../shared/components/CircularBackButton';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';

const STEPS = {
  EMAIL: 1,
  OTP: 2,
  PASSWORD: 3,
};

export default function ForgotPasswordScreen({ onBack, onSuccess }) {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleRequestOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const payload = await requestPasswordResetOnBackend({ email: normalizedEmail });
      setEmail(normalizedEmail);
      setResendCooldown(payload.data?.verification?.resendCooldownSeconds || 180);
      setSuccessMessage('Đã gừi mã OTP đến email của bạn.');
      setStep(STEPS.OTP);
    } catch (requestError) {
      setError(requestError.message || 'Không gừi được OTP.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim() || otp.trim().length < 6) {
      setError('Vui lòng nhập mã OTP 6 số.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await verifyPasswordResetOtpOnBackend({ email, code: otp.trim() });
      setResetToken(data.resetToken);
      setSuccessMessage('Xác thực OTP thành công. Nhập mật khẩu mới.');
      setStep(STEPS.PASSWORD);
    } catch (verifyError) {
      setError(verifyError.message || 'Mã OTP không đúng.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await resetPasswordOnBackend({ email, resetToken, newPassword });
      setSuccessMessage('Đã đặt lại mật khẩu thành công.');
      onSuccess?.();
    } catch (resetError) {
      setError(resetError.message || 'Không đặt lại được mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrimaryAction() {
    if (step === STEPS.EMAIL) {
      handleRequestOtp();
      return;
    }
    if (step === STEPS.OTP) {
      handleVerifyOtp();
      return;
    }
    handleResetPassword();
  }

  const primaryLabel =
    step === STEPS.EMAIL
      ? isLoading
        ? 'Đang gừi OTP...'
        : 'Gừi mã OTP'
      : step === STEPS.OTP
        ? isLoading
          ? 'Đang xác thực...'
          : 'Xác thực OTP'
        : isLoading
          ? 'Đang cập nhật...'
          : 'Đặt mật khẩu mới';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <CircularBackButton
            onPress={onBack}
            variant="surface"
            size={40}
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>Quên mật khẩu</Text>
        </View>

        <Text style={styles.subtitle}>
          {step === STEPS.EMAIL
            ? 'Nhập email để nhận mã OTP đặt lại mật khẩu.'
            : step === STEPS.OTP
              ? 'Nhập mã OTP đã gừi đến email của bạn.'
              : 'Tạo mật khẩu mới cho tài khoản FastMark.'}
        </Text>

        <View style={styles.stepsRow}>
          {[STEPS.EMAIL, STEPS.OTP, STEPS.PASSWORD].map((value) => (
            <View key={value} style={[styles.stepDot, step >= value && styles.stepDotActive]} />
          ))}
        </View>

        <View style={styles.card}>
          {step === STEPS.EMAIL ? (
            <AuthInput
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@example.com"
            />
          ) : null}

          {step === STEPS.OTP ? (
            <>
              <AuthInput
                label="Mã OTP"
                value={otp}
                onChangeText={(value) => {
                  setOtp(value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                keyboardType="number-pad"
                placeholder="6 số"
              />
              <Pressable
                disabled={isLoading || resendCooldown > 0}
                onPress={handleRequestOtp}
                style={styles.resendLink}
              >
                <Text style={styles.resendText}>
                  {resendCooldown > 0
                    ? `Gừi lại sau ${resendCooldown}s`
                    : 'Gừi lại mã OTP'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {step === STEPS.PASSWORD ? (
            <>
              <AuthInput
                label="Mật khẩu mới"
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setError('');
                }}
                secureTextEntry
                placeholder="Ít nhất 6 ký tự"
              />
              <AuthInput
                label="Xác nhận mật khẩu"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setError('');
                }}
                secureTextEntry
                placeholder="Nhập lại mật khẩu"
              />
            </>
          ) : null}

          {error ? (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={[styles.alertBox, styles.alertSuccess]}>
              <Text style={[styles.alertText, styles.alertTextSuccess]}>{successMessage}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={isLoading}
            onPress={handlePrimaryAction}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isLoading) && styles.primaryButtonPressed,
              isLoading && styles.primaryButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            )}
          </Pressable>
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
    marginBottom: 16,
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
  subtitle: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  stepDot: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  stepDotActive: {
    backgroundColor: AUTH_COLORS.primary,
  },
  card: {
    paddingVertical: 8,
  },
  resendLink: {
    marginBottom: 12,
    alignSelf: 'flex-end',
  },
  resendText: {
    color: AUTH_COLORS.primary,
    fontWeight: '800',
    fontSize: 13,
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
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
