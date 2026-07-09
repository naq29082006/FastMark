const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function validateLoginForm({ login, password }) {
  if (!login?.trim() || !password) {
    return 'Vui lòng nhập email/userName và mật khẩu.';
  }

  if (password.length < 6) {
    return 'Mật khẩu cần tối thiểu 6 ký tự.';
  }

  return '';
}

export function validateRegisterForm({
  fullName,
  email,
  userName,
  password,
  confirmPassword,
  acceptedTerms,
}) {
  if (!fullName?.trim() || !email?.trim() || !userName?.trim() || !password || !confirmPassword) {
    return 'Vui lòng nhập đủ họ tên, email, userName và mật khẩu.';
  }

  if (fullName.trim().length < 2) {
    return 'Họ tên phải có ít nhất 2 ký tự.';
  }

  if (!email.includes('@')) {
    return 'Email không hợp lệ.';
  }

  const normalizedUserName = userName.trim();

  if (normalizedUserName.length < 3 || normalizedUserName.length > 20) {
    return 'UserName phải từ 3 đến 20 ký tự.';
  }

  if (!USERNAME_PATTERN.test(normalizedUserName)) {
    return 'UserName chỉ được dùng chữ, số và dấu gạch dưới.';
  }

  if (password !== confirmPassword) {
    return 'Mật khẩu xác nhận chưa khớp.';
  }

  if (password.length < 6) {
    return 'Mật khẩu cần tối thiểu 6 ký tự.';
  }

  if (!acceptedTerms) {
    return 'Bạn cần đồng ý với điều khoản dịch vụ.';
  }

  return '';
}

export function validateUserName(userName) {
  const normalizedUserName = String(userName || '').trim();

  if (!normalizedUserName) {
    return 'Vui lòng nhập tên đăng nhập.';
  }

  if (normalizedUserName.length < 3 || normalizedUserName.length > 20) {
    return 'UserName phải từ 3 đến 20 ký tự.';
  }

  if (!USERNAME_PATTERN.test(normalizedUserName)) {
    return 'UserName chỉ được dùng chữ, số và dấu gạch dưới.';
  }

  return '';
}

export function validateGoogleProfileForm({ fullName, userName }) {
  if (!fullName?.trim() || !userName?.trim()) {
    return 'Vui lòng nhập đủ họ tên và tên đăng nhập.';
  }

  if (fullName.trim().length < 2) {
    return 'Họ tên phải có ít nhất 2 ký tự.';
  }

  return validateUserName(userName);
}

export function validateEmailVerificationForm({ code }) {
  const normalizedCode = String(code || '').trim();

  if (!normalizedCode) {
    return 'Vui lòng nhập mã xác minh.';
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    return 'Mã xác minh gồm 6 chữ số.';
  }

  return '';
}
