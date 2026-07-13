import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

export function canSwitchToSellerMode({ role, verification } = {}) {
  const normalizedRole = Number(role ?? 1);

  if (verification?.status === SELLER_VERIFICATION_STATUS.PENDING) {
    return false;
  }

  if (verification?.status === SELLER_VERIFICATION_STATUS.REJECTED) {
    return false;
  }

  if (normalizedRole !== 2) {
    return false;
  }

  return !verification || verification.status === SELLER_VERIFICATION_STATUS.APPROVED;
}

export function getSellerRegisterButtonLabel({ role, verification } = {}) {
  if (canSwitchToSellerMode({ role, verification })) {
    return 'Chuyển sang người bán';
  }

  if (verification?.status === SELLER_VERIFICATION_STATUS.PENDING) {
    return 'Chờ duyệt...';
  }

  if (verification?.status === SELLER_VERIFICATION_STATUS.REJECTED) {
    return 'Chỉnh sửa hồ sơ đăng ký';
  }

  return 'Đăng ký người bán';
}

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
