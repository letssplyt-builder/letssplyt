import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { encrypt } from '../../../infrastructure/security/crypto';
import { resolveParticipantPhone } from '../../../infrastructure/security/resolveParticipantPhone';

const PHONE_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

type GetUserByIdResult = {
  data: { user: { phone: string | null } | null };
  error: { message: string } | null;
};

const mockGetUserById = jest.fn<(id: string) => Promise<GetUserByIdResult>>();

jest.mock('../../../infrastructure/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: (id: string) => mockGetUserById(id),
      },
    },
  },
}));

describe('resolveParticipantPhone', () => {
  beforeEach(() => {
    process.env.PHONE_ENCRYPTION_KEY = PHONE_KEY;
    mockGetUserById.mockReset();
  });

  it('returns null for a name-only participant with no phone_encrypted and no user_id', async () => {
    const result = await resolveParticipantPhone({
      user_id: null,
      phone_encrypted: null,
    });
    expect(result).toBeNull();
  });

  it('decrypts guest phone_encrypted when user_id is null', async () => {
    const phone = '+15005550006';
    const phone_encrypted = encrypt(phone, PHONE_KEY);
    const result = await resolveParticipantPhone({
      user_id: null,
      phone_encrypted,
    });
    expect(result).toBe(phone);
  });

  it('returns phone from Supabase Auth for app members', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { phone: '+15005550002' } },
      error: null,
    });
    const result = await resolveParticipantPhone({
      user_id: 'user-123',
      phone_encrypted: null,
    });
    expect(result).toBe('+15005550002');
    expect(mockGetUserById).toHaveBeenCalledWith('user-123');
  });

  it('returns null when getUserById fails or has no phone', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { phone: null } }, error: null });
    expect(
      await resolveParticipantPhone({ user_id: 'user-123', phone_encrypted: null }),
    ).toBeNull();

    mockGetUserById.mockResolvedValue({ data: { user: null }, error: { message: 'not found' } });
    expect(
      await resolveParticipantPhone({ user_id: 'user-456', phone_encrypted: null }),
    ).toBeNull();
  });

  it('returns null when guest phone_encrypted cannot be decrypted (missing key)', async () => {
    delete process.env.PHONE_ENCRYPTION_KEY;
    const phone_encrypted = encrypt('+15005550006', PHONE_KEY);
    const result = await resolveParticipantPhone({
      user_id: null,
      phone_encrypted,
    });
    expect(result).toBeNull();
  });
});
