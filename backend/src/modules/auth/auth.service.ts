import { randomUUID } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError, RateLimitError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { encryptPhone, hashPhone } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { createAdminSession, internalEmailForUserId } from '../../infrastructure/supabase-auth';
import { twilioClient, getVerifyServiceSid } from '../../infrastructure/twilio';
import { checkOtpRequestRate, recordFailedOtpVerify } from '../../middleware/rateLimiter';
import { upgradeGuestParticipantsToUser } from '../participants/participant-link.service';
import { isOtpDevBypassEnabled } from './otp-dev-bypass';
import type { AuthSession, OtpRequestResponse } from '@letssplyt/shared/auth.types';

export { isOtpDevBypassEnabled } from './otp-dev-bypass';

export type OtpVerifyContext = 'login' | 'register' | 'join_event';

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

interface ResolvedUser {
  userId: string;
  isNewUser: boolean;
  userDisplayName: string;
  avatarColour: string;
}

const PLACEHOLDER_DISPLAY_NAME = 'LetsSplyt User';

function isDisplayNameMissing(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  return !trimmed || trimmed === PLACEHOLDER_DISPLAY_NAME;
}

async function applyRegistrationDisplayName(
  userId: string,
  displayName: string,
): Promise<string> {
  const trimmed = displayName.trim();
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ display_name: trimmed })
    .eq('id', userId)
    .select('display_name')
    .single();

  if (error || !data?.display_name) {
    logger.error({
      msg: 'Failed to update display_name after registration',
      userId,
      supabaseCode: error?.code,
      supabaseMessage: error?.message,
    });
    throw new AppError('PROFILE_UPDATE_FAILED', 'Could not save display name', 500);
  }

  void supabaseAdmin.auth.admin
    .updateUserById(userId, { user_metadata: { display_name: trimmed } })
    .catch((err: unknown) => {
      logger.warn({ msg: 'Failed to sync display_name to auth metadata', userId, err });
    });

  return data.display_name;
}

function normalisePhone(input: string): string {
  const parsed = parsePhoneNumberFromString(input);
  if (!parsed?.isValid()) {
    throw new AppError('INVALID_PHONE', 'Must be a valid E.164 phone number', 400);
  }
  return parsed.format('E.164');
}

export function normalisePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function phonesMatch(a: string, b: string): boolean {
  return normalisePhoneDigits(a) === normalisePhoneDigits(b);
}

function pickAvatarColour(): string {
  const index = Math.floor(Math.random() * AVATAR_COLOURS.length);
  return AVATAR_COLOURS[index] ?? '#4F46E5';
}

