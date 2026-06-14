import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { runAnalyticsPartitionCreation } from '../../../modules/jobs/partition.job';

describe('runAnalyticsPartitionCreation', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates partition for next month by default', async () => {
    const result = await runAnalyticsPartitionCreation();

    expect(result.partition).toBe('analytics_events_2026_07');
    expect(result.startDate).toBe('2026-07-01');
    expect(result.endDate).toBe('2026-08-01');
    expect(result.created).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_analytics_partition', {
      partition_name: 'analytics_events_2026_07',
      start_date: '2026-07-01',
      end_date: '2026-08-01',
    });
  });

  it('creates partition for explicit year and month', async () => {
    const result = await runAnalyticsPartitionCreation({ year: 2026, month: 10 });

    expect(result.partition).toBe('analytics_events_2026_10');
    expect(result.startDate).toBe('2026-10-01');
    expect(result.endDate).toBe('2026-11-01');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_analytics_partition', {
      partition_name: 'analytics_events_2026_10',
      start_date: '2026-10-01',
      end_date: '2026-11-01',
    });
  });

  it('throws when RPC fails', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '500', message: 'rpc failed' },
    });

    await expect(runAnalyticsPartitionCreation()).rejects.toMatchObject({
      code: 'ANALYTICS_PARTITION_FAILED',
      statusCode: 500,
    });
  });

  it('rejects invalid month', async () => {
    await expect(
      runAnalyticsPartitionCreation({ year: 2026, month: 13 }),
    ).rejects.toMatchObject({
      code: 'INVALID_PARTITION_MONTH',
      statusCode: 400,
    });
  });
});
