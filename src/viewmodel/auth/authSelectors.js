export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthActionStatus = (state) => state.auth.actionStatus;
export const selectAuthConfigError = (state) => state.auth.configError;
export const selectAuthError = (state) => state.auth.error;
export const selectAuthSuccessMessage = (state) => state.auth.successMessage;
export const selectAuthUser = (state) => state.auth.user;
export const selectAuthProfile = (state) => state.auth.profile;
export const selectAuthProfileStatus = (state) => state.auth.profileStatus;
export const selectUserRole = (state) => state.auth.profile?.role ?? 1;
import { canSwitchToSellerMode } from '../../view/seller/sellerRegistrationFlow';

export const selectIsSeller = (state) => Number(state.auth.profile?.role ?? 1) === 2;
export const selectCanPostProducts = (state) => Number(state.auth.profile?.role ?? 1) === 2;
export const selectCanSwitchToSeller = (state) =>
  canSwitchToSellerMode({
    role: state.auth.profile?.role ?? 1,
    verification: state.auth.sellerVerification,
  });
export const selectSellerVerification = (state) => state.auth.sellerVerification;
export const selectSellerAccessStatus = (state) => state.auth.sellerAccessStatus;
export const selectSellerAccessSyncedAt = (state) => state.auth.sellerAccessSyncedAt;
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
