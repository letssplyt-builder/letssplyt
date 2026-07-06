import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SignJWT } from 'jose';
import {
  SupabaseJwtError,
  resetSupabaseJwtCacheForTests,
  verifyAccessTokenViaSupabaseAuth,
  verifySupabaseAccessToken,
} from '../../../infrastructure/supabase-jwt';

jest.unmock('../../../infrastructure/supabase-jwt');

const TEST_JWT_SECRET = '0123456789abcdef'.repeat(4);
const TEST_SUPABASE_URL = 'https://test.supabase.co';

async function signHs256AccessToken(input: {
  sub: string;
  email?: string;
  expiresIn?: string;
}): Promise<string> {
  return new SignJWT({ email: input.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(input.expiresIn ?? '2h')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));
}

describe('verifySupabaseAccessToken', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = TEST_SUPABASE_URL;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    resetSupabaseJwtCacheForTests();
  });

  it('verifies a valid HS256 Supabase access token locally', async () => {
    const token = await signHs256AccessToken({
      sub: 'user-11111111-1111-1111-1111-111111111111',
      email: 'user@test.local',
    });

    const verified = await verifySupabaseAccessToken(token);

    expect(verified).toEqual({
      userId: 'user-11111111-1111-1111-1111-111111111111',
      email: 'user@test.local',
    });
  });

  it('rejects expired tokens', async () => {
    const token = await signHs256AccessToken({
      sub: 'user-expired',
      expiresIn: '-1s',
    });

    await expect(verifySupabaseAccessToken(token)).rejects.toBeInstanceOf(SupabaseJwtError);
  });

  it('rejects malformed tokens', async () => {
    await expect(verifySupabaseAccessToken('not-a-jwt')).rejects.toBeInstanceOf(SupabaseJwtError);
  });
});

describe('verifyAccessTokenViaSupabaseAuth', () => {
  it('delegates to Supabase auth.getUser for revocation-aware checks', async () => {
    const { supabaseAnon } = await import('../../../infrastructure/supabase');
    jest.spyOn(supabaseAnon.auth, 'getUser').mockResolvedValueOnce({
      data: { user: { id: 'user-live', email: 'live@test.local' } },
      error: null,
    } as never);

    const verified = await verifyAccessTokenViaSupabaseAuth('live-token');

    expect(verified).toEqual({ userId: 'user-live', email: 'live@test.local' });
    expect(supabaseAnon.auth.getUser).toHaveBeenCalledWith('live-token');
  });
});
