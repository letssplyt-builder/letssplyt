import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError, RateLimitError } from '../../infrastructure/errors';
import { encryptPhone, hashPhone } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { createAdminSession } from '../../infrastructure/supabase-auth';
import { twilioClient, TWILIO_VERIFY_SERVICE_SID } from '../../infrastructure/twilio';
import { checkOtpRequestRate, checkOtpVerifyRate } from '../../middleware/rateLimiter';
import type { AuthSession, OtpRequestResponse } from '@letssplyt/shared/auth.types';

const AVATAR_COLOURS = [
  '#4F46E5',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#D97706',
  '#059669',
  '#0284C7',
  '#0891B2',
] as const;

function normalisePhone(input: string): string {
  const parsed = parsePhoneNumberFromString(input);
  if (!parsed?.isValid()) {
    throw new AppError('INVALID_PHONE', 'Must be a valid E.164 phone number', 400);
  }
  return parsed.format('E.164');
}

function pickAvatarColour(): string {
  const index = Math.floor(Math.random() * AVATAR_COLOURS.length);
  return AVATAR_COLOURS[index] ?? '#4F46E5';
}

export async function sendOtp(
  phoneInput: string,
  channel: 'sms' | 'whatsapp' = 'sms',
): Promise<OtpRequestResponse> {
  const phoneE164 = normalisePhone(phoneInput);
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

  try {
    const verification = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phoneE164, channel });

    return {
      sent: true,
      channel: verification.channel as 'sms' | 'whatsapp',
      expires_in_seconds: 600,
    };
  } catch (err: unknown) {
    const twilioErr = err as { code?: number };
    if (twilioErr.code === 60212) {
      const fallback = await twilioClient.verify.v2
        .services(TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: phoneE164, channel: 'sms' });
      return {
        sent: true,
        channel: fallback.channel as 'sms' | 'whatsapp',
        expires_in_seconds: 600,
      };
    }
    if (twilioErr.code === 60200) {
      throw new AppError('INVALID_PHONE', 'Invalid phone number', 400);
    }
    if (twilioErr.code === 20429) {
      throw new AppError('OTP_RATE_LIMITED', 'Too many OTP requests', 429);
    }
    throw new AppError('OTP_UNAVAILABLE', 'Unable to send OTP', 503);
  }
}

async function verifyTwilioCode(phoneE164: string, code: string): Promise<boolean> {
  try {
    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phoneE164, code });

    return check.status === 'approved' && check.valid === true;
  } catch (err: unknown) {
    const twilioErr = err as { code?: number };
    if (twilioErr.code === 60202) {
      throw new AppError('OTP_MAX_ATTEMPTS', 'Too many attempts. Request a new code.', 429);
    }
    if (twilioErr.code === 60203) {
      throw new AppError('CODE_EXPIRED', 'Code has expired. Request a new one.', 400);
    }
    return false;
  }
}

async function ensurePublicUserRow(
  userId: string,
  phoneHash: string,
  phoneEncrypted: string,
  displayName: string,
  avatarColour: string,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabaseAdmin.from('users').insert({
    id: userId,
    phone_hash: phoneHash,
    phone_encrypted: phoneEncrypted,
    display_name: displayName,
    avatar_colour: avatarColour,
  });

  if (error) {
    throw new AppError('AUTH_PROFILE_CREATION_FAILED', 'Could not create user profile', 500);
  }
}

export async function verifyOtpAndCreateSession(
  phoneInput: string,
  code: string,
  displayName?: string,
): Promise<AuthSession> {
  const phoneE164 = normalisePhone(phoneInput);
  const phoneHash = hashPhone(phoneE164);
  const phoneEncrypted = encryptPhone(phoneE164);

  try {
    checkOtpVerifyRate(phoneHash);
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new AppError('TOO_MANY_REQUESTS', err.message, 429, {
        retry_after_seconds: err.retryAfterSeconds,
      });
    }
    throw err;
  }

  const approved = await verifyTwilioCode(phoneE164, code);
  if (!approved) {
    throw new AppError('INVALID_CODE', 'Invalid OTP code', 400);
  }

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .eq('phone_hash', phoneHash)
    .maybeSingle();

  let userId: string;
  let isNewUser: boolean;
  let userDisplayName: string;
  let avatarColour: string;

  if (existingUser) {
    userId = existingUser.id;
    isNewUser = false;
    userDisplayName = existingUser.display_name;
    avatarColour = existingUser.avatar_colour;
  } else {
    const name = displayName?.trim();
    if (!name) {
      throw new AppError('NAME_REQUIRED', 'display_name is required for new users', 400);
    }

    userDisplayName = name;
    avatarColour = pickAvatarColour();
    isNewUser = true;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: { display_name: name },
    });

    if (authError || !authData.user) {
      throw new AppError('USER_CREATE_FAILED', authError?.message ?? 'Could not create user', 500);
    }

    userId = authData.user.id;

    let profileOk = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await ensurePublicUserRow(
          userId,
          phoneHash,
          phoneEncrypted,
          userDisplayName,
          avatarColour,
        );
        const { data: check } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
        if (check) {
          profileOk = true;
          break;
        }
      } catch {
        // retry once per E03-S02 spec
      }
    }

    if (!profileOk) {
      throw new AppError('AUTH_PROFILE_CREATION_FAILED', 'Could not create user profile', 500);
    }
  }

  const session = await createAdminSession(userId);

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    user: {
      id: userId,
      display_name: userDisplayName,
      avatar_colour: avatarColour,
      is_new_user: isNewUser,
    },
  };
}
