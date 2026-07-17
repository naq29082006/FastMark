import { useEffect, useRef, useState } from 'react';
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
  selectAuthError,
  selectAuthProfile,
  selectAuthSuccessMessage,
  selectAuthUser,
  selectEmailVerification,
} from '../../viewmodel/auth/authSelectors';
import {
  clearAuthFeedback,
  confirmEmailVerificationCode,
  logoutUser,
  requestEmailVerificationCode,
} from '../../viewmodel/auth/authSlice';
import { validateEmailVerificationForm } from '../../viewmodel/auth/authFormValidation';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';

const CODE_TTL_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 2 * 60;

function formatCountdown(secondsLeft) {
  const safeSeconds = Math.max(0, Number(secondsLeft) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function normalizeCodeInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function isSixDigitCode(value) {
  return /^\d{6}$/.test(normalizeCodeInput(value));
}

export default function EmailVerificationScreen() {
  const dispatch = useDispatch();
  const user = useSelector(selectAuthUser);
  const profile = useSelector(selectAuthProfile);
  const actionStatus = useSelector(selectAuthActionStatus);
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);
  const emailVerification = useSelector(selectEmailVerification);

  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [codeSecondsLeft, setCodeSecondsLeft] = useState(CODE_TTL_SECONDS);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [codeExpiresAtMs, setCodeExpiresAtMs] = useState(0);
  const [resendAvailableAtMs, setResendAvailableAtMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const requestedInitialCodeRef = useRef(false);

  const isLoading = actionStatus === 'loading';
  const displayError = localError || error;
  const email = emailVerification?.email || profile?.email || user?.email || '';
  const normalizedCode = normalizeCodeInput(code);
  const isCodeComplete = isSixDigitCode(normalizedCode);
  const canSubmit = isCodeComplete && !isSubmitting && codeSecondsLeft > 0;
  const canResend = !isResending && resendSecondsLeft <= 0;
  const showResendCooldown = resendSecondsLeft > 0;

  useEffect(() => {
    dispatch(clearAuthFeedback());

    if (emailVerification || requestedInitialCodeRef.current) {
      return;
    }

    requestedInitialCodeRef.current = true;
    setIsResending(true);
    dispatch(requestEmailVerificationCode({ isResend: false }))
      .unwrap()
      .then(() => {
        const now = Date.now();
        setCodeExpiresAtMs(now + CODE_TTL_SECONDS * 1000);
        setResendAvailableAtMs(now + RESEND_COOLDOWN_SECONDS * 1000);
      })
      .catch(() => {})
      .finally(() => {
        setIsResending(false);
      });
  }, [dispatch, emailVerification]);

  useEffect(() => {
    if (!emailVerification) {
      return;
    }

    const now = Date.now();
    const ttl = Number(emailVerification.expiresInSeconds) || CODE_TTL_SECONDS;
    setCodeExpiresAtMs(now + ttl * 1000);

    if (emailVerification.resendAvailableAt) {
      const resendMs = new Date(emailVerification.resendAvailableAt).getTime();
      if (Number.isFinite(resendMs) && resendMs > now) {
        setResendAvailableAtMs(resendMs);
      } else if (emailVerification.isResend) {
        setResendAvailableAtMs(now + RESEND_COOLDOWN_SECONDS * 1000);
      }
    }
  }, [emailVerification]);

  useEffect(() => {
    if (!codeExpiresAtMs) {
      return undefined;
    }

    function tickCodeTimer() {
      setCodeSecondsLeft(Math.max(0, Math.floor((codeExpiresAtMs - Date.now()) / 1000)));
    }

    tickCodeTimer();
    const timerId = setInterval(tickCodeTimer, 1000);
    return () => clearInterval(timerId);
  }, [codeExpiresAtMs]);

  useEffect(() => {
    if (!resendAvailableAtMs) {
      setResendSecondsLeft(0);
      return undefined;
    }

    function tickResendTimer() {
      setResendSecondsLeft(Math.max(0, Math.floor((resendAvailableAtMs - Date.now()) / 1000)));
    }

    tickResendTimer();
    const timerId = setInterval(tickResendTimer, 1000);
    return () => clearInterval(timerId);
  }, [resendAvailableAtMs]);

  async function handleSubmit() {
    const validationError = validateEmailVerificationForm({ code: normalizedCode });
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (codeSecondsLeft <= 0) {
      setLocalError('Mã đã hết hạn. Vui lòng gửi lại mã mới.');
      return;
    }

    setLocalError('');
    setIsSubmitting(true);

    try {
      await dispatch(confirmEmailVerificationCode({ code: normalizedCode })).unwrap();
    } catch (submitError) {
      setLocalError(
        typeof submitError === 'string'
          ? submitError
          : submitError?.message || 'Không xác minh được email.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!canResend) {
      return;
    }

    setLocalError('');
    setCode('');
    setIsResending(true);

    try {
      await dispatch(requestEmailVerificationCode({ isResend: true })).unwrap();
      const now = Date.now();
      setCodeExpiresAtMs(now + CODE_TTL_SECONDS * 1000);
      setResendAvailableAtMs(now + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (resendError) {
      setLocalError(
        typeof resendError === 'string'
          ? resendError
          : resendError?.message || 'Không gửi lại được mã xác minh.'
      );
    } finally {
      setIsResending(false);
    }
  }

  function handleLogout() {
    dispatch(logoutUser());
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
        <Text style={styles.title}>Xác minh email</Text>

        <Text style={styles.emailLabel}>Email cần xác minh</Text>
        <Text style={styles.emailValue}>{email || '—'}</Text>

        <Text style={styles.hintText}>
          {isResending && !emailVerification
            ? 'Đang gửi mã xác minh...'
            : codeSecondsLeft > 0
              ? `Mã đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư. Mã sẽ hết hạn sau ${formatCountdown(codeSecondsLeft)}.`
              : 'Mã đã hết hạn. Vui lòng gửi lại mã xác minh để nhận mã mới.'}
        </Text>

        <View style={styles.form}>
          <AuthInput
            label="Mã xác minh"
            value={code}
            onChangeText={(value) => {
              setCode(normalizeCodeInput(value));
              setLocalError('');
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            error={displayError || ''}
          />

          {successMessage ? (
            <View style={[styles.alertBox, styles.alertSuccess]}>
              <Text style={[styles.alertText, styles.alertTextSuccess]}>{successMessage}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              canSubmit && pressed && styles.primaryButtonPressed,
              !canSubmit && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Đang xác minh...' : 'Xác minh'}
            </Text>
          </Pressable>

          <Pressable
            disabled={!canResend}
            onPress={handleResend}
            style={styles.resendButton}
          >
            <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
              {isResending
                ? 'Đang gửi lại mã...'
                : showResendCooldown
                  ? `Gửi lại mã xác minh (${formatCountdown(resendSecondsLeft)})`
                  : 'Gửi lại mã xác minh'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          disabled={isSubmitting || isResending || isLoading}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
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
    paddingTop: 24,
    paddingBottom: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: AUTH_COLORS.text,
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH_COLORS.textMuted,
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AUTH_COLORS.text,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 22,
    color: AUTH_COLORS.textMuted,
    fontWeight: '500',
    marginBottom: 24,
  },
  form: {
    flex: 1,
  },
  alertBox: {
    backgroundColor: AUTH_COLORS.errorBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  alertSuccess: {
    backgroundColor: AUTH_COLORS.successBg,
  },
  alertText: {
    color: AUTH_COLORS.errorText,
    fontSize: 14,
    fontWeight: '600',
  },
  alertTextSuccess: {
    color: AUTH_COLORS.successText,
  },
  primaryButton: {
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: AUTH_RADIUS.button,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonPressed: {
    backgroundColor: AUTH_COLORS.primaryDark,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  resendText: {
    color: AUTH_COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  resendTextDisabled: {
    color: AUTH_COLORS.textMuted,
  },
  logoutButton: {
    marginTop: 24,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: AUTH_RADIUS.button,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.border,
    backgroundColor: '#ffffff',
  },
  logoutButtonPressed: {
    opacity: 0.85,
  },
  logoutText: {
    color: AUTH_COLORS.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
});
