import { AppError } from './errors';
import { supabaseAdmin } from './supabase';

interface AdminSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const INTERNAL_EMAIL_DOMAIN = 'letssplyt.internal';

export function internalEmailForUserId(userId: string): string {
  return `${userId}@${INTERNAL_EMAIL_DOMAIN}`;
}

/**
 * Phone-only Supabase users need a stable internal email for generateLink-based sessions.
 * The email is never exposed to clients — used only for admin session creation.
 */
export async function ensureInternalEmail(userId: string): Promise<string> {
  const fallbackEmail = internalEmailForUserId(userId);
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new AppError('SESSION_CREATE_FAILED', error?.message ?? 'User not found', 500);
  }

  if (data.user.email) {
    return data.user.email;
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: fallbackEmail,
    email_confirm: true,
  });

  if (updateError) {
    throw new AppError('SESSION_CREATE_FAILED', updateError.message, 500);
  }

  return fallbackEmail;
}

/**
 * Creates a Supabase session for an existing auth user.
 * Uses admin generateLink + verifyOtp — the REST /sessions endpoint returns 404.
 */
export async function createAdminSession(userId: string): Promise<AdminSession> {
  const email = await ensureInternalEmail(userId);

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    throw new AppError(
      'SESSION_CREATE_FAILED',
      linkError?.message ?? 'Failed to generate auth link',
      500,
    );
  }

  const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'email',
  });

  if (verifyError || !verifyData.session) {
    throw new AppError(
      'SESSION_CREATE_FAILED',
      verifyError?.message ?? 'Failed to create session',
      500,
    );
  }

  return {
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
    expires_in: verifyData.session.expires_in ?? 3600,
  };
}
