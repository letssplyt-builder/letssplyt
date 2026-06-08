import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';

jest.mock('../../../infrastructure/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import {
  createAdminSession,
  ensureInternalEmail,
  internalEmailForUserId,
} from '../../../infrastructure/supabase-auth';

describe('supabase-auth', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  describe('internalEmailForUserId', () => {
    it('returns stable internal email for a user id', () => {
      expect(internalEmailForUserId('abc-123')).toBe('abc-123@letssplyt.internal');
    });
  });

  describe('ensureInternalEmail', () => {
    it('returns existing email when user already has one', async () => {
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'existing@example.com' } },
        error: null,
      });

      await expect(ensureInternalEmail('user-1')).resolves.toBe('existing@example.com');
      expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
    });

    it('sets internal email when user has no email', async () => {
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-2' } },
        error: null,
      });

      await expect(ensureInternalEmail('user-2')).resolves.toBe('user-2@letssplyt.internal');
      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-2', {
        email: 'user-2@letssplyt.internal',
        email_confirm: true,
      });
    });
  });

  describe('createAdminSession', () => {
    it('uses generateLink + verifyOtp instead of admin sessions REST', async () => {
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-3', email: 'user-3@letssplyt.internal' } },
        error: null,
      });

      const session = await createAdminSession('user-3');

      expect(mockSupabase.auth.admin.generateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email: 'user-3@letssplyt.internal',
      });
      expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'test-token-hash',
        type: 'email',
      });
      expect(session).toEqual({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
      });
    });
  });
});
