import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { runGuestPiiPurge } from '../../../modules/jobs/purge-pii.job';

describe('runGuestPiiPurge', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('deletes guest_pii rows with purge_after in the past', async () => {
    mockSupabase.__setMockResultForTable('guest_pii', {
      data: [{ id: 'guest-1' }, { id: 'guest-2' }],
      error: null,
    });

    const result = await runGuestPiiPurge();

    expect(result.purged).toBe(2);
    expect(mockSupabase.from).toHaveBeenCalledWith('guest_pii');
    const chain = jest.mocked(mockSupabase.from).mock.results[0]?.value as {
      not: jest.Mock;
      lt: jest.Mock;
      limit: jest.Mock;
      select: jest.Mock;
    };
    expect(chain.not).toHaveBeenCalledWith('purge_after', 'is', null);
    expect(chain.lt).toHaveBeenCalledWith('purge_after', expect.any(String));
    expect(chain.limit).toHaveBeenCalledWith(500);
    expect(chain.select).toHaveBeenCalledWith('id');
  });

  it('respects batchSize', async () => {
    mockSupabase.__setMockResultForTable('guest_pii', {
      data: [{ id: 'guest-1' }],
      error: null,
    });

    await runGuestPiiPurge({ batchSize: 10 });

    const chain = jest.mocked(mockSupabase.from).mock.results[0]?.value as {
      limit: jest.Mock;
    };
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('throws when delete fails', async () => {
    mockSupabase.__setMockResultForTable('guest_pii', {
      data: null,
      error: { code: '500', message: 'delete failed' },
    });

    await expect(runGuestPiiPurge()).rejects.toMatchObject({
      code: 'GUEST_PII_PURGE_FAILED',
      statusCode: 500,
    });
  });
});
