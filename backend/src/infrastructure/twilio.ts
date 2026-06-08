import twilio from 'twilio';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

/**
 * Twilio requires this magic Verify Service SID when authenticating with
 * Test Credentials. A live-account VA... SID will fail with auth/404 errors.
 * @see https://www.twilio.com/docs/iam/test-credentials
 */
export const TWILIO_TEST_VERIFY_SERVICE_SID = 'VAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

/**
 * Resolve which Verify Service SID to use when calling live Twilio Verify
 * (requires live credentials — test credentials return error 20008).
 */
export function getVerifyServiceSid(): string {
  if (process.env.TWILIO_USE_LIVE_VERIFY === 'true') {
    return process.env.TWILIO_VERIFY_SERVICE_SID!;
  }
  if (process.env.APP_ENV === 'staging' || process.env.APP_ENV === 'production') {
    return process.env.TWILIO_VERIFY_SERVICE_SID!;
  }
  return TWILIO_TEST_VERIFY_SERVICE_SID;
}

/** @deprecated Use getVerifyServiceSid() — kept for imports that expect a constant */
export const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID!;