export async function sendOtp(
  phoneInput: string,
  channel: 'sms' | 'whatsapp' = 'sms',
  context?: 'login' | 'register',
): Promise<OtpRequestResponse> {
  const phoneE164 = normalisePhone(phoneInput);
  const phoneHash = hashPhone(phoneE164);
  const hasPublicProfile = (await loadPublicUserByPhoneHash(phoneHash)) !== null;

  // Login is allowed only when a public profile exists. Orphan auth-only rows → use Register.
  if (context === 'login' && !hasPublicProfile) {
    throw new AppError(
      'ACCOUNT_NOT_FOUND',
      'No account found. Check number and try again.',
      404,
    );
  }
  const accountExists = context === 'register' ? hasPublicProfile : undefined;

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
      msg: 'OTP dev bypass — Twilio send skipped (no SMS). Use any 6-digit code on the verify screen.',
      phoneHash,
    });
    return {
      sent: true,
      channel: 'sms',
      expires_in_seconds: 600,
      account_exists: accountExists,
    };
  }

  const verifySid = getVerifyServiceSid();
  try {
    const verification = await twilioClient.verify.v2
      .services(verifySid)
      .verifications.create({ to: phoneE164, channel });

    return {
      sent: true,
      channel: verification.channel as 'sms' | 'whatsapp',
      expires_in_seconds: 600,
      account_exists: accountExists,
    };
  } catch (err: unknown) {
    const twilioErr = err as { code?: number; message?: string };
    logger.error({
      msg: 'Twilio OTP send failed',
      twilioCode: twilioErr.code,
      phoneHash,
      hint:
        twilioErr.code === 20008
          ? 'Twilio Verify does not support test credentials. Use OTP dev bypass (default in development) or set TWILIO_USE_LIVE_VERIFY=true with live creds.'
          : undefined,
    });
    if (twilioErr.code === 60212) {
      const fallback = await twilioClient.verify.v2
        .services(verifySid)
        .verifications.create({ to: phoneE164, channel: 'sms' });
      return {
        sent: true,
        channel: fallback.channel as 'sms' | 'whatsapp',
        expires_in_seconds: 600,
        account_exists: accountExists,
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
  if (isOtpDevBypassEnabled()) {
    return /^[0-9]{6}$/.test(code);
  }

  try {
    const check = await twilioClient.verify.v2
      .services(getVerifyServiceSid())
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

export function isPhoneAlreadyRegisteredError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('phone number is already')
  );
}

export async function findAuthUserIdByPhone(phoneE164: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) break;

    const match = data.users.find(
      (user) => user.phone && phonesMatch(user.phone, phoneE164),
    );
    if (match) return match.id;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

interface PublicUserProfile {
  display_name: string;
  avatar_colour: string;
}

async function loadPublicUserProfileById(userId: string): Promise<PublicUserProfile | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('display_name, avatar_colour')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

async function upsertPublicUserProfile(
  userId: string,
  phoneHash: string,
  phoneEncrypted: string,
  displayName: string,
  avatarColour: string,
): Promise<PublicUserProfile> {
  const existingById = await loadPublicUserProfileById(userId);
  if (existingById && !isDisplayNameMissing(existingById.display_name)) {
    return existingById;
  }

  const { data: existingByPhone } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .eq('phone_hash', phoneHash)
    .maybeSingle();

  if (existingByPhone) {
    if (existingByPhone.id === userId) {
      if (!isDisplayNameMissing(existingByPhone.display_name)) {
        return {
          display_name: existingByPhone.display_name,
          avatar_colour: existingByPhone.avatar_colour,
        };
      }
    } else {
      logger.error({
        msg: 'phone_hash already linked to a different user id',
        authUserId: userId,
        publicUserId: existingByPhone.id,
      });
      throw new AppError('AUTH_PROFILE_CREATION_FAILED', 'Could not create user profile', 500);
    }
  }

  const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc(
    'upsert_user_profile_on_auth',
    {
      p_user_id: userId,
      p_phone_hash: phoneHash,
      p_phone_encrypted: phoneEncrypted,
      p_display_name: displayName,
      p_avatar_colour: avatarColour,
    },
  );

  const rpcProfile = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!rpcError && rpcProfile?.display_name) {
    return {
      display_name: rpcProfile.display_name,
      avatar_colour: rpcProfile.avatar_colour,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        id: userId,
        phone_hash: phoneHash,
        phone_encrypted: phoneEncrypted,
        display_name: displayName,
        avatar_colour: avatarColour,
      },
      { onConflict: 'id' },
    )
    .select('display_name, avatar_colour')
    .single();

  if (!error && data) {
    return data;
  }

  const upsertError = rpcError ?? error;

  const retried = await loadPublicUserProfileById(userId);
  if (retried) return retried;

  logger.error({
    msg: 'Failed to upsert public.users profile',
    userId,
    supabaseCode: upsertError?.code,
    supabaseMessage: upsertError?.message,
    supabaseDetails: upsertError?.details,
    hint: 'Apply supabase/migrations/20260608000000_users_auth_registration.sql if RPC is missing.',
  });
  throw new AppError('AUTH_PROFILE_CREATION_FAILED', 'Could not create user profile', 500);
}

async function loadPublicUserByPhoneHash(phoneHash: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .eq('phone_hash', phoneHash)
    .maybeSingle();
  return data;
}

export async function accountExistsForPhone(phoneInput: string): Promise<boolean> {
  const phoneE164 = normalisePhone(phoneInput);
  const phoneHash = hashPhone(phoneE164);
  const publicUser = await loadPublicUserByPhoneHash(phoneHash);
  if (publicUser) return true;
  const authUserId = await findAuthUserIdByPhone(phoneE164);
  return authUserId !== null;
}

async function loadPublicUserById(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

async function resolveDisplayNameForAuthUser(
  authUserId: string,
  displayName?: string,
): Promise<string> {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;

  const { data } = await supabaseAdmin.auth.admin.getUserById(authUserId);
  const metadataName = data.user?.user_metadata?.display_name;
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }

  return PLACEHOLDER_DISPLAY_NAME;
}

async function repairPublicProfile(
  userId: string,
  phoneHash: string,
  phoneEncrypted: string,
  displayName: string,
): Promise<{ userDisplayName: string; avatarColour: string }> {
  const avatarColour = pickAvatarColour();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const profile = await upsertPublicUserProfile(
        userId,
        phoneHash,
        phoneEncrypted,
        displayName,
        avatarColour,
      );
      return {
        userDisplayName: profile.display_name,
        avatarColour: profile.avatar_colour,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof AppError && err.code === 'AUTH_PROFILE_CREATION_FAILED') {
        throw err;
      }
    }
  }

  logger.error({ msg: 'repairPublicProfile exhausted retries', userId, err: lastError });
  throw new AppError('AUTH_PROFILE_CREATION_FAILED', 'Could not create user profile', 500);
}

