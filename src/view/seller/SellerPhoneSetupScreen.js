import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  confirmSellerPhoneCodeOnBackend,
  requestSellerPhoneCodeOnBackend,
} from '../../api/sellerApi';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import { loadUserProfile } from '../../viewmodel/auth/authSlice';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function formatCountdown(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function SellerPhoneSetupScreen({
  onBack,
  onVerified,
  onContinue,
  mode = 'register',
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const [phone, setPhone] = useState(mode === 'change' ? '' : profile?.phone || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verification, setVerification] = useState(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);

  const isChangeMode = mode === 'change';
  const isTransactionMode = mode === 'transaction';

  const resendAvailableAtMs = useMemo(() => {
    if (!verification?.resendAvailableAt) {
      return 0;
    }
    return new Date(verification.resendAvailableAt).getTime();
  }, [verification?.resendAvailableAt]);

  useEffect(() => {
    if (!resendAvailableAtMs) {
      setResendSecondsLeft(0);
      return undefined;
    }

    function tick() {
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAvailableAtMs - Date.now()) / 1000)));
    }

    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [resendAvailableAtMs]);

  async function handleSendCode({ isResend = false } = {}) {
    if (lockedOut) {
      return;
    }

    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError('Số điện thoại phải gồm đúng 10 chữ số.');
      return;
    }

    if (isResend && resendSecondsLeft > 0) {
      return;
    }

    setError('');
    setIsSending(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const data = await requestSellerPhoneCodeOnBackend(idToken, normalizedPhone);

      if (data?.alreadyVerified) {
        await dispatch(loadUserProfile()).unwrap();
        (onVerified || onContinue)?.(normalizedPhone);
        return;
      }

      setPhone(normalizedPhone);
      setVerification(data);
      setCode('');
      setStep('otp');
      setLockedOut(false);
    } catch (sendError) {
      const payload = sendError?.payload || {};
      const cooldown =
        Number(payload?.data?.resendCooldownSeconds) ||
        Number(payload?.data?.resendAvailableAt
          ? Math.ceil((new Date(payload.data.resendAvailableAt).getTime() - Date.now()) / 1000)
          : 0);

      if (cooldown > 0 && payload?.data?.resendAvailableAt) {
        setVerification((current) => ({
          ...(current || {}),
          resendAvailableAt: payload.data.resendAvailableAt,
          resendCooldownSeconds: cooldown,
        }));
      }

      setError(sendError.message || 'Không gửi được mã xác minh.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleConfirm() {
    if (lockedOut) {
      return;
    }

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError('Vui lòng nhập mã xác minh.');
      return;
    }

    setError('');
    setIsConfirming(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      await confirmSellerPhoneCodeOnBackend({
        idToken,
        code: normalizedCode,
        phone: phone.trim(),
      });
      await dispatch(loadUserProfile()).unwrap();
      (onVerified || onContinue)?.(phone.trim());
    } catch (confirmError) {
      const locked = Boolean(confirmError?.payload?.data?.lockedOut);
      if (locked) {
        setLockedOut(true);
        setVerification(null);
        setCode('');
        setError(confirmError.message || 'Bạn đã nhập sai quá 5 lần.');
        return;
      }
      setError(confirmError.message || 'Mã xác minh không đúng.');
    } finally {
      setIsConfirming(false);
    }
  }

  function handleLockedOutBack() {
    setLockedOut(false);
    setStep('phone');
    setCode('');
    setVerification(null);
    setError('');
    onBack?.();
  }

  return (
    <ProfileSubScreen
      title={
        isChangeMode
          ? 'Đổi số điện thoại'
          : isTransactionMode
            ? 'Thêm số điện thoại'
            : 'Thêm số điện thoại'
      }
      onBack={lockedOut ? handleLockedOutBack : onBack}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          {step === 'otp'
            ? 'Nhập mã xác minh'
            : isChangeMode
              ? 'Cập nhật số điện thoại liên hệ'
              : 'Xác minh số điện thoại'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'otp'
            ? 'Nhập đúng mã demo bên dưới để lưu số điện thoại. Sai quá 5 lần sẽ bị khóa phiên này.'
            : 'Số chỉ được lưu vào hệ thống sau khi xác minh OTP thành công.'}
        </Text>

        {isChangeMode && profile?.phone && step === 'phone' ? (
          <Text style={styles.currentPhoneHint}>Số hiện tại: {profile.phone}</Text>
        ) : null}

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          value={phone}
          editable={step === 'phone' && !lockedOut}
          onChangeText={(value) => {
            setPhone(value.replace(/\D/g, '').slice(0, 10));
            setError('');
          }}
          keyboardType="phone-pad"
          placeholder="Nhập 10 chữ số"
          placeholderTextColor="#94a3b8"
          style={[styles.input, step === 'otp' && styles.inputReadonly]}
        />

        {step === 'otp' ? (
          <>
            <View style={styles.phoneBox}>
              <Text style={styles.phoneLabel}>Đang xác minh số</Text>
              <Text style={styles.phoneValue}>{phone}</Text>
            </View>

            {verification?.verificationCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeBoxLabel}>Mã xác minh demo</Text>
                <Text style={styles.codeBoxValue}>{verification.verificationCode}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Mã xác minh</Text>
            <TextInput
              value={code}
              editable={!lockedOut}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              keyboardType="number-pad"
              placeholder="Nhập 6 số"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {lockedOut ? (
          <Pressable
            onPress={handleLockedOutBack}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Thoát</Text>
          </Pressable>
        ) : step === 'phone' ? (
          <Pressable
            disabled={isSending}
            onPress={() => handleSendCode({ isResend: false })}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isSending && styles.buttonDisabled,
            ]}
          >
            {isSending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Gửi mã xác minh</Text>
            )}
          </Pressable>
        ) : (
          <>
            <Pressable
              disabled={isConfirming || isSending}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (isConfirming || isSending) && styles.buttonDisabled,
              ]}
            >
              {isConfirming ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Xác minh và lưu số</Text>
              )}
            </Pressable>

            <Pressable
              disabled={isSending || isConfirming || resendSecondsLeft > 0}
              onPress={() => handleSendCode({ isResend: true })}
              style={styles.resendButton}
            >
              <Text
                style={[
                  styles.resendText,
                  resendSecondsLeft > 0 && styles.resendTextDisabled,
                ]}
              >
                {isSending
                  ? 'Đang gửi lại mã...'
                  : resendSecondsLeft > 0
                    ? `Gửi lại mã xác minh (${formatCountdown(resendSecondsLeft)})`
                    : 'Gửi lại mã xác minh'}
              </Text>
            </Pressable>

            <Pressable
              disabled={isSending || isConfirming}
              onPress={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
              style={styles.resendButton}
            >
              <Text style={styles.resendText}>Đổi số điện thoại khác</Text>
            </Pressable>
          </>
        )}
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 21,
    marginBottom: 18,
  },
  currentPhoneHint: {
    fontSize: 13,
    color: '#076F32',
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
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
    marginBottom: 12,
  },
  inputReadonly: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
  },
  phoneBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  phoneLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  phoneValue: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '800',
  },
  codeBox: {
    backgroundColor: '#E6F4EC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A7D9B8',
    alignItems: 'center',
  },
  codeBoxLabel: {
    fontSize: 13,
    color: '#076F32',
    marginBottom: 6,
    fontWeight: '700',
  },
  codeBoxValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#076F32',
    letterSpacing: 6,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  resendButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '700',
  },
  resendTextDisabled: {
    color: '#94a3b8',
  },
});
