import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';
import * as security from '../../../infrastructure/security';

const PAYER_ID = 'ledger-payer-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_ID = 'ledger-member-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_A = 'ledger-event-1111-1111-1111-111111111111';
const EVENT_B = 'ledger-event-2222-2222-2222-222222222222';
const AUTH_PAYER = { Authorization: 'Bearer mock-token-payer' };
const AUTH_MEMBER = { Authorization: 'Bearer mock-token-member' };

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

describe('Settlement ledger API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('GET /settlement/owed-to-me returns outstanding payer rows only', async () => {
    mockAuth(PAYER_ID);
    mockSupabase.__pushMockResultForTable('events', {
      data: [
        { id: EVENT_A, title: 'Dinner A', currency: 'USD' },
        { id: EVENT_B, title: 'Dinner B', currency: 'USD' },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'part-a',
          event_id: EVENT_A,
          display_name: 'Jordan',
          amount_owed: 30,
          payment_status: 'pending',
          confirmed_at: null,
        },
        {
          id: 'part-b',
          event_id: EVENT_B,
          display_name: 'Jordan',
          amount_owed: 20,
          payment_status: 'self_reported',
          confirmed_at: null,
        },
      ],
      error: null,
    });

    const response = await request(app)
      .get('/api/v1/settlement/owed-to-me')
      .set(AUTH_PAYER);

    expect(response.status).toBe(200);
    expect(response.body.total_owed_minor_units).toBe(50);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).not.toHaveProperty('phone_hash');
  });

  it('GET /settlement/i-owe decrypts payer handles', async () => {
    jest.spyOn(security, 'decryptHandle').mockReturnValue('@ledger-payer');

    mockAuth(MEMBER_ID);
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ event_id: EVENT_A, amount_owed: 35, payment_status: 'pending' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [
        {
          id: EVENT_A,
          title: 'Dinner',
          currency: 'USD',
          payer_id: PAYER_ID,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: [{ id: PAYER_ID, display_name: 'Alex' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('user_payment_handles', {
      data: [
        {
          id: 'handle-1',
          provider: 'venmo',
          handle_encrypted: 'enc-blob',
          display_order: 0,
        },
      ],
      error: null,
    });

    const response = await request(app)
      .get('/api/v1/settlement/i-owe')
      .set(AUTH_MEMBER);

    expect(response.status).toBe(200);
    expect(response.body.total_owe_minor_units).toBe(35);
    expect(response.body.data[0].creator_payment_handles).toEqual([
      { provider: 'venmo', handle_display: '@ledger-payer' },
    ]);
    expect(response.body.data[0]).not.toHaveProperty('phone_hash');
  });

  it('GET /settlement/person/:userId aliases member detail', async () => {
    mockAuth(PAYER_ID);
    mockSupabase.__pushMockResultForTable('users', {
      data: {
        id: MEMBER_ID,
        display_name: 'Jordan',
        avatar_colour: '#6366F1',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });

    const memberRoute = await request(app)
      .get(`/api/v1/settlement/member/${MEMBER_ID}`)
      .set(AUTH_PAYER);

    mockAuth(PAYER_ID);
    mockSupabase.__pushMockResultForTable('users', {
      data: {
        id: MEMBER_ID,
        display_name: 'Jordan',
        avatar_colour: '#6366F1',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });

    const personRoute = await request(app)
      .get(`/api/v1/settlement/person/${MEMBER_ID}`)
      .set(AUTH_PAYER);

    expect(personRoute.status).toBe(200);
    expect(personRoute.body.counterparty.user_id).toBe(MEMBER_ID);
    expect(personRoute.body.counterparty).toEqual(memberRoute.body.counterparty);
  });
});
