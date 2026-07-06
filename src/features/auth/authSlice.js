import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import {
  changeCurrentUserPassword,
  getCurrentFirebaseUser,
  loginWithEmail,
  logoutCurrentUser,
  registerWithEmail,
  serializeAuthUser,
  signInWithGoogleCredential,
  updateCurrentUserProfile,
} from '../../services/authService';
import { getAuthConfigError } from '../../services/env';
import { readUserProfile, upsertUserProfile, makeProfileFromAuthUser } from '../../services/profileService';
import { readCachedProfile, writeCachedProfile } from '../../services/profileCache';
import { toReadableAuthError } from './authErrors';
import { clearGoogleSignInSession } from './clearGoogleSignInSession';
import { authLogger as log } from '../../utils/logger';

const initialState = {
  status: 'checking',
  actionStatus: 'idle',
  user: null,
  profile: null,
  profileStatus: 'idle',
  error: null,
  successMessage: null,
  configError: null,
};

function rejectWithReadableError(error, rejectWithValue) {
  return rejectWithValue(toReadableAuthError(error));
}

export const hydrateAuthSession = createAsyncThunk(
  'auth/hydrateSession',
  async (_, { rejectWithValue }) => {
    try {
      const configError = getAuthConfigError();

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
    log.step('[AUTH] registerUser START', { email: payload.email });

    try {
      const configError = getAuthConfigError();
      if (configError) {
        throw new Error(configError);
      }

      const user = await registerWithEmail(payload);

      log.step('[PROFILE] upsertUserProfile START (register)', { uid: user.uid });
      let profile;
      try {
        profile = await upsertUserProfile(user, {
          fullName: payload.fullName,
          phone: payload.phone,
          photoUrl: payload.photoUrl,
        });
        log.step('[PROFILE] upsertUserProfile SUCCESS (register)', { uid: user.uid });
      } catch (profileError) {
        log.fail('[PROFILE] upsertUserProfile FAILED (non-fatal — auth succeeded)', profileError);
        profile = makeProfileFromAuthUser(user, {
          fullName: payload.fullName,
          phone: payload.phone,
          photoUrl: payload.photoUrl,
        });
      }

      log.step('[AUTH] registerUser SUCCESS', { uid: user.uid });
      return { user, profile, message: 'Đăng ký thành công.' };
    } catch (error) {
      log.fail('[AUTH] registerUser FAILED', error);

      const existingUser = getCurrentFirebaseUser();
      if (existingUser?.email === payload.email?.trim()) {
        log.warn('[AUTH] registerUser RECOVERED — Firebase user exists despite error', {
          uid: existingUser.uid,
          originalError: error?.code || error?.message,
        });
        const user = serializeAuthUser(existingUser);
        const profile = makeProfileFromAuthUser(user, {
          fullName: payload.fullName,
          phone: payload.phone,
          photoUrl: payload.photoUrl,
        });
        return { user, profile, message: 'Đăng ký thành công.' };
      }

      return rejectWithReadableError(error, rejectWithValue);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload, { rejectWithValue }) => {
    log.step('[AUTH] loginUser START', { email: payload.email });

    try {
      const configError = getAuthConfigError();
      if (configError) {
        throw new Error(configError);
      }

      const user = await loginWithEmail(payload);

      log.step('[PROFILE] upsertUserProfile START (login)', { uid: user.uid });
      let profile;
      try {
        profile = await upsertUserProfile(user);
        log.step('[PROFILE] upsertUserProfile SUCCESS (login)', { uid: user.uid });
      } catch (profileError) {
        log.fail('[PROFILE] upsertUserProfile FAILED (non-fatal — auth succeeded)', profileError);
        profile = makeProfileFromAuthUser(user);
      }

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
  async ({ token }, { rejectWithValue }) => {
    try {
      log.info('socialLogin:start');
      const configError = getAuthConfigError();
      if (configError) throw new Error(configError);

      const user = await signInWithGoogleCredential(token);

      let profile;
      try {
        profile = await upsertUserProfile(user);
      } catch (profileError) {
        log.fail('socialLogin:profile-sync', profileError);
        profile = makeProfileFromAuthUser(user);
      }

      log.ok('socialLogin:success', { uid: user.uid });
      return { user, profile, message: 'Đăng nhập thành công.' };
    } catch (error) {
      log.fail('socialLogin', error);
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
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.actionStatus = 'idle';
        state.error = null;
        state.successMessage = action.payload.message;
      })
      .addMatcher(
        (action) =>
          [
            registerUser.pending.type,
            loginUser.pending.type,
            logoutUser.pending.type,
            changePassword.pending.type,
            socialLogin.pending.type,
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
            socialLogin.fulfilled.type,
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
        (action) =>
          [
            registerUser.rejected.type,
            loginUser.rejected.type,
            logoutUser.rejected.type,
            changePassword.rejected.type,
            socialLogin.rejected.type,
          ].includes(action.type),
        (state, action) => {
          state.actionStatus = 'idle';
          // Do not overwrite authenticated session if auth listener already signed in.
          if (state.status !== 'authenticated') {
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
  resetActionStatus,
  setAuthChecking,
  setAuthUser,
  setProfile,
  setUnauthenticated,
  setConfigError,
} = authSlice.actions;

export default authSlice.reducer;
