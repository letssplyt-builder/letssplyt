import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');

const authConfig = {
  persistSession: false,
  autoRefreshToken: false,
} as const;

/** Anon client — respects RLS. For server-side reads that use service patterns, prefer getSupabaseForUser. */
export const supabaseAnon: SupabaseClient = createClient(
  supabaseUrl,
  requireEnv('SUPABASE_PUBLISHABLE_KEY'),
  { auth: authConfig },
);

/**
 * @RESTRICTED USE ONLY. supabaseAdmin bypasses Row Level Security. Permitted uses:
 * (a) auth flows — creating and verifying users,
 * (b) background jobs and webhook handlers,
 * (c) analytics writes,
 * (d) cross-user writes like inserting a guest participant.
 * NEVER use supabaseAdmin in user-facing read endpoints.
 * If you are in a route handler reading data for the authenticated user, use getSupabaseForUser(jwt) instead.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  requireEnv('SUPABASE_SECRET_KEY'),
  { auth: authConfig },
);

/** Creates a per-request client scoped to the user's JWT — RLS applies correctly. */
export function getSupabaseForUser(jwt: string): SupabaseClient {
  return createClient(supabaseUrl, requireEnv('SUPABASE_PUBLISHABLE_KEY'), {
    auth: authConfig,
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}
