import { useState } from 'react';
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
  selectPendingGoogle,
} from '../../viewmodel/auth/authSelectors';
import {
  clearAuthFeedback,
  clearPendingGoogle,
  completeGoogleProfile,
} from '../../viewmodel/auth/authSlice';
import { validateGoogleProfileForm } from '../../viewmodel/auth/authFormValidation';
import AuthBrand from './components/AuthBrand';
import CircularBackButton from '../shared/components/CircularBackButton';
import AvatarBadge from '../shared/components/AvatarBadge';
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CircularBackButton
          onPress={handleCancel}
          variant="surface"
          size={40}
          style={styles.backButton}
        />

        <AuthBrand
          title="Hoàn t?t tài kho?n"
          subtitle="Ðây là l?n dang nh?p Google d?u tiên. Hãy ch?n tên dang nh?p d? ti?p t?c."
        />

        <View style={styles.card}>
          <View style={styles.googleUserRow}>
            <AvatarBadge
              name={fullName || pendingGoogle?.fullName || pendingGoogle?.email || 'G'}
              uri=""
              size={48}
            />
            <View style={styles.googleUserMeta}>
              <Text style={styles.googleEmail}>{pendingGoogle?.email || 'Google Account'}</Text>
              <Text style={styles.googleHint}>Ðang nh?p b?ng Google</Text>
            </View>
          </View>

          <AuthInput
            label="H? và tên"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setLocalError('');
            }}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Nguy?n Van A"
          />

          <AuthInput
            label="Tên dang nh?p"
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
              {isLoading ? 'Ðang luu...' : 'Ti?p t?c'}
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
    paddingTop: 12,
    paddingBottom: 36,
  },
  backButton: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    backgroundColor: '#ffffff',
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
    gap: 12,
    marginBottom: 18,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
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
