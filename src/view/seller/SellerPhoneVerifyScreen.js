import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDispatch } from 'react-redux';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  confirmSellerPhoneCodeOnBackend,
  getMySellerVerificationOnBackend,
  requestSellerPhoneCodeOnBackend,
} from '../../api/sellerApi';
import { loadUserProfile } from '../../viewmodel/auth/authSlice';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function formatCountdown(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function SellerPhoneVerifyScreen({ phone, onBack, onVerified, onNeedPhone }) {
  const dispatch = useDispatch();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(true);
  const [verification, setVerification] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const expiresAtMs = useMemo(() => {
    if (!verification?.expiresAt) {
      return 0;
    }

    return new Date(verification.expiresAt).getTime();
  }, [verification?.expiresAt]);

  const [isBootstrapping, setIsBootstrapping] = useState(true);

  async function loadVerificationCode() {
    setIsRequesting(true);
    setError('');

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const data = await requestSellerPhoneCodeOnBackend(idToken);

      if (data?.alreadyVerified) {
        await dispatch(loadUserProfile()).unwrap();
        onVerified();
        return;
      }

      setVerification(data);
      if (data?.devCode) {
        setCode(String(data.devCode));
      }
    } catch (requestError) {
      const message = requestError.message || 'Không tạo được mã xác minh.';
      setError(message);
    } finally {
      setIsRequesting(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setIsBootstrapping(true);
      setError('');

      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          throw new Error('Phiên đăng nhập đã hết hạn.');
        }

        const status = await getMySellerVerificationOnBackend(idToken);
        if (!isMounted) {
          return;
        }

        if (status?.sellerPhoneVerified) {
          await dispatch(loadUserProfile()).unwrap();
          onVerified();
          return;
        }

        await loadVerificationCode();
      } catch (bootstrapError) {
        if (isMounted) {
          setError(bootstrapError.message || 'Không kiểm tra được trạng thái xác minh.');
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

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

  async function handleConfirm() {
    const normalizedCode = code.trim();

    if (!normalizedCode) {
      setError('Vui lòng nhập mã xác minh.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      await confirmSellerPhoneCodeOnBackend({ idToken, code: normalizedCode });
      await dispatch(loadUserProfile()).unwrap();
      onVerified();
    } catch (confirmError) {
      setError(confirmError.message || 'Mã xác minh không đúng.');
    } finally {
      setIsLoading(false);
    }
  }

  const isCodeExpired = Boolean(verification) && secondsLeft <= 0;

  if (isBootstrapping) {
    return (
      <ProfileSubScreen title="Xác minh số điện thoại" onBack={onBack}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#0d7377" size="large" />
          <Text style={styles.loadingText}>Đang kiểm tra trạng thái xác minh...</Text>
        </View>
      </ProfileSubScreen>
    );
  }

  return (
    <ProfileSubScreen title="Xác minh số điện thoại" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.title}>Nhập mã xác minh</Text>
        <Text style={styles.subtitle}>
          Mã demo sẽ được hiển thị tạm thời để bạn test luồng đăng ký người bán.
        </Text>

        <View style={styles.phoneBox}>
          <Text style={styles.phoneLabel}>Số điện thoại</Text>
          <Text style={styles.phoneValue}>{phone || verification?.phone || '—'}</Text>
        </View>

        {verification?.devCode ? (
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>Mã demo</Text>
            <Text style={styles.devCode}>{verification.devCode}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Mã xác minh</Text>
        <TextInput
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          keyboardType="number-pad"
          placeholder="123456"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <Text style={styles.timerText}>
          {secondsLeft > 0
            ? `Mã còn hiệu lực: ${formatCountdown(secondsLeft)}`
            : 'Mã đã hết hạn. Nhấn gửi lại mã để nhận mã mới.'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/số điện thoại/i.test(error) ? (
          <Pressable onPress={onNeedPhone} style={styles.resendButton}>
            <Text style={styles.resendText}>Quay lại nhập số điện thoại</Text>
          </Pressable>
        ) : null}

        <Pressable
          disabled={isLoading || isRequesting || isCodeExpired}
          onPress={handleConfirm}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (isLoading || isRequesting || isCodeExpired) && styles.buttonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Xác minh và tiếp tục</Text>
          )}
        </Pressable>

        <Pressable
          disabled={isLoading || isRequesting}
          onPress={loadVerificationCode}
          style={styles.resendButton}
        >
          <Text style={styles.resendText}>
            {isRequesting ? 'Đang gửi lại mã...' : 'Gửi lại mã xác minh'}
          </Text>
        </Pressable>
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
    marginBottom: 16,
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
  devBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
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
    marginBottom: 10,
  },
  timerText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '600',
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
    backgroundColor: '#0d7377',
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
    color: '#0d7377',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});