async function resolveExistingAuthUser(
  authUserId: string,
  phoneHash: string,
  phoneEncrypted: string,
  displayName?: string,
): Promise<ResolvedUser> {
  const profile = await loadPublicUserById(authUserId);
  if (profile) {
    return {
      userId: profile.id,
      isNewUser: false,
      userDisplayName: profile.display_name,
      avatarColour: profile.avatar_colour,
    };
  }

  const resolvedName = await resolveDisplayNameForAuthUser(authUserId, displayName);
  const repaired = await repairPublicProfile(
    authUserId,
    phoneHash,
    phoneEncrypted,
    resolvedName,
  );

  return {
    userId: authUserId,
    isNewUser: false,
    userDisplayName: repaired.userDisplayName,
    avatarColour: repaired.avatarColour,
  };
}

async function createNewUser(
  phoneE164: string,
  phoneHash: string,
  phoneEncrypted: string,
  displayName: string,
): Promise<ResolvedUser> {
  const userDisplayName = displayName.trim();
  const avatarColour = pickAvatarColour();
  const userId = randomUUID();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    id: userId,
    phone: phoneE164,
    phone_confirm: true,
    email: internalEmailForUserId(userId),
    email_confirm: true,
    user_metadata: { display_name: userDisplayName },
  });

  if (authError || !authData.user) {
    const authMessage = authError?.message ?? 'Could not create user';
    if (isPhoneAlreadyRegisteredError(authMessage)) {
      const existingAuthId = await findAuthUserIdByPhone(phoneE164);
      if (!existingAuthId) {
        throw new AppError(
          'USER_CREATE_FAILED',
          'This phone number is already registered. Try signing in instead.',
          409,
        );
      }
      return resolveExistingAuthUser(
        existingAuthId,
        phoneHash,
        phoneEncrypted,
        userDisplayName,
      );
    }
    throw new AppError('USER_CREATE_FAILED', authMessage, 500);
  }

  const profile = await upsertPublicUserProfile(
    authData.user.id,
    phoneHash,
    phoneEncrypted,
    userDisplayName,
    avatarColour,
  );

  return {
    userId: authData.user.id,
    isNewUser: true,
    userDisplayName: profile.display_name,
    avatarColour: profile.avatar_colour,
  };
}

export async function resolveUserAfterOtp(
  phoneE164: string,
  phoneHash: string,
  phoneEncrypted: string,
  displayName?: string,
  context: OtpVerifyContext = 'register',
): Promise<ResolvedUser> {
  let resolved: ResolvedUser;

  const publicUser = await loadPublicUserByPhoneHash(phoneHash);
  if (publicUser?.id) {
    resolved = {
      userId: publicUser.id,
      isNewUser: false,
      userDisplayName: publicUser.display_name,
      avatarColour: publicUser.avatar_colour,
    };
  } else {
    const authUserId = await findAuthUserIdByPhone(phoneE164);
    if (authUserId) {
      resolved = await resolveExistingAuthUser(authUserId, phoneHash, phoneEncrypted, displayName);
    } else if (context === 'login') {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        'No account found. Check number and try again.',
        404,
      );
    } else {
      const name = displayName?.trim();
      if (!name) {
        throw new AppError('NAME_REQUIRED', 'display_name is required for new users', 400);
      }
      resolved = await createNewUser(phoneE164, phoneHash, phoneEncrypted, name);
    }
  }

  if (
    context === 'register' &&
    displayName?.trim() &&
    isDisplayNameMissing(resolved.userDisplayName)
  ) {
    const updatedName = await applyRegistrationDisplayName(resolved.userId, displayName);
    resolved = { ...resolved, userDisplayName: updatedName };
  }

  await upgradeGuestParticipantsToUser(phoneHash, resolved.userId);
  return resolved;
}

export async function verifyOtpAndCreateSession(
  phoneInput: string,
  code: string,
  displayName?: string,
  context: OtpVerifyContext = 'register',
): Promise<AuthSession> {
  const phoneE164 = normalisePhone(phoneInput);
  const phoneHash = hashPhone(phoneE164);
  const phoneEncrypted = encryptPhone(phoneE164);

  const approved = await verifyTwilioCode(phoneE164, code);
  if (!approved) {
    try {
      recordFailedOtpVerify(phoneHash);
    } catch (err) {
      if (err instanceof RateLimitError) {
        throw new AppError('TOO_MANY_REQUESTS', err.message, 429, {
          retry_after_seconds: err.retryAfterSeconds,
        });
      }
      throw err;
    }
    throw new AppError('INVALID_CODE', 'Invalid OTP code', 400);
  }

  const resolved = await resolveUserAfterOtp(
    phoneE164,
    phoneHash,
    phoneEncrypted,
    displayName,
    context,
  );

  const session = await createAdminSession(resolved.userId);

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    user: {
      id: resolved.userId,
      display_name: resolved.userDisplayName,
      avatar_colour: resolved.avatarColour,
      is_new_user: resolved.isNewUser,
    },
  };
}
