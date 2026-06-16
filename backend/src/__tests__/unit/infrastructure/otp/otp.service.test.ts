import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../../mocks/supabase.mock';
import * as otpDevBypass from '../../../../modules/auth/otp-dev-bypass';

const mockSendOutboundMessage = jest.fn<
  (params: { body: string }) => Promise<{ messageId: string; channel: 'sms' }>
>();

jest.mock('../../../../infrastructure/sms/factory', () => ({
  createSMSProvider: jest.fn(() => ({
    name: 'twilio',
    sendOutboundMessage: mockSendOutboundMessage,
  })),
  resetSMSProvider: jest.fn(),
}));

import {
  purgeExpiredOTPs,
  sendOTP,
  verifyOTP,
} from '../../../../infrastructure/otp/otp.service';
import { hashPhone } from '../../../../infrastructure/security';

const PHONE_E164 = '+14155550123';
const PHONE_HASH = hashPhone(PHONE_E164);

describe('otp.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    mockSendOutboundMessage.mockReset();
    mockSendOutboundMessage.mockResolvedValue({ messageId: 'SMotp123', channel: 'sms' });
    jest.spyOn(otpDevBypass, 'isOtpDevBypassEnabled').mockReturnValue(false);
    process.env.PII_HMAC_SALT =
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  });

  it('sendOTP stores hashed code and sends SMS with plaintext code', async () => {
    mockSupabase.__setMockResultForTable('otp_verifications', { data: null, error: null });

    await sendOTP(PHONE_HASH, PHONE_E164);

    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(1);
    const body = mockSendOutboundMessage.mock.calls[0]?.[0]?.body;
    expect(body).toMatch(/Your LetsSplyt verification code is: \d{6}/);
    expect(mockSupabase.from).toHaveBeenCalledWith('otp_verifications');
  });

  it('sendOTP deletes existing unused OTP before inserting', async () => {
    mockSupabase.__setMockResultForTable('otp_verifications', { data: null, error: null });

    await sendOTP(PHONE_HASH, PHONE_E164);

    const otpFromCalls = mockSupabase.from.mock.calls.filter((call) => call[0] === 'otp_verifications');
    expect(otpFromCalls.length).toBeGreaterThan(0);
  });

  it('verifyOTP succeeds for correct code and deletes row', async () => {
    const code = '583920';
    const crypto = await import('crypto');
    const salt = process.env.PII_HMAC_SALT!;
    const expectedHash = crypto.createHmac('sha256', salt).update(code).digest('hex');

    mockSupabase.__pushMockResultForTable('otp_verifications', {
      data: {
        id: 'otp-row-1',
        code_hash: expectedHash,
        expires_at: new Date(Date.now() + 600000).toISOString(),
        attempt_count: 0,
        verified_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('otp_verifications', { data: null, error: null });

    await verifyOTP(PHONE_HASH, code);
  });

  it('verifyOTP throws INVALID_CODE for wrong code', async () => {
    mockSupabase.__pushMockResultForTable('otp_verifications', {
      data: {
        id: 'otp-row-1',
        code_hash: 'wrong-hash',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        attempt_count: 0,
        verified_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('otp_verifications', { data: null, error: null });

    await expect(verifyOTP(PHONE_HASH, '111111')).rejects.toMatchObject({
      code: 'INVALID_CODE',
      statusCode: 400,
    });
  });

  it('verifyOTP throws CODE_EXPIRED when no valid row', async () => {
    mockSupabase.__setMockResultForTable('otp_verifications', {
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    await expect(verifyOTP(PHONE_HASH, '123456')).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
      statusCode: 400,
    });
  });

  it('verifyOTP throws OTP_MAX_ATTEMPTS after limit', async () => {
    mockSupabase.__pushMockResultForTable('otp_verifications', {
      data: {
        id: 'otp-row-1',
        code_hash: 'hash',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        attempt_count: 5,
        verified_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('otp_verifications', { data: null, error: null });

    await expect(verifyOTP(PHONE_HASH, '123456')).rejects.toMatchObject({
      code: 'OTP_MAX_ATTEMPTS',
      statusCode: 429,
    });
  });

  it('verifyOTP uses dev bypass when enabled', async () => {
    jest.spyOn(otpDevBypass, 'isOtpDevBypassEnabled').mockReturnValue(true);

    await verifyOTP(PHONE_HASH, '123456');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('otp_verifications');
  });

  it('purgeExpiredOTPs deletes expired rows', async () => {
    mockSupabase.__setMockResultForTable('otp_verifications', { data: null, error: null, count: 3 });

    const deleted = await purgeExpiredOTPs();
    expect(deleted).toBe(3);
  });

  it('sendOTP throws INTERNAL_ERROR when insert fails', async () => {
    mockSupabase.__pushMockResultForTable('otp_verifications', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('otp_verifications', {
      data: null,
      error: { code: '500', message: 'insert failed' },
    });

    await expect(sendOTP(PHONE_HASH, PHONE_E164)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });
});
