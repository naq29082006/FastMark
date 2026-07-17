import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import {
  changeCurrentUserPassword,
  getCurrentFirebaseUser,
  getCurrentUserIdToken,
  logoutCurrentUser,
  serializeAuthUser,
  signInWithCustomTokenFromBackend,
  updateCurrentUserProfile,
} from '../../repository/authRepository';
import {
  confirmEmailVerification,
  fetchBackendUser,
  loginAccount,
  registerAccount,
  requestEmailVerification,
  syncGoogleAccount,
} from '../../repository/authBackendRepository';
import { hasApiBaseUrl } from '../../api/client';
import {
  updateProfileOnBackend,
  uploadAvatarOnBackend,
} from '../../api/authBackendApi';
import {
  mapBackendUserToProfile,
  mapSellerVerificationToProfilePatch,
  mapShopSettingsToProfilePatch,
  mergeProfile,
  normalizeRole,
} from '../../model/profileModel';
import { getMySellerVerificationOnBackend } from '../../api/sellerApi';
import { getFirebaseInitConfigError } from '../../core/config/firebaseApp';
import {
  makeProfileFromAuthUser,
  readCachedProfile,
  readUserProfile,
  upsertUserProfile,
  writeCachedProfile,
} from '../../repository/profileRepository';
import { toReadableAuthError, toAuthErrorPayload } from './authErrors';
import { clearGoogleSignInSession } from './clearGoogleSignInSession';
import { authLogger as log } from '../../core/utils/logger';

const initialState = {
  status: 'checking',
  actionStatus: 'idle',
  user: null,
  profile: null,
  profileStatus: 'idle',
  error: null,
  successMessage: null,
  configError: null,
  pendingGoogle: null,
  emailVerification: null,
  sellerVerification: null,
  sellerAccessStatus: 'idle',
  sellerAccessSyncedAt: null,
};

const EMAIL_CODE_TTL_SECONDS = 5 * 60;
const EMAIL_RESEND_COOLDOWN_SECONDS = 3 * 60;

const SELLER_ACCESS_PROFILE_KEYS = [
  'role',
  'phone',
  'sellerPhoneVerified',
  'shopName',
  'shopUsername',
  'shopDescription',
  'shopAddress',
  'shopSystemAddress',
  'categoryId',
  'categoryName',
  'openTime',
  'closeTime',
  'isOpen',
  'totalProducts',
  'soldCount',
  'likesCount',
  'totalReviews',
  'averageRating',
  'verifyAccount',
];

function pickSellerAccessProfileSnapshot(profile) {
  if (!profile) {
    return null;
  }

  return SELLER_ACCESS_PROFILE_KEYS.reduce((snapshot, key) => {
    snapshot[key] = profile[key] ?? null;
    return snapshot;
  }, {});
}

function areSellerAccessProfilesEqual(previousProfile, nextProfile) {
  return (
    JSON.stringify(pickSellerAccessProfileSnapshot(previousProfile)) ===
    JSON.stringify(pickSellerAccessProfileSnapshot(nextProfile))
  );
}

/** Align Firebase Auth photoURL with backend avatar (never keep Google provider photo). */
async function syncAuthPhotoWithBackendAvatar(authUser, backendPhotoUrl) {
  const photoUrl = String(backendPhotoUrl || '').trim();

  try {
    const synced = await updateCurrentUserProfile({ photoUrl: photoUrl || null });
    return synced || { ...authUser, photoURL: photoUrl };
  } catch (error) {
    log.fail('syncAuthPhotoWithBackendAvatar', error);
    return { ...authUser, photoURL: photoUrl };
  }
}

function areSellerVerificationsEqual(previousVerification, nextVerification) {
  if (!previousVerification && !nextVerification) {
    return true;
  }

  if (!previousVerification || !nextVerification) {
    return false;
  }

  return (
    previousVerification.id === nextVerification.id &&
    previousVerification.status === nextVerification.status &&
    previousVerification.lyDoTuChoi === nextVerification.lyDoTuChoi
  );
}

