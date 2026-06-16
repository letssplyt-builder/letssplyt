import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  hashAnalyticsUserId,
  recordAnalyticsEvents,
  validateAnalyticsEvents,
} from '../../../modules/analytics/analytics.service';

describe('analytics.service', () => {
  const userId = 'a1111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
    mockSupabase.__setMockResultForTable('analytics_events', { data: null, error: null });
  });

  it('hashes user id with ANALYTICS_SALT before writing', async () => {
    const ts = Date.UTC(2026, 5, 15, 12, 0, 0);
    await recordAnalyticsEvents(
      [{ name: 'event_created', properties: { event_id: 'e1' }, timestamp: ts }],
      { userId },
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
    const insertChain = jest.mocked(mockSupabase.from).mock.results[0]?.value as {
      insert: jest.Mock;
    };
    const rows = insertChain.insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(rows[0].user_id).toBeNull();
    expect(rows[0].anonymous_id).toBe(hashAnalyticsUserId(userId));
    expect(rows[0].anonymous_id).not.toBe(userId);
  });

  it('rejects unknown event names', () => {
    expect(() =>
      validateAnalyticsEvents([
        { name: 'not_a_real_event' as 'event_created', properties: {}, timestamp: Date.now() },
      ]),
    ).toThrow(/Unknown analytics event/);
  });

  it('writes to correct analytics partition via client timestamp', async () => {
    const ts = Date.UTC(2026, 6, 10, 8, 0, 0);
    await recordAnalyticsEvents(
      [{ name: 'messages_sent', properties: {}, timestamp: ts }],
      { userId },
    );

    const insertChain = jest.mocked(mockSupabase.from).mock.results[0]?.value as {
      insert: jest.Mock;
    };
    const rows = insertChain.insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(rows[0].created_at).toBe(new Date(ts).toISOString());
    expect(String(rows[0].created_at)).toContain('2026-07');
  });

  it('batches multiple events in single insert', async () => {
    const ts = Date.now();
    const count = await recordAnalyticsEvents(
      [
        { name: 'event_created', properties: {}, timestamp: ts },
        { name: 'event_locked', properties: {}, timestamp: ts + 1 },
      ],
      { userId },
    );

    expect(count).toBe(2);
    const insertChain = jest.mocked(mockSupabase.from).mock.results[0]?.value as {
      insert: jest.Mock;
    };
    const rows = insertChain.insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
  });
});
