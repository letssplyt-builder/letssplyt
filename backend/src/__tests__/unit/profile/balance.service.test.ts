import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { getUserBalance } from '../../../modules/profile/balance.service';

const USER_ID = 'user-balance-1';
const OTHER_USER_ID = 'user-balance-2';
const EVENT_CREATED = 'event-created-1';
const EVENT_JOINED = 'event-joined-1';

function pushMemberBalanceMocks(options: {
  createdEvents: Array<{ id: string; currency?: string }>;
  owedOnCreated: Array<{ user_id: string; amount_owed: number; payment_status?: string }>;
  viewerParticipations: Array<{ amount_owed: number; event_id: string; payment_status?: string }>;
  joinedEventPayers: Array<{ id: string; payer_id: string }>;
  guestOutstanding?: Array<{ amount_owed: number; payment_status?: string }>;
}): void {
  const currency = options.createdEvents[0]?.currency ?? 'USD';

  mockSupabase.__pushMockResultForTable('events', {
    data: options.createdEvents.map((event) => ({ ...event, currency })),
    error: null,
  });
  mockSupabase.__pushMockResultForTable('events', {
    data: options.createdEvents.map((event) => ({ id: event.id })),
    error: null,
  });
  mockSupabase.__pushMockResultForTable('participants', {
    data: options.owedOnCreated.map((row) => ({
      payment_status: 'pending',
      ...row,
    })),
    error: null,
  });
  mockSupabase.__pushMockResultForTable('participants', {
    data: options.viewerParticipations.map((row) => ({
      payment_status: 'pending',
      ...row,
    })),
    error: null,
  });
  if (options.viewerParticipations.length > 0) {
    mockSupabase.__pushMockResultForTable('events', {
      data: options.joinedEventPayers,
      error: null,
    });
  }
  mockSupabase.__pushMockResultForTable('events', {
    data: options.createdEvents.map((event) => ({ id: event.id })),
    error: null,
  });
  mockSupabase.__pushMockResultForTable('participants', {
    data: (options.guestOutstanding ?? []).map((row) => ({
      payment_status: 'pending',
      ...row,
    })),
    error: null,
  });
}

describe('balance.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('nets reciprocal member balances into hero totals', async () => {
    pushMemberBalanceMocks({
      createdEvents: [{ id: EVENT_CREATED, currency: 'USD' }],
      owedOnCreated: [{ user_id: OTHER_USER_ID, amount_owed: 30 }],
      viewerParticipations: [{ amount_owed: 10, event_id: EVENT_JOINED }],
      joinedEventPayers: [{ id: EVENT_JOINED, payer_id: OTHER_USER_ID }],
    });

    const balance = await getUserBalance(USER_ID);

    expect(balance.owed_to_you).toBe(20);
    expect(balance.you_owe).toBe(0);
    expect(balance.net_balance).toBe(20);
    expect(balance.currency).toBe('USD');
  });

  it('shows net you_owe when viewer owes a member more than they owe back', async () => {
    pushMemberBalanceMocks({
      createdEvents: [{ id: EVENT_CREATED, currency: 'USD' }],
      owedOnCreated: [{ user_id: OTHER_USER_ID, amount_owed: 57.33 }],
      viewerParticipations: [{ amount_owed: 60, event_id: EVENT_JOINED }],
      joinedEventPayers: [{ id: EVENT_JOINED, payer_id: OTHER_USER_ID }],
    });

    const balance = await getUserBalance(USER_ID);

    expect(balance.owed_to_you).toBe(0);
    expect(balance.you_owe).toBe(2.67);
    expect(balance.net_balance).toBe(-2.67);
  });

  it('includes pure guest obligations in owed_to_you (user_id IS NULL)', async () => {
    pushMemberBalanceMocks({
      createdEvents: [{ id: EVENT_CREATED, currency: 'USD' }],
      owedOnCreated: [{ user_id: OTHER_USER_ID, amount_owed: 25 }],
      viewerParticipations: [],
      joinedEventPayers: [],
      guestOutstanding: [{ amount_owed: 15 }],
    });

    const balance = await getUserBalance(USER_ID);

    expect(balance.owed_to_you).toBe(40);
    expect(balance.you_owe).toBe(0);
    expect(balance.net_balance).toBe(40);
  });

  it('returns zeros when user has no outstanding amounts', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
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