function normalizeEmailVerification(payload, fallbackEmail = '', { isResend = false } = {}) {
  if (!payload) {
    return null;
  }

  const now = Date.now();
  const expiresInSeconds = Number(payload.expiresInSeconds) || EMAIL_CODE_TTL_SECONDS;

  let codeExpiresAtMs = payload.codeExpiresAt
    ? new Date(payload.codeExpiresAt).getTime()
    : payload.expiresAt
      ? new Date(payload.expiresAt).getTime()
      : 0;

  if (!Number.isFinite(codeExpiresAtMs) || codeExpiresAtMs <= now) {
    codeExpiresAtMs = now + expiresInSeconds * 1000;
  }

  let resendAvailableAt = null;
  if (isResend) {
    const resendMs = payload.resendAvailableAt
      ? new Date(payload.resendAvailableAt).getTime()
      : now + EMAIL_RESEND_COOLDOWN_SECONDS * 1000;
    if (Number.isFinite(resendMs) && resendMs > now) {
      resendAvailableAt = new Date(resendMs).toISOString();
    }
  }

  return {
    email: payload.email || fallbackEmail,
    expiresAt: new Date(codeExpiresAtMs).toISOString(),
    codeExpiresAt: new Date(codeExpiresAtMs).toISOString(),
    expiresInSeconds,
    resendAvailableAt,
    resendCooldownSeconds: resendAvailableAt
      ? Math.max(0, Math.floor((new Date(resendAvailableAt).getTime() - now) / 1000))
      : 0,
    isResend,
  };
}

function rejectWithReadableError(error, rejectWithValue) {
  return rejectWithValue(toAuthErrorPayload(error));
}

export const loadUserProfile = createAsyncThunk(
  'auth/loadProfile',
  async (_, { getState }) => {
    const { user } = getState().auth;
    if (!user) {
      return { profile: null };
    }

    log.info('loadUserProfile:start', { uid: user.uid });

    if (hasApiBaseUrl()) {
      try {
        const idToken = await getCurrentUserIdToken();
        if (idToken) {
          const backendData = await fetchBackendUser(idToken);
          const profile = mapBackendUserToProfile(backendData.user, user);
          await writeCachedProfile(profile);

          // Đồng bộ Firebase photo với avatar backend (bỏ ảnh Google còn sót).
          if (profile?.photoUrl && profile.photoUrl !== user.photoURL) {
            try {
              await syncAuthPhotoWithBackendAvatar(user, profile.photoUrl);
            } catch (error) {
              log.fail('loadUserProfile:sync-photo', error);
            }
          }

          log.ok('loadUserProfile:backend', { uid: user.uid });
          return { profile };
        }
      } catch (error) {
        log.fail('loadUserProfile:backend-failed', error);
      }
    }

    const cached = await readCachedProfile(user.uid);
    if (cached) {
      log.ok('loadUserProfile:cache-hit', { uid: user.uid });
      return { profile: makeProfileFromAuthUser(user, cached) };
    }

    try {
      const profile = await readUserProfile(user);
      await writeCachedProfile(profile);
      log.ok('loadUserProfile:remote', { uid: user.uid });
      return { profile };
    } catch (error) {
      log.fail('loadUserProfile:fallback-default', error);
      return { profile: makeProfileFromAuthUser(user) };
    }
  }
);

