export {
  cacheIdToken,
  changeCurrentUserPassword,
  clearCachedIdToken,
  getCurrentFirebaseUser,
  getCurrentUserIdToken,
  loginWithEmail,
  logoutCurrentUser,
  registerWithEmail,
  signInWithCustomTokenFromBackend,
  signInWithGoogleCredential,
  subscribeToAuthChanges,
  updateCurrentUserProfile,
  waitForAuthReady,
} from '../api/authApi';

export { serializeAuthUser } from '../model/authModel';
