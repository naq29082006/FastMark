import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

export function getSellerRegistrationStep(profile, verification = null) {
  const phone = String(profile?.phone || '').trim();

  if (!/^\d{10}$/.test(phone)) {
    return 'phone';
  }

  if (!profile?.sellerPhoneVerified) {
    return 'verify';
  }

  if (
    verification?.status === SELLER_VERIFICATION_STATUS.PENDING ||
    verification?.status === SELLER_VERIFICATION_STATUS.REJECTED
  ) {
    return 'pending';
  }

  return 'register';
}
