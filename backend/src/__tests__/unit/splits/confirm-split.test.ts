import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { confirmEventSplit } from '../../../modules/splits/splits.service';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const PARTICIPANT_A = 'part-a-1111-1111-1111-111111111111';

function pushEvent(status: string, messagesSentAt: string | null = null): void {
  mockSupabase.__pushMockResultForTable('events', {
    data: {
      id: EVENT_ID,
      payer_id: USER_A,
      title: 'Dinner',
      status,
      total_amount: 40,
      currency: 'USD',
      ai_stage: 'complete',
      locale: 'en-US',
      deleted_at: null,
      messages_sent_at: messagesSentAt,
    },
    error: null,
  });
}

describe('confirmEventSplit', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('allows confirm when event status is sent (post-send revision)', async () => {
    pushEvent('sent', '2026-01-01T00:00:00.000Z');
    mockSupabase.__pushMockResultForTable('participants', {
      data: [],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ id: PARTICIPANT_A, display_name: 'Jordan' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_A,
          amount_owed: 20,
          payment_status: 'pending',
          revision_count: 0,
          original_amount_owed: null,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const result = await confirmEventSplit(USER_A, EVENT_ID, {
      splits: [{ participant_id: PARTICIPANT_A, amount_owed: 40 }],
    });

    expect(result.confirmed).toBe(true);
    expect(result.event_status).toBe('sent');
    expect(result.ai_stage).toBe('complete');
  });

  it('rejects confirm when event status is open', async () => {
    pushEvent('open');

    await expect(
      confirmEventSplit(USER_A, EVENT_ID, {
        splits: [{ participant_id: PARTICIPANT_A, amount_owed: 40 }],
      }),
    ).rejects.toMatchObject({
      code: 'EVENT_NOT_LOCKED',
    });
  });
});
