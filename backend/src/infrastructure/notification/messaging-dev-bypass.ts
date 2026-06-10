/**
 * Skip live Twilio Programmable Messaging in local dev. Magic test numbers
 * (+15005550001–04) only work with Twilio test credentials; live credentials reject them.
 */
export function isMessagingDevBypassEnabled(): boolean {
  if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
    return false;
  }
  if (process.env.MESSAGING_DEV_BYPASS === 'false') return false;
  if (process.env.MESSAGING_DEV_BYPASS === 'true') return true;
  if (process.env.TWILIO_USE_LIVE_MESSAGING === 'true') return false;
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  if (sid === 'ACtest' || sid.startsWith('ACtest')) return true;
  return (
    process.env.APP_ENV === 'development' ||
    process.env.APP_ENV === 'test' ||
    process.env.APP_ENV === undefined
  );
}

export function createDevBypassMessageSid(): string {
  return `SMdev${Date.now().toString(36)}`;
}
