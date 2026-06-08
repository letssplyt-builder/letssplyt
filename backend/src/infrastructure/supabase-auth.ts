import { AppError } from './errors';

interface AdminSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Creates a Supabase session for an existing auth user via the Admin API.
 * docs/06-Integration-Contracts.md specifies auth.admin.createSession() which
 * is not yet exposed in @supabase/supabase-js types — this calls the REST endpoint directly.
 */
export async function createAdminSession(userId: string): Promise<AdminSession> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new AppError('CONFIG_ERROR', 'Supabase credentials not configured', 500);
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      'SESSION_CREATE_FAILED',
      `Could not create session: ${response.status} ${body}`,
      500,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
  };
}
