/** Thời gian chờ gửi lại OTP / mã email (giây) — đồng bộ với backend. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function resolveRemainingSeconds(source = {}) {
  const direct =
    Number(source.remainingSeconds) ||
    Number(source.resendCooldownSeconds) ||
    Number(source.data?.remainingSeconds) ||
    Number(source.data?.resendCooldownSeconds) ||
    Number(source.payload?.remainingSeconds) ||
    Number(source.payload?.data?.remainingSeconds) ||
    Number(source.payload?.data?.resendCooldownSeconds);

  if (direct > 0) {
    return direct;
  }

  const resendAvailableAt =
    source.resendAvailableAt ||
    source.data?.resendAvailableAt ||
    source.payload?.data?.resendAvailableAt;

  if (resendAvailableAt) {
    return Math.max(0, Math.ceil((new Date(resendAvailableAt).getTime() - Date.now()) / 1000));
  }

  return 0;
}

export function formatResendCountdownLabel(secondsLeft, { prefix = 'Gửi lại mã sau' } = {}) {
  const safe = Math.max(0, Number(secondsLeft) || 0);
  if (safe <= 0) {
    return 'Gửi lại mã';
  }
  return `${prefix} (${safe}s)`;
}

export function syncResendCooldownFromError(error, fallbackSeconds = OTP_RESEND_COOLDOWN_SECONDS) {
  const remaining = resolveRemainingSeconds({
    data: error?.data,
    payload: error?.payload,
    remainingSeconds: error?.payload?.remainingSeconds,
  });
  return remaining > 0 ? remaining : fallbackSeconds;
}
