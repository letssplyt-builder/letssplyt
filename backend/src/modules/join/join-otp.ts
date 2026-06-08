import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { twilioClient, getVerifyServiceSid } from '../../infrastructure/twilio';
import { isOtpDevBypassEnabled } from '../auth/otp-dev-bypass';
import { hashPhone } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { checkOtpRequestRate } from '../../middleware/rateLimiter';
import { RateLimitError } from '../../infrastructure/errors';

export interface JoinOtpSendResult {
  sent: boolean;
  reason?: 'OTP_UNAVAILABLE';
}

export async function sendOtp(phoneE164: string): Promise<JoinOtpSendResult> {
  const phoneHash = hashPhone(phoneE164);

  const { data: optOut } = await supabaseAdmin
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_hash', phoneHash)
    .maybeSingle();

  if (optOut) {
    return { sent: false, reason: 'OTP_UNAVAILABLE' };
  }

  try {
    checkOtpRequestRate(phoneHash);
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new AppError('OTP_RATE_LIMITED', err.message, 429);
    }
    throw err;
  }

  if (isOtpDevBypassEnabled()) {
    logger.info({
      msg: 'Join OTP dev bypass — Twilio send skipped',
      phoneHash,
    });
    return { sent: true };
  }

  const verifySid = getVerifyServiceSid();
  try {
    await twilioClient.verify.v2.services(verifySid).verifications.create({
      to: phoneE164,
      channel: 'sms',
    });
    return { sent: true };
  } catch (err: unknown) {
    const twilioErr = err as { code?: number };
    logger.error({ msg: 'Twilio join OTP send failed', twilioCode: twilioErr.code, phoneHash });
    if (twilioErr.code === 60200) {
      throw new AppError('INVALID_PHONE', 'Invalid phone number', 400);
    }
    return { sent: false, reason: 'OTP_UNAVAILABLE' };
  }
}

export async function verifyTwilioCodeForJoin(phoneE164: string, code: string): Promise<boolean> {
  if (isOtpDevBypassEnabled()) {
    return /^[0-9]{6}$/.test(code);
  }

  try {
    const check = await twilioClient.verify.v2
      .services(getVerifyServiceSid())
      .verificationChecks.create({ to: phoneE164, code });

    return check.status === 'approved' && check.valid === true;
  } catch {
    return false;
  }
}
