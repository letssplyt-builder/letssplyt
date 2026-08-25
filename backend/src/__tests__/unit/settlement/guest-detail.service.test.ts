import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { getGuestDetail } from '../../../modules/settlement/guest-detail.service';

const VIEWER_ID = 'viewer-1';
const EVENT_ID = 'event-1';

describe('guest-detail.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('sets can_nudge false for name-only guests', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID, title: 'Lunch', created_at: '2026-08-01T12:00:00.000Z' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'part-1',
          event_id: EVENT_ID,
          display_name: 'Chris',
          amount_owed: 18,
          payment_status: 'pending',
          guest_pii_token: 'pii-1',
          last_nudged_at: null,
          join_method: 'manual_name_only',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('guest_pii', {
      data: [{ id: 'pii-1', phone_hash: 'hash-1' }],
      error: null,
    });

    const result = await getGuestDetail(VIEWER_ID, 'hash-1');

    expect(result.outstanding).toEqual([
      expect.objectContaining({
        participant_id: 'part-1',
        can_nudge: false,
      }),
    ]);
  });

  it('sets can_nudge true for guests with a phone who are not in cooldown', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID, title: 'Lunch', created_at: '2026-08-01T12:00:00.000Z' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'part-1',
          event_id: EVENT_ID,
          display_name: 'Sam',
          amount_owed: 18,
          payment_status: 'pending',
          guest_pii_token: 'pii-1',
          last_nudged_at: null,
          join_method: 'qr_web',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('guest_pii', {
      data: [{ id: 'pii-1', phone_hash: 'hash-1' }],
      error: null,
    });

    const result = await getGuestDetail(VIEWER_ID, 'hash-1');

    expect(result.outstanding).toEqual([
      expect.objectContaining({
        participant_id: 'part-1',
        can_nudge: true,
      }),
    ]);
  });
});
