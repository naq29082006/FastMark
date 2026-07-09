export function getSellerRegistrationStep(profile) {
  const phone = String(profile?.phone || '').trim();

  if (!/^\d{10}$/.test(phone)) {
    return 'phone';
  }

  if (!profile?.sellerPhoneVerified) {
    return 'verify';
  }

  return 'register';
}
