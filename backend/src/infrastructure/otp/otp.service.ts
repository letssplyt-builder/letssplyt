import crypto from 'crypto';
import { AppError } from '../errors';
import { isOtpDevBypassEnabled } from '../../modules/auth/otp-dev-bypass';
import { createSMSProvider } from '../sms/factory';
import { supabaseAdmin } from '../supabase';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

interface OtpVerificationRow {
  id: string;
  code_hash: string;
  expires_at: string;
  attempt_count: number;
  verified_at: string | null;
}

/** Strip non-digits; SMS keyboards and paste often add spaces or dashes. */
export function normalizeOtpCodeInput(code: string): string {
  return code.replace(/\D/g, '');
}

function otpHmacSecret(): string {
  const dedicated = process.env.OTP_HMAC_SECRET?.trim();
  if (dedicated) {
    return dedicated;
  }
  const fallback = process.env.PII_HMAC_SALT;
  if (!fallback) {
    throw new AppError('INTERNAL_ERROR', 'PII_HMAC_SALT not configured', 500, undefined, false);
  }
  return fallback;
}

function hashOtpCode(code: string): string {
  return crypto.createHmac('sha256', otpHmacSecret()).update(code).digest('hex');
}

function otpHashesEqual(storedHash: string, providedHash: string): boolean {
  const stored = Buffer.from(storedHash, 'hex');
  const provided = Buffer.from(providedHash, 'hex');
  if (stored.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(stored, provided);
}

function buildOtpMessage(code: string): string {
  return `Your LetsSplyt verification code is: ${code}. Valid for ${OTP_TTL_MINUTES} minutes. Reply STOP to opt out.`;
}

/**
 * Generate and send a 6-digit OTP via the configured SMS provider.
 * Caller must run checkOtpRequestRate(phoneHash) before invoking.
 */
export async function sendOTP(phoneHash: string, phoneE164: string): Promise<void> {
  await supabaseAdmin
    .from('otp_verifications')
    .delete()
    .eq('phone_hash', phoneHash)
    .is('verified_at', null);

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin.from('otp_verifications').insert({
    phone_hash: phoneHash,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create OTP', 500, undefined, false);
  }

  const sms = createSMSProvider();
  await sms.sendOutboundMessage({
    toE164: phoneE164,
    body: buildOtpMessage(code),
    preferredChannel: 'sms',
  });
}

async function incrementOtpAttemptAtomic(otpId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('increment_otp_attempt', {
    p_otp_id: otpId,
  });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Failed to record OTP attempt', 500, undefined, false);
  }

  return typeof data === 'number' ? data : null;
}

/** Verify OTP; throws AppError with mobile-compatible codes on failure. */
export async function verifyOTP(phoneHash: string, code: string): Promise<void> {
  const normalizedCode = normalizeOtpCodeInput(code);
  if (!/^[0-9]{6}$/.test(normalizedCode)) {
    throw new AppError('INVALID_CODE', 'Invalid OTP code', 400);
  }

  if (isOtpDevBypassEnabled()) {
    return;
  }

  const codeHash = hashOtpCode(normalizedCode);
  const now = new Date().toISOString();

  const { data: otpRow, error } = await supabaseAdmin
    .from('otp_verifications')
    .select('id, code_hash, expires_at, attempt_count, verified_at')
    .eq('phone_hash', phoneHash)
    .is('verified_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !otpRow) {
    throw new AppError('CODE_EXPIRED', 'Code has expired. Request a new one.', 400);
  }

  const row = otpRow as OtpVerificationRow;

  if (row.attempt_count >= OTP_MAX_ATTEMPTS) {
    await supabaseAdmin.from('otp_verifications').delete().eq('id', row.id);
    throw new AppError('OTP_MAX_ATTEMPTS', 'Too many attempts. Request a new code.', 429);
  }

  if (!otpHashesEqual(row.code_hash, codeHash)) {
    const newAttemptCount = await incrementOtpAttemptAtomic(row.id);
    if (newAttemptCount === null) {
      await supabaseAdmin.from('otp_verifications').delete().eq('id', row.id);
      throw new AppError('OTP_MAX_ATTEMPTS', 'Too many attempts. Request a new code.', 429);
    }
    throw new AppError('INVALID_CODE', 'Invalid OTP code', 400);
  }

  await supabaseAdmin.from('otp_verifications').delete().eq('id', row.id);
}

export async function purgeExpiredOTPs(): Promise<number> {
  const now = new Date().toISOString();
  const { error, count } = await supabaseAdmin
    .from('otp_verifications')
    .delete({ count: 'exact' })
    .lt('expires_at', now)
    .is('verified_at', null);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Failed to purge expired OTPs', 500, undefined, false);
  }

  return count ?? 0;
}