export const syncSellerAccess = createAsyncThunk(
  'auth/syncSellerAccess',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { user } = getState().auth;
      if (!user) {
        return {
          profile: null,
          verification: null,
          role: 1,
        };
      }

      if (!hasApiBaseUrl()) {
        return rejectWithValue('Chưa cấu hình backend API.');
      }

      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return rejectWithValue('Phiên đăng nhập đã hết hạn.');
      }

      const [verificationData, backendData] = await Promise.all([
        getMySellerVerificationOnBackend(idToken),
        fetchBackendUser(idToken),
      ]);

      const freshRole = normalizeRole(
        verificationData?.role ?? backendData?.user?.role ?? backendData?.role ?? 1
      );
      const verification = verificationData?.verification || null;
      let profile = mapBackendUserToProfile(backendData.user || backendData, user);
      profile.role = freshRole;

      if (verification) {
        profile = mergeProfile(user, profile, mapSellerVerificationToProfilePatch(verification));
      }

      await writeCachedProfile(profile);

      return {
        profile,
        verification,
        role: freshRole,
      };
    } catch (error) {
      return rejectWithValue(toReadableAuthError(error));
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    log.step('[AUTH] registerUser START', { email: payload.email, userName: payload.userName });

    try {
      const configError = getFirebaseInitConfigError();
      if (configError) {
        throw new Error(configError);
      }

      const registerResponse = await registerAccount({
        email: payload.email.trim(),
        password: payload.password,
        userName: payload.userName.trim(),
        fullName: payload.fullName.trim(),
      });

      const loginData = await loginAccount({
        login: payload.email.trim(),
        password: payload.password,
      });

      const user = await signInWithCustomTokenFromBackend(loginData.tokens.customToken);
      const profile = mapBackendUserToProfile(loginData.user, user);
      await writeCachedProfile(profile);

      const verification = registerResponse?.data?.verification;

      log.step('[AUTH] registerUser SUCCESS', { uid: user.uid });
      return {
        user,
        profile,
        message: 'Đăng ký thành công. Kiểm tra email để lấy mã xác minh.',
        emailVerification: normalizeEmailVerification(verification, payload.email.trim()),
      };
    } catch (error) {
      log.fail('[AUTH] registerUser FAILED', error);
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload, { rejectWithValue }) => {
    const login = payload.login?.trim() || payload.email?.trim();
    log.step('[AUTH] loginUser START', { login });

    try {
      const configError = getFirebaseInitConfigError();
      if (configError) {
        throw new Error(configError);
      }

      const loginData = await loginAccount({
        login,
        password: payload.password,
      });

      const user = await signInWithCustomTokenFromBackend(loginData.tokens.customToken);
      const profile = mapBackendUserToProfile(loginData.user, user);
      await writeCachedProfile(profile);

      log.step('[AUTH] loginUser SUCCESS', { uid: user.uid });
      return { user, profile, message: 'Đăng nhập thành công.' };
    } catch (error) {
      log.fail('[AUTH] loginUser FAILED', error);
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      log.info('logoutUser:start');
      await clearGoogleSignInSession();
      await logoutCurrentUser();
      log.ok('logoutUser:success');
    } catch (error) {
      log.fail('logoutUser', error);
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (payload, { getState, rejectWithValue }) => {
    const state = getState();
    const authUser = state.auth.user;
    const currentProfile = state.auth.profile;

    if (!authUser) {
      return rejectWithValue('Vui lòng đăng nhập lại.');
    }

    const updates = {
      fullName: payload.fullName?.trim() || '',
      userName: payload.userName?.trim() || '',
      photoUrl: payload.photoUrl?.trim() || '',
    };

    try {
      await updateCurrentUserProfile({
        fullName: updates.fullName,
        photoUrl: updates.photoUrl,
      });
    } catch (error) {
      log.fail('updateUserProfile:firebase-auth', error);
    }

    if (hasApiBaseUrl()) {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          return rejectWithValue('Phiên đăng nhập đã hết hạn.');
        }

        const backendData = await updateProfileOnBackend({
          idToken,
          fullName: updates.fullName,
          userName: updates.userName,
        });
        const profile = mapBackendUserToProfile(backendData.user, authUser);
        await writeCachedProfile(profile);
        log.ok('updateUserProfile:backend-sync', { uid: authUser.uid });
        return { profile };
      } catch (error) {
        log.fail('updateUserProfile:backend-sync', error);
        return rejectWithValue(toReadableAuthError(error));
      }
    }

    try {
      const profile = await upsertUserProfile(
        authUser,
        {
          ...currentProfile,
          fullName: updates.fullName,
          userName: updates.userName,
          photoUrl: updates.photoUrl,
        },
        { existingProfile: currentProfile }
      );
      await writeCachedProfile(profile);
      log.ok('updateUserProfile:success', { uid: authUser.uid });
      return { profile };
    } catch (error) {
      log.fail('updateUserProfile:remote-sync', error);
      return rejectWithValue(toReadableAuthError(error));
    }
  }
);

