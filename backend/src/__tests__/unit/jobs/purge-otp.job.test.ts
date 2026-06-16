import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';

jest.mock('../../../infrastructure/otp/otp.service', () => ({
  purgeExpiredOTPs: jest.fn(() => Promise.resolve(5)),
}));

import { purgeExpiredOTPs } from '../../../infrastructure/otp/otp.service';
import { runExpiredOtpPurge } from '../../../modules/jobs/purge-otp.job';

describe('runExpiredOtpPurge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
  });

  it('returns ok and deleted count from purgeExpiredOTPs', async () => {
    const result = await runExpiredOtpPurge();

    expect(result).toEqual({ ok: true, deleted: 5 });
    expect(purgeExpiredOTPs).toHaveBeenCalledTimes(1);
  });
});
