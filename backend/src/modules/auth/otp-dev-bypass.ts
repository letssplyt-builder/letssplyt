/**
 * Skip real OTP verification in local dev/test only.
 * Uses custom OTP (not Twilio Verify); ACtest SIDs skip SMS send in tests.
 *
 * FAIL CLOSED: unset or unknown APP_ENV never enables bypass (audit C1).
 */
export function isOtpDevBypassEnabled(): boolean {
  const appEnv = process.env.APP_ENV;

  if (appEnv === 'production' || appEnv === 'staging') {
    return false;
  }

  if (appEnv !== 'development' && appEnv !== 'test') {
    return false;
  }

  if (process.env.OTP_DEV_BYPASS === 'false') {
    return false;
  }

  if (process.env.OTP_DEV_BYPASS === 'true') {
    return true;
  }

  if (process.env.TWILIO_USE_LIVE_VERIFY === 'true') {
    return false;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  if (sid === 'ACtest' || sid.startsWith('ACtest')) {
    return true;
  }

  return false;
}
