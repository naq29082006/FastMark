export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthActionStatus = (state) => state.auth.actionStatus;
export const selectAuthConfigError = (state) => state.auth.configError;
export const selectAuthError = (state) => state.auth.error;
export const selectAuthSuccessMessage = (state) => state.auth.successMessage;
export const selectAuthUser = (state) => state.auth.user;
export const selectAuthProfile = (state) => state.auth.profile;
export const selectAuthProfileStatus = (state) => state.auth.profileStatus;
export const selectUserRole = (state) => state.auth.profile?.role ?? 1;
export const selectIsSeller = (state) => (state.auth.profile?.role ?? 1) === 2;
export const selectPendingGoogle = (state) => state.auth.pendingGoogle;
export const selectEmailVerification = (state) => state.auth.emailVerification;
export const selectNeedsEmailVerification = (state) => {
  const profile = state.auth.profile;
  return (
    state.auth.status === 'authenticated' &&
    profile?.authProvider === 'email' &&
    !profile?.verifyAccount
  );
};
