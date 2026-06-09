import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { upgradeGuestParticipantsToUser } from '../../../modules/participants/participant-link.service';

describe('participant-link.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('links guest participants to user by phone hash', async () => {
    mockSupabase.__pushMockResultForTable('guest_pii', {
      data: [{ id: 'guest-1' }, { id: 'guest-2' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });

    await upgradeGuestParticipantsToUser('abc123hash', 'user-99');

    const updateCalls = mockSupabase.from.mock.results
      .map((r) => (r.type === 'return' ? r.value : null))
      .flatMap((chain) => {
        if (!chain) return [];
        return (chain as { update: jest.Mock }).update.mock.calls;
      });

    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(updateCalls[0]?.[0]).toMatchObject({
      user_id: 'user-99',
      guest_pii_token: null,
    });
  });

  it('no-ops when no guest_pii rows exist', async () => {
    mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });

    await expect(
      upgradeGuestParticipantsToUser('abc123hash', 'user-99'),
    ).resolves.toBeUndefined();
  });
});
