/**
 * Skip Twilio Verify in local dev. Twilio test credentials cannot call the Verify API
 * (Twilio error 20008). Live Verify requires TWILIO_USE_LIVE_VERIFY=true in development.
 */
export function isOtpDevBypassEnabled(): boolean {
  if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
    return false;
  }
  if (process.env.OTP_DEV_BYPASS === 'false') return false;
  if (process.env.OTP_DEV_BYPASS === 'true') return true;
  if (process.env.TWILIO_USE_LIVE_VERIFY === 'true') return false;
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  if (sid === 'ACtest' || sid.startsWith('ACtest')) return true;
  return (
    process.env.APP_ENV === 'development' ||
    process.env.APP_ENV === 'test' ||
    process.env.APP_ENV === undefined
  );
}
