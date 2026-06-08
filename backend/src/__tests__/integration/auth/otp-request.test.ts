import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';
import { resetOtpRateLimitState } from '../../../middleware/rateLimiter';

describe('POST /api/v1/auth/otp/request', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    resetOtpRateLimitState();
    process.env.APP_ENV = 'test';
    process.env.OTP_DEV_BYPASS = 'true';
  });

  it('returns 200 { sent: true } for a valid phone in register context', async () => {
    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone_e164: '+15005550006', context: 'register' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ sent: true });
  });

  it('returns 400 for an invalid phone', async () => {
    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone_e164: 'not-a-phone' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 { sent: false, reason: OTP_UNAVAILABLE } when phone is opted out', async () => {
    mockSupabase.__setMockResultForTable('sms_opt_outs', {
      data: { id: 'opt-out-1' },
      error: null,
    });

    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone_e164: '+15005550006', context: 'register' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sent: false, reason: 'OTP_UNAVAILABLE' });
  });

  it('returns 404 ACCOUNT_NOT_FOUND for login when no public profile exists', async () => {
    mockSupabase.__setMockResultForTable('users', { data: null, error: null });

    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone_e164: '+15005550006', context: 'login' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('returns 429 after exceeding per-phone OTP request limit', async () => {
    process.env.OTP_DEV_BYPASS = 'false';
    process.env.TWILIO_USE_LIVE_VERIFY = 'true';

    const phone = '+15005550099';
    for (let i = 0; i < 5; i += 1) {
      const ok = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: phone, context: 'register' });
      expect(ok.status).toBe(200);
    }

    const limited = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone_e164: phone, context: 'register' });

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('OTP_RATE_LIMITED');
  });
});
