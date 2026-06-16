import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import healthRouter from '../../../modules/health/health.routes';
import { mockLLMProvider } from '../../mocks/llm.mock';
import { mockRedisPing } from '../../mocks/redis.mock';
import { mockTwilio } from '../../mocks/twilio.mock';
import { mockSupabase } from '../../mocks/supabase.mock';

jest.mock('../../../infrastructure/redis', () => require('../../mocks/redis.mock').redisMockFactory());

function createApp(): express.Express {
  const app = express();
  app.use('/api/v1/health', healthRouter);
  return app;
}

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    process.env.APP_ENV = 'test';
    process.env.SMS_PROVIDER = 'twilio';

    mockSupabase.__setMockResultForTable('users', { data: [{ id: 'u1' }], error: null });
    mockRedisPing.mockResolvedValue('PONG');
    mockLLMProvider.complete.mockResolvedValue({
      text: 'ok',
      usage: { inputTokens: 1, outputTokens: 1 },
      modelUsed: 'mock-model',
    });
    mockTwilio.api.accounts.mockImplementation((sid: string) => ({
      fetch: jest.fn<() => Promise<{ sid: string }>>().mockResolvedValue({ sid }),
    }));
  });

  it('returns 200 with all checks ok', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toBe('ok');
    expect(res.body.checks.storage).toBe('ok');
    expect(res.body.checks.redis).toBe('ok');
    expect(res.body.checks.ai).toBe('ok');
    expect(res.body.checks.sms_provider).toBe('twilio');
    expect(res.body.checks.sms).toBe('ok');
    expect(res.body.environment).toBe('test');
    expect(res.body.version).toBeDefined();
  });

  it('returns degraded when database check fails', async () => {
    mockSupabase.__setMockResultForTable('users', {
      data: null,
      error: { code: '500', message: 'db down' },
    });

    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toBe('error');
  });

  it('never throws 500 even when all services down', async () => {
    mockSupabase.__setMockResultForTable('users', {
      data: null,
      error: { code: '500', message: 'db down' },
    });
    const receiptsBucket = mockSupabase.storage.from('receipts');
    receiptsBucket.list.mockResolvedValueOnce({
      data: null,
      error: { code: '500', message: 'storage down' },
    });
    mockRedisPing.mockRejectedValue(new Error('redis down'));
    mockLLMProvider.complete.mockRejectedValue(new Error('ai down'));
    mockTwilio.api.accounts.mockImplementation(() => ({
      fetch: jest.fn<() => Promise<{ sid: string }>>().mockRejectedValue(new Error('twilio down')),
    }));

    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('error');
    expect(res.body.checks.database).toBe('error');
    expect(res.body.checks.storage).toBe('error');
    expect(res.body.checks.redis).toBe('error');
    expect(res.body.checks.ai).toBe('error');
    expect(res.body.checks.sms).toBe('error');
  });

  it('does not require authentication', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});
