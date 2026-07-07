export {
  changeCurrentUserPassword,
  getCurrentFirebaseUser,
  getCurrentUserIdToken,
  loginWithEmail,
  logoutCurrentUser,
  registerWithEmail,
  signInWithGoogleCredential,
  subscribeToAuthChanges,
  updateCurrentUserProfile,
} from '../api/authApi';

export { serializeAuthUser } from '../model/authModel';
