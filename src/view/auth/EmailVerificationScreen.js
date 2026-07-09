import { useEffect, useMemo, useState } from 'react';
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
import AuthBrand from './components/AuthBrand';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';

function formatCountdown(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
  const [secondsLeft, setSecondsLeft] = useState(0);

  const isLoading = actionStatus === 'loading';
  const displayError = localError || error;
  const email = profile?.email || user?.email || '';

  const expiresAtMs = useMemo(() => {
    if (!emailVerification?.expiresAt) {
      return 0;
    }

    return new Date(emailVerification.expiresAt).getTime();
  }, [emailVerification?.expiresAt]);

  useEffect(() => {
    dispatch(clearAuthFeedback());
    dispatch(requestEmailVerificationCode());
  }, [dispatch]);

  useEffect(() => {
    if (!expiresAtMs) {
      setSecondsLeft(0);
      return undefined;
    }

    function tick() {
      const next = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(next);
    }

    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [expiresAtMs]);

  function handleSubmit() {
    const validationError = validateEmailVerificationForm({ code });
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError('');
    dispatch(confirmEmailVerificationCode({ code: code.trim() }));
  }

  function handleResend() {
    setLocalError('');
    setCode('');
    dispatch(requestEmailVerificationCode());
  }

  function handleLogout() {
    dispatch(logoutUser());
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
        <AuthBrand
          title="Xác minh email"
          subtitle="Nhập mã 6 số để kích hoạt tài khoản. Mã có hiệu lực trong 5 phút."
        />

        <View style={styles.card}>
          <View style={styles.emailBox}>
            <Text style={styles.emailLabel}>Email cần xác minh</Text>
            <Text style={styles.emailValue}>{email}</Text>
          </View>

          {emailVerification?.devCode ? (
            <View style={styles.devBox}>
              <Text style={styles.devTitle}>Mã demo (chưa gửi email)</Text>
              <Text style={styles.devCode}>{emailVerification.devCode}</Text>
            </View>
          ) : null}

          <AuthInput
            label="Mã xác minh"
            icon="🔢"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              setLocalError('');
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="123456"
          />

          <Text style={styles.timerText}>
            {secondsLeft > 0
              ? `Mã còn hiệu lực: ${formatCountdown(secondsLeft)}`
              : 'Mã đã hết hạn. Nhấn gửi lại mã để nhận mã mới.'}
          </Text>

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
            disabled={isLoading || secondsLeft <= 0}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isLoading) && styles.primaryButtonPressed,
              (isLoading || secondsLeft <= 0) && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Đang xác minh...' : 'Xác minh email'}
            </Text>
          </Pressable>

          <Pressable disabled={isLoading} onPress={handleResend} style={styles.resendButton}>
            <Text style={styles.resendText}>
              {isLoading ? 'Đang gửi lại...' : 'Gửi lại mã xác minh'}
            </Text>
          </Pressable>

          <Pressable
            disabled={isLoading}
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>
              {isLoading ? 'Đang xử lý...' : 'Đăng xuất'}
            </Text>
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
    paddingTop: 52,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: AUTH_COLORS.card,
    borderRadius: AUTH_RADIUS.card,
    padding: 20,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  emailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  emailLabel: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
  emailValue: {
    fontSize: 15,
    color: AUTH_COLORS.text,
    fontWeight: '700',
  },
  devBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  devTitle: {
    fontSize: 13,
    color: '#92400e',
    marginBottom: 6,
    fontWeight: '700',
  },
  devCode: {
    fontSize: 28,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 4,
    textAlign: 'center',
  },
  timerText: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginBottom: 16,
    fontWeight: '600',
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
    marginTop: 4,
  },
  primaryButtonPressed: {
    backgroundColor: AUTH_COLORS.primaryDark,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  resendButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    color: AUTH_COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    backgroundColor: '#ffffff',
  },
  logoutText: {
    color: AUTH_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
