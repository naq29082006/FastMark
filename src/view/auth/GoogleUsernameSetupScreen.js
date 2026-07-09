import { useState } from 'react';
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
  selectAuthError,
  selectPendingGoogle,
} from '../../viewmodel/auth/authSelectors';
import {
  clearAuthFeedback,
  clearPendingGoogle,
  completeGoogleProfile,
} from '../../viewmodel/auth/authSlice';
import { validateGoogleProfileForm } from '../../viewmodel/auth/authFormValidation';
import AuthBrand from './components/AuthBrand';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';

export default function GoogleUsernameSetupScreen() {
  const dispatch = useDispatch();
  const pendingGoogle = useSelector(selectPendingGoogle);
  const actionStatus = useSelector(selectAuthActionStatus);
  const error = useSelector(selectAuthError);

  const [fullName, setFullName] = useState(pendingGoogle?.fullName || '');
  const [userName, setUserName] = useState('');
  const [localError, setLocalError] = useState('');

  const isLoading = actionStatus === 'loading';
  const displayError = localError || error;

  function handleSubmit() {
    const validationError = validateGoogleProfileForm({ fullName, userName });
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError('');
    dispatch(
      completeGoogleProfile({
        fullName: fullName.trim(),
        userName: userName.trim(),
      })
    );
  }

  function handleCancel() {
    dispatch(clearAuthFeedback());
    dispatch(clearPendingGoogle());
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
        <Pressable onPress={handleCancel} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <AuthBrand
          title="Hoàn tất tài khoản"
          subtitle="Đây là lần đăng nhập Google đầu tiên. Hãy chọn tên đăng nhập để tiếp tục."
        />

        <View style={styles.card}>
          <View style={styles.googleUserRow}>
            {pendingGoogle?.picture ? (
              <Image source={{ uri: pendingGoogle.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>G</Text>
              </View>
            )}
            <View style={styles.googleUserMeta}>
              <Text style={styles.googleEmail}>{pendingGoogle?.email || 'Google Account'}</Text>
              <Text style={styles.googleHint}>Đăng nhập bằng Google</Text>
            </View>
          </View>

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

          {displayError ? (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{displayError}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={isLoading}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isLoading) && styles.primaryButtonPressed,
              isLoading && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Đang lưu...' : 'Tiếp tục'}
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
    padding: 20,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  googleUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  googleUserMeta: {
    flex: 1,
  },
  googleEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: AUTH_COLORS.text,
  },
  googleHint: {
    marginTop: 2,
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    fontWeight: '600',
  },
  alertBox: {
    backgroundColor: AUTH_COLORS.errorBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  alertText: {
    color: AUTH_COLORS.errorText,
    fontSize: 14,
    fontWeight: '600',
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
});
