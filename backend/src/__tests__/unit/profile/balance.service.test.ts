import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { getUserBalance } from '../../../modules/profile/balance.service';

const USER_ID = 'user-balance-1';
const OTHER_USER_ID = 'user-balance-2';
const EVENT_CREATED = 'event-created-1';
const EVENT_JOINED = 'event-joined-1';

describe('balance.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('returns owed_to_you and you_owe totals', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_CREATED, currency: 'USD' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ amount_owed: 30 }, { amount_owed: 10 }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ amount_owed: 12, event_id: EVENT_JOINED }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_JOINED, payer_id: OTHER_USER_ID }],
      error: null,
    });

    const balance = await getUserBalance(USER_ID);

    expect(balance.owed_to_you).toBe(40);
    expect(balance.you_owe).toBe(12);
    expect(balance.net_balance).toBe(28);
    expect(balance.currency).toBe('USD');
  });

  it('includes pure guest obligations in owed_to_you (user_id IS NULL)', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_CREATED, currency: 'USD' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        { amount_owed: 25, user_id: OTHER_USER_ID },
        { amount_owed: 15, user_id: null },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });

    const balance = await getUserBalance(USER_ID);

    expect(balance.owed_to_you).toBe(40);
    expect(balance.you_owe).toBe(0);
    expect(balance.net_balance).toBe(40);
  });

  it('returns zeros when user has no outstanding amounts', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });

    const balance = await getUserBalance(USER_ID);

    expect(balance).toEqual({
      owed_to_you: 0,
      you_owe: 0,
      net_balance: 0,
      currency: 'USD',
    });
  });
});
