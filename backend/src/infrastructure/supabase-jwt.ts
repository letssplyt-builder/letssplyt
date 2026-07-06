import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const SUPABASE_URL = process.env.SUPABASE_URL;

export class SupabaseJwtError extends Error {
  readonly code = 'AUTH_REQUIRED' as const;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'SupabaseJwtError';
  }
}

export interface VerifiedAccessToken {
  userId: string;
  email?: string;
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getSupabaseUrl(): string {
  if (!SUPABASE_URL?.trim()) {
    throw new Error('SUPABASE_URL is not set');
  }
  return SUPABASE_URL.replace(/\/$/, '');
}

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(`${getSupabaseUrl()}/auth/v1/.well-known/jwks.json`));
  }
  return cachedJwks;
}

function payloadToVerifiedUser(payload: JWTPayload): VerifiedAccessToken {
  const userId = payload.sub;
  if (!userId || typeof userId !== 'string') {
    throw new SupabaseJwtError();
  }

  const email = typeof payload.email === 'string' ? payload.email : undefined;
  return { userId, email };
}

async function verifyWithHs256Secret(token: string): Promise<VerifiedAccessToken> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new SupabaseJwtError();
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: `${getSupabaseUrl()}/auth/v1`,
      audience: 'authenticated',
    });
    return payloadToVerifiedUser(payload);
  } catch {
    throw new SupabaseJwtError();
  }
}

/** Verify Supabase access JWT locally via JWKS (with HS256 fallback when JWT_SECRET is set). */
export async function verifySupabaseAccessToken(token: string): Promise<VerifiedAccessToken> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${getSupabaseUrl()}/auth/v1`,
      audience: 'authenticated',
    });
    return payloadToVerifiedUser(payload);
  } catch {
    return verifyWithHs256Secret(token);
  }
}

/** Revocation-aware verification — use for sensitive account operations only. */
export async function verifyAccessTokenViaSupabaseAuth(
  token: string,
): Promise<VerifiedAccessToken> {
  const { supabaseAnon } = await import('./supabase');
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new SupabaseJwtError();
  }
  return { userId: data.user.id, email: data.user.email ?? undefined };
}

export function resetSupabaseJwtCacheForTests(): void {
  cachedJwks = null;
}