export const uploadUserAvatar = createAsyncThunk(
  'auth/uploadAvatar',
  async ({ imageBase64, mimeType }, { getState, rejectWithValue }) => {
    const authUser = getState().auth.user;

    if (!authUser) {
      return rejectWithValue('Vui lòng đăng nhập lại.');
    }

    if (!imageBase64) {
      return rejectWithValue('Không đọc được dữ liệu ảnh. Vui lòng chọn lại.');
    }

    if (!hasApiBaseUrl()) {
      return rejectWithValue('Chưa cấu hình backend API.');
    }

    try {
      log.info('uploadUserAvatar:start', {
        uid: authUser.uid,
        mimeType: mimeType || 'image/jpeg',
        base64Length: imageBase64.length,
      });

      const idToken = await getCurrentUserIdToken();
      const data = await uploadAvatarOnBackend({ idToken, imageBase64, mimeType });
      const profile = mapBackendUserToProfile(data.user, authUser);

      try {
        await updateCurrentUserProfile({
          photoUrl: profile.photoUrl,
        });
      } catch (error) {
        log.fail('uploadUserAvatar:firebase-auth', error);
      }

      await writeCachedProfile(profile);
      log.ok('uploadUserAvatar:success', { uid: authUser.uid });

      return {
        profile,
        message: 'Cập nhật ảnh đại diện thành công.',
      };
    } catch (error) {
      return rejectWithValue(toReadableAuthError(error));
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (payload, { rejectWithValue }) => {
    try {
      log.info('changePassword:start');
      await changeCurrentUserPassword(payload);
      log.ok('changePassword:success');
      return { message: 'Đã đổi mật khẩu.' };
    } catch (error) {
      log.fail('changePassword', error);
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const socialLogin = createAsyncThunk(
  'auth/socialLogin',
  async ({ token, fullName }, { rejectWithValue }) => {
    try {
      log.info('socialLogin:start');
      const configError = getFirebaseInitConfigError();
      if (configError) throw new Error(configError);

      const data = await syncGoogleAccount({
        idToken: token,
        fullName: fullName?.trim() || '',
      });

      if (data?.needsUsername) {
        log.info('socialLogin:needs-username');
        return {
          needsUsername: true,
          pendingGoogle: {
            idToken: token,
            fullName: data.suggestedFullName || fullName || '',
            email: data.email || '',
            picture: data.picture || '',
          },
        };
      }

      const user = await signInWithCustomTokenFromBackend(data.customToken);
      const profile = mapBackendUserToProfile(data.user, user);
      const syncedUser = await syncAuthPhotoWithBackendAvatar(user, profile.photoUrl);
      await writeCachedProfile(profile);

      log.ok('socialLogin:success', { uid: syncedUser.uid });
      return {
        needsUsername: false,
        user: syncedUser,
        profile,
        message: data.isNew ? 'Đăng ký Google thành công.' : 'Đăng nhập thành công.',
      };
    } catch (error) {
      log.fail('socialLogin', error);
      return rejectWithReadableError(error, rejectWithValue);
    }
  },
  {
    condition: (_, { getState }) => getState().auth.actionStatus !== 'loading',
  }
);

export const completeGoogleProfile = createAsyncThunk(
  'auth/completeGoogleProfile',
  async ({ userName, fullName }, { getState, rejectWithValue }) => {
    const pendingGoogle = getState().auth.pendingGoogle;

    if (!pendingGoogle?.idToken) {
      return rejectWithValue('Phiên Google đã hết hạn. Vui lòng đăng nhập lại.');
    }

    try {
      const data = await syncGoogleAccount({
        idToken: pendingGoogle.idToken,
        userName: userName.trim(),
        fullName: fullName.trim(),
      });

      if (data?.needsUsername) {
        throw new Error('Không thể hoàn tất đăng ký Google. Thử lại.');
      }

      const user = await signInWithCustomTokenFromBackend(data.customToken);
      const profile = mapBackendUserToProfile(data.user, user);
      const syncedUser = await syncAuthPhotoWithBackendAvatar(user, profile.photoUrl);
      await writeCachedProfile(profile);

      return {
        user: syncedUser,
        profile,
        message: 'Đăng ký Google thành công.',
      };
    } catch (error) {
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const requestEmailVerificationCode = createAsyncThunk(
  'auth/requestEmailVerification',
  async ({ isResend = false } = {}, { getState, rejectWithValue }) => {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const data = await requestEmailVerification(idToken, { isResend });
      const { user, profile } = getState().auth;
      return normalizeEmailVerification(
        {
          email: data.email,
          expiresAt: data.expiresAt,
          expiresInSeconds: data.expiresInSeconds,
          resendAvailableAt: data.resendAvailableAt,
          resendCooldownSeconds: data.resendCooldownSeconds,
        },
        profile?.email || user?.email || data.email || '',
        { isResend }
      );
    } catch (error) {
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const confirmEmailVerificationCode = createAsyncThunk(
  'auth/confirmEmailVerification',
  async ({ code }, { getState, rejectWithValue }) => {
    try {
      const { user } = getState().auth;
      const idToken = await getCurrentUserIdToken();

      if (!user || !idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const data = await confirmEmailVerification({ idToken, code });
      const profile = mapBackendUserToProfile(data.user, user);
      await writeCachedProfile(profile);

      return {
        profile,
        message: 'Xác minh email thành công.',
      };
    } catch (error) {
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthChecking(state) {
      state.status = 'checking';
      state.error = null;
      state.successMessage = null;
    },
    setAuthUser(state, action) {
      const nextUser = action.payload;
      const sameUser = state.user?.uid === nextUser?.uid;

      state.status = 'authenticated';
      state.user = nextUser;
      state.error = null;
      state.configError = null;

      if (!sameUser) {
        state.profile = null;
        state.profileStatus = 'loading';
      }
    },
    setProfile(state, action) {
      state.profile = action.payload;
    },
    applyProfileLocally(state, action) {
      const { fullName, userName, phone, photoUrl } = action.payload;

      if (!state.user) {
        return;
      }

      const trimmedName = fullName?.trim() || '';
      const trimmedUserName = userName?.trim() || '';
      const trimmedPhoto = photoUrl?.trim() || '';
      const timestamp = new Date().toISOString();

      state.user = {
        ...state.user,
        displayName: trimmedName,
        photoURL: trimmedPhoto || state.profile?.photoUrl || '',
      };

      state.profile = {
        ...(state.profile || {}),
        id: state.user.uid,
        email: state.user.email || state.profile?.email || '',
        fullName: trimmedName,
        userName: trimmedUserName || state.profile?.userName || '',
        // Phone chỉ cập nhật sau OTP — không ghi đè từ form hồ sơ.
        phone:
          phone !== undefined && String(phone).trim()
            ? String(phone).trim()
            : state.profile?.phone || '',
        photoUrl: trimmedPhoto || state.profile?.photoUrl || '',
        createdAt: state.profile?.createdAt || timestamp,
        updatedAt: timestamp,
      };
      state.profileStatus = 'succeeded';
      state.error = null;
    },
    applyShopSettingsToProfile(state, action) {
      if (!state.user) {
        return;
      }

      const patch = mapShopSettingsToProfilePatch(action.payload);
      state.profile = mergeProfile(state.user, state.profile, patch);
      state.profileStatus = 'succeeded';
    },
    setUnauthenticated(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.profile = null;
      state.profileStatus = 'idle';
      state.actionStatus = 'idle';
      state.error = null;
      state.successMessage = null;
      state.pendingGoogle = null;
      state.emailVerification = null;
    },
    setConfigError(state, action) {
      state.status = 'unauthenticated';
      state.configError = action.payload;
      state.error = action.payload;
      state.successMessage = null;
    },
    clearAuthFeedback(state) {
      state.error = null;
      state.successMessage = null;
    },
    clearPendingGoogle(state) {
      state.pendingGoogle = null;
      state.error = null;
      state.actionStatus = 'idle';
    },
    resetActionStatus(state) {
      state.actionStatus = 'idle';
      if (state.profileStatus === 'loading' && state.profile) {
        state.profileStatus = 'succeeded';
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserProfile.pending, (state) => {
        if (!state.profile) {
          state.profileStatus = 'loading';
        }
        state.error = null;
      })
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        state.profileStatus = 'succeeded';
        state.profile = action.payload.profile;
        state.error = null;
      })
      .addCase(loadUserProfile.rejected, (state, action) => {
        state.profileStatus = 'failed';
        state.error = action.payload;
      })
      .addCase(syncSellerAccess.pending, (state) => {
        state.sellerAccessStatus = 'loading';
      })
      .addCase(syncSellerAccess.fulfilled, (state, action) => {
        state.sellerAccessStatus = 'succeeded';
        state.sellerAccessSyncedAt = Date.now();

        const nextVerification = action.payload.verification;
        if (!areSellerVerificationsEqual(state.sellerVerification, nextVerification)) {
          state.sellerVerification = nextVerification;
        }

        const nextProfile = action.payload.profile;
        if (nextProfile && !areSellerAccessProfilesEqual(state.profile, nextProfile)) {
          state.profile = nextProfile;
          state.profileStatus = 'succeeded';
        }

        state.error = null;
      })
      .addCase(syncSellerAccess.rejected, (state) => {
        state.sellerAccessStatus = 'failed';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'unauthenticated';
        state.actionStatus = 'idle';
        state.profileStatus = 'idle';
        state.user = null;
        state.profile = null;
        state.error = null;
        state.successMessage = null;
        state.pendingGoogle = null;
        state.emailVerification = null;
        state.sellerVerification = null;
        state.sellerAccessStatus = 'idle';
        state.sellerAccessSyncedAt = null;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        state.error = null;
        state.successMessage = action.payload.message;
      })
      .addCase(confirmEmailVerificationCode.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        state.profile = action.payload.profile;
        state.emailVerification = null;
        state.error = null;
        // Không giữ success message để tránh hiện trên tab Tài khoản.
        state.successMessage = null;
      })
      .addCase(requestEmailVerificationCode.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        state.emailVerification = action.payload;
        state.error = null;
        state.successMessage = 'Đã gửi mã xác minh tới email của bạn.';
      })
      .addCase(completeGoogleProfile.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.actionStatus = 'idle';
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.pendingGoogle = null;
        state.error = null;
        state.successMessage = action.payload.message;
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.actionStatus = 'loading';
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        if (action.payload?.profile) {
          state.profile = action.payload.profile;
          state.user = {
            ...state.user,
            displayName: action.payload.profile.fullName || state.user.displayName,
            photoURL: action.payload.profile.photoUrl || '',
          };
        }
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.actionStatus = 'idle';
        state.error = action.payload;
      })
      .addCase(uploadUserAvatar.pending, (state) => {
        state.actionStatus = 'loading';
        state.error = null;
        state.successMessage = null;
      })
      .addCase(uploadUserAvatar.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        state.profile = action.payload.profile;
        state.user = {
          ...state.user,
          photoURL: action.payload.profile?.photoUrl || '',
        };
        state.error = null;
        state.successMessage = action.payload.message;
      })
      .addCase(uploadUserAvatar.rejected, (state, action) => {
        state.actionStatus = 'idle';
        state.error = action.payload;
        state.successMessage = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.actionStatus = 'idle';
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.emailVerification = action.payload.emailVerification || null;
        state.error = null;
        state.successMessage = action.payload.message;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.actionStatus = 'idle';
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.error = null;
        // Không hiện "Đăng nhập thành công" trên tab Tài khoản.
        state.successMessage = null;
      })
      .addMatcher(
        (action) =>
          [
            registerUser.pending.type,
            loginUser.pending.type,
            logoutUser.pending.type,
            changePassword.pending.type,
            socialLogin.pending.type,
            completeGoogleProfile.pending.type,
            requestEmailVerificationCode.pending.type,
            confirmEmailVerificationCode.pending.type,
          ].includes(action.type),
        (state) => {
          state.actionStatus = 'loading';
          state.error = null;
          state.successMessage = null;
        }
      )
      .addMatcher(
        (action) => action.type === socialLogin.fulfilled.type,
        (state, action) => {
          state.actionStatus = 'idle';

          if (action.payload.needsUsername) {
            state.pendingGoogle = action.payload.pendingGoogle;
            state.error = null;
            state.successMessage = null;
            return;
          }

          state.status = 'authenticated';
          state.user = action.payload.user;
          state.profile = action.payload.profile;
          state.pendingGoogle = null;
          state.error = null;
          state.successMessage = null;
        }
      )
      .addMatcher(
        (action) =>
          [
            registerUser.rejected.type,
            loginUser.rejected.type,
            logoutUser.rejected.type,
            changePassword.rejected.type,
            socialLogin.rejected.type,
            completeGoogleProfile.rejected.type,
            requestEmailVerificationCode.rejected.type,
            confirmEmailVerificationCode.rejected.type,
          ].includes(action.type),
        (state, action) => {
          state.actionStatus = 'idle';
          const showWhileAuthenticated = [
            confirmEmailVerificationCode.rejected.type,
            requestEmailVerificationCode.rejected.type,
            completeGoogleProfile.rejected.type,
            socialLogin.rejected.type,
          ].includes(action.type);

          if (state.status !== 'authenticated' || showWhileAuthenticated) {
            const payload = action.payload;
            state.error =
              payload && typeof payload === 'object' && payload.message
                ? payload.message
                : payload || 'Đã có lỗi xảy ra.';
          } else {
            log.warn('[AUTH] rejected thunk ignored — user already authenticated', {
              action: action.type,
              error: action.payload,
            });
          }
          state.successMessage = null;
        }
      );
  },
});

export const {
  applyProfileLocally,
  applyShopSettingsToProfile,
  clearAuthFeedback,
  clearPendingGoogle,
  resetActionStatus,
  setAuthChecking,
  setAuthUser,
  setProfile,
  setUnauthenticated,
  setConfigError,
} = authSlice.actions;

export const applyProfileWithCache = createAsyncThunk(
  'auth/applyProfileWithCache',
  async (profileForm, { dispatch, getState }) => {
    dispatch(applyProfileLocally(profileForm));
    const profile = getState().auth.profile;
    if (profile) {
      await writeCachedProfile(profile);
    }
  }
);

export default authSlice.reducer;
