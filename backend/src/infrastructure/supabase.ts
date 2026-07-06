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

/**
 * Supabase clients for the LetsSplyt API layer.
 *
 * **Authorization model (ADR PA-11):** Express handlers use `supabaseAdmin` (service role)
 * and enforce access in application code — primarily `requireEventAccess` route middleware
 * plus service-layer asserts. PostgreSQL RLS remains enabled for Realtime and direct
 * PostgREST access (defense-in-depth), but is not the primary gate for API routes.
 *
 * @see docs/adr/PA-11-rls-and-route-authz.md
 */

/** Anon client — user-scoped RLS flows via `getSupabaseForUser`; route auth uses local JWT verification. */
export const supabaseAnon: SupabaseClient = createClient(
  supabaseUrl,
  requireEnv('SUPABASE_PUBLISHABLE_KEY'),
  { auth: authConfig },
);

/**
 * Service-role client — bypasses RLS. Standard for Express route handlers, jobs, and webhooks.
 * User-scoped access is enforced via `requireEventAccess` middleware and service asserts.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  requireEnv('SUPABASE_SECRET_KEY'),
  { auth: authConfig },
);

/** Per-request client scoped to a user JWT — RLS applies. Used for profile reads today; optional for future read migration. */
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
