import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  getGuestCounterparties,
  getMemberCounterparties,
} from '../../../modules/settlement/counterparties.service';

const VIEWER_ID = 'viewer-1';
const MEMBER_ID = 'member-2';
const EVENT_CREATED = 'event-created-1';
const EVENT_JOINED = 'event-joined-1';

describe('counterparties.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('nets member amounts into owe_you and you_owe', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_CREATED }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          user_id: MEMBER_ID,
          amount_owed: 30,
          payment_status: 'pending',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ amount_owed: 10, event_id: EVENT_JOINED, payment_status: 'pending' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_JOINED, payer_id: MEMBER_ID }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: [
        {
          id: MEMBER_ID,
          display_name: 'Alex',
          avatar_colour: '#4F46E5',
        },
      ],
      error: null,
    });

    const result = await getMemberCounterparties(VIEWER_ID);

    expect(result.owe_you).toEqual([
      {
        user_id: MEMBER_ID,
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        net_amount: 20,
      },
    ]);
    expect(result.you_owe).toEqual([]);
  });

  it('aggregates phone guests by phone_hash', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_CREATED }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'part-1',
          event_id: EVENT_CREATED,
          display_name: 'Sam Guest',
          amount_owed: 15,
          payment_status: 'pending',
          guest_pii_token: 'pii-1',
          join_method: 'manual_phone',
        },
        {
          id: 'part-2',
          event_id: EVENT_CREATED,
          display_name: 'Sam Guest',
          amount_owed: 10,
          payment_status: 'pending',
          guest_pii_token: 'pii-2',
          join_method: 'manual_phone',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('guest_pii', {
      data: [
        { id: 'pii-1', phone_hash: 'hash-sam' },
        { id: 'pii-2', phone_hash: 'hash-sam' },
      ],
      error: null,
    });

    const result = await getGuestCounterparties(VIEWER_ID);

    expect(result.guests).toEqual([
      {
        guest_key: 'hash-sam',
        kind: 'phone',
        display_name: 'Sam Guest',
        amount: 25,
      },
    ]);
  });
});
