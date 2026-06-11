import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { getIOwe, getOwedToMe } from '../../../modules/settlement/ledger.service';

jest.mock('../../../modules/profile/profile.service', () => ({
  getHandles: jest.fn(),
}));

import { getHandles } from '../../../modules/profile/profile.service';

const VIEWER_ID = 'viewer-ledger-1';
const MEMBER_ID = 'member-ledger-2';
const PAYER_ID = 'payer-ledger-3';
const EVENT_OWED = 'event-owed-1';
const EVENT_OWE = 'event-owe-1';

describe('ledger.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('owed-to-me: payer filter and excludes confirmed rows', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_OWED, title: 'Dinner', currency: 'USD' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'part-pending',
          event_id: EVENT_OWED,
          display_name: 'Alex',
          amount_owed: 25,
          payment_status: 'pending',
          confirmed_at: null,
        },
        {
          id: 'part-confirmed',
          event_id: EVENT_OWED,
          display_name: 'Sam',
          amount_owed: 10,
          payment_status: 'confirmed',
          confirmed_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'part-opted',
          event_id: EVENT_OWED,
          display_name: 'Opt',
          amount_owed: 5,
          payment_status: 'opted_out',
          confirmed_at: null,
        },
      ],
      error: null,
    });

    const result = await getOwedToMe(VIEWER_ID);

    expect(result.total_owed_minor_units).toBe(25);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].participant_id).toBe('part-pending');
    expect(result.currency).toBe('USD');
  });

  it('i-owe: decrypts payer handles and excludes self-payer events', async () => {
    jest.mocked(getHandles).mockResolvedValue([
      {
        id: 'handle-1',
        provider: 'venmo',
        handle_value: '@payer-venmo',
        display_order: 0,
      },
    ]);

    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          event_id: EVENT_OWE,
          amount_owed: 40,
          payment_status: 'pending',
        },
        {
          event_id: 'event-self-payer',
          amount_owed: 99,
          payment_status: 'pending',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [
        {
          id: EVENT_OWE,
          title: 'Lunch',
          currency: 'USD',
          payer_id: PAYER_ID,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: [{ id: PAYER_ID, display_name: 'Payer Pat' }],
      error: null,
    });

    const result = await getIOwe(VIEWER_ID);

    expect(result.total_owe_minor_units).toBe(40);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].payer_display_name).toBe('Payer Pat');
    expect(result.data[0].creator_payment_handles).toEqual([
      { provider: 'venmo', handle_display: '@payer-venmo' },
    ]);
    expect(getHandles).toHaveBeenCalledWith(PAYER_ID);
  });
});
