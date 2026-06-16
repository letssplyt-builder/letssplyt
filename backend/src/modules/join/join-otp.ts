import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { sendOTP, verifyOTP } from '../../infrastructure/otp/otp.service';
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
      msg: 'Join OTP dev bypass — SMS send skipped',
      phoneHash,
    });
    return { sent: true };
  }

  try {
    await sendOTP(phoneHash, phoneE164);
    return { sent: true };
  } catch (err: unknown) {
    logger.error({
      msg: 'Join OTP send failed',
      phoneHash,
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof AppError && err.code === 'INVALID_PHONE') {
      throw err;
    }
    return { sent: false, reason: 'OTP_UNAVAILABLE' };
  }
}

export async function verifyOtpCodeForJoin(phoneE164: string, code: string): Promise<boolean> {
  const phoneHash = hashPhone(phoneE164);
  try {
    await verifyOTP(phoneHash, code);
    return true;
  } catch {
    return false;
  }
}
