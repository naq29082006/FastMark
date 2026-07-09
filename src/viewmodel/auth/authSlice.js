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
import { mapBackendUserToProfile } from '../../model/profileModel';
import { getFirebaseInitConfigError } from '../../core/config/firebaseApp';
import {
  makeProfileFromAuthUser,
  readCachedProfile,
  readUserProfile,
  upsertUserProfile,
  writeCachedProfile,
} from '../../repository/profileRepository';
import { toReadableAuthError } from './authErrors';
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
};

function rejectWithReadableError(error, rejectWithValue) {
  return rejectWithValue(toReadableAuthError(error));
}

export const hydrateAuthSession = createAsyncThunk(
  'auth/hydrateSession',
  async (_, { rejectWithValue }) => {
    try {
      const configError = getFirebaseInitConfigError();

      if (configError) {
        throw new Error(configError);
      }

      const firebaseUser = getCurrentFirebaseUser();

      if (!firebaseUser) {
        return { user: null, profile: null };
      }

      const user = serializeAuthUser(firebaseUser);
      const profile = await readUserProfile(user);

      return { user, profile };
    } catch (error) {
      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

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

export const registerUser = createAsyncThunk(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    log.step('[AUTH] registerUser START', { email: payload.email, userName: payload.userName });

    try {
      const configError = getFirebaseInitConfigError();
      if (configError) {
        throw new Error(configError);
      }

      await registerAccount({
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

      log.step('[AUTH] registerUser SUCCESS', { uid: user.uid });
      return { user, profile, message: 'Đăng ký thành công.' };
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
  async (payload, { getState }) => {
    const state = getState();
    const authUser = state.auth.user;
    const currentProfile = state.auth.profile;

    if (!authUser) {
      return;
    }

    const updates = {
      fullName: payload.fullName?.trim() || '',
      phone: payload.phone?.trim() || '',
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
        const backendData = await updateProfileOnBackend({
          idToken,
          fullName: updates.fullName,
          phone: updates.phone,
        });
        const profile = mapBackendUserToProfile(backendData.user, authUser);
        await writeCachedProfile(profile);
        log.ok('updateUserProfile:backend-sync', { uid: authUser.uid });
        return;
      } catch (error) {
        log.fail('updateUserProfile:backend-sync', error);
      }
    }

    try {
      const profile = await upsertUserProfile(
        authUser,
        { ...currentProfile, ...updates },
        { existingProfile: currentProfile }
      );
      await writeCachedProfile(profile);
      log.ok('updateUserProfile:success', { uid: authUser.uid });
    } catch (error) {
      log.fail('updateUserProfile:remote-sync', error);
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
      await writeCachedProfile(profile);

      log.ok('socialLogin:success', { uid: user.uid });
      return {
        needsUsername: false,
        user,
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
      await writeCachedProfile(profile);

      return {
        user,
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
  async (_, { rejectWithValue }) => {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const data = await requestEmailVerification(idToken);
      return {
        email: data.email,
        expiresAt: data.expiresAt,
        expiresInSeconds: data.expiresInSeconds,
        devCode: data.devCode,
      };
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
      const { fullName, phone, photoUrl } = action.payload;

      if (!state.user) {
        return;
      }

      const trimmedName = fullName?.trim() || '';
      const trimmedPhone = phone?.trim() || '';
      const trimmedPhoto = photoUrl?.trim() || '';
      const timestamp = new Date().toISOString();

      state.user = {
        ...state.user,
        displayName: trimmedName,
        photoURL: trimmedPhoto || state.user.photoURL || '',
      };

      state.profile = {
        ...(state.profile || {}),
        id: state.user.uid,
        email: state.user.email || state.profile?.email || '',
        fullName: trimmedName,
        phone: trimmedPhone,
        photoUrl: trimmedPhoto || state.profile?.photoUrl || state.user.photoURL || '',
        createdAt: state.profile?.createdAt || timestamp,
        updatedAt: timestamp,
      };
      state.profileStatus = 'succeeded';
      state.error = null;
      state.successMessage = 'Đã lưu.';
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
      .addCase(hydrateAuthSession.pending, (state) => {
        state.status = 'checking';
        state.error = null;
      })
      .addCase(hydrateAuthSession.fulfilled, (state, action) => {
        state.status = action.payload.user ? 'authenticated' : 'unauthenticated';
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.error = null;
        state.configError = null;
      })
      .addCase(hydrateAuthSession.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.user = null;
        state.profile = null;
        state.profileStatus = 'idle';
        state.error = action.payload;
      })
      .addCase(loadUserProfile.pending, (state) => {
        state.profileStatus = 'loading';
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
        state.successMessage = action.payload.message;
      })
      .addCase(requestEmailVerificationCode.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        state.emailVerification = action.payload;
        state.error = null;
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
          photoURL: action.payload.profile?.photoUrl || state.user?.photoURL || '',
        };
        state.error = null;
        state.successMessage = action.payload.message;
      })
      .addCase(uploadUserAvatar.rejected, (state, action) => {
        state.actionStatus = 'idle';
        state.error = action.payload;
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
        (action) =>
          [
            registerUser.fulfilled.type,
            loginUser.fulfilled.type,
          ].includes(action.type),
        (state, action) => {
          state.status = 'authenticated';
          state.actionStatus = 'idle';
          state.user = action.payload.user;
          state.profile = action.payload.profile;
          state.error = null;
          state.successMessage = action.payload.message;
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
          state.successMessage = action.payload.message;
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
            state.error = action.payload;
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
