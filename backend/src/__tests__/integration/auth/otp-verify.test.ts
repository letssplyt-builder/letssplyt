import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { AppError } from '../../../infrastructure/errors';
import { mockSupabase } from '../../mocks/supabase.mock';

jest.mock('../../../infrastructure/otp/otp.service', () => ({
  sendOTP: jest.fn(),
  verifyOTP: jest.fn(),
  purgeExpiredOTPs: jest.fn(),
}));

import { verifyOTP } from '../../../infrastructure/otp/otp.service';

const mockVerifyOTP = jest.mocked(verifyOTP);

function queueNewUserMocks(userId = 'new-user-id') {
  mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('users', {
    data: { display_name: 'New User', avatar_colour: '#4F46E5' },
    error: null,
  });
  mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
    data: { users: [] },
    error: null,
  });
  mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
    data: { user: { id: userId } },
    error: null,
  });
  mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

describe('POST /api/v1/auth/otp/verify', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    mockVerifyOTP.mockReset();
    process.env.APP_ENV = 'test';
    process.env.OTP_DEV_BYPASS = 'true';
    mockVerifyOTP.mockResolvedValue(undefined);
  });

  it('returns 200 with access_token for a valid dev-bypass code', async () => {
    queueNewUserMocks('integration-user-1');

    const response = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({
        phone_e164: '+12025559999',
        code: '123456',
        display_name: 'Integration User',
        context: 'register',
      });

    expect(response.status).toBe(200);
    expect(response.body.access_token).toBe('mock-access-token');
    expect(response.body.user.id).toBe('integration-user-1');
    expect(response.body.user.is_new_user).toBe(true);
    expect(response.body).not.toHaveProperty('phone_e164');
    expect(response.body).not.toHaveProperty('phone_hash');
  });

  it('returns 400 INVALID_CODE when verifyOTP rejects', async () => {
    process.env.OTP_DEV_BYPASS = 'false';
    mockVerifyOTP.mockRejectedValueOnce(new AppError('INVALID_CODE', 'Invalid OTP code', 400));

    const response = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone_e164: '+15005550006', code: '000000', context: 'login' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CODE');
  });

  it('returns the same user.id on a second verify for an existing public profile', async () => {
    mockSupabase.__setMockResultForTable('users', {
      data: {
        id: 'existing-user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
      },
      error: null,
    });
    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: 'existing-user-1', email: 'existing-user-1@letssplyt.internal' } },
      error: null,
    });

    const first = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone_e164: '+15005550006', code: '123456', context: 'login' });

    const second = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone_e164: '+15005550006', code: '654321', context: 'login' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(second.body.user.is_new_user).toBe(false);
  });
});
