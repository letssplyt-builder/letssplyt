import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';

jest.mock('../../../modules/health/health.service', () => ({
  runHealthChecks: jest.fn(async () => ({
    status: 'ok',
    version: 'test',
    checks: {},
  })),
}));

import app from '../../../app';

describe('trust proxy + global rate limiting', () => {
  it(
    'rate limits each X-Forwarded-For client IP independently',
    async () => {
      const exhaustedIp = '203.0.113.50';
      const freshIp = '203.0.113.51';

      for (let i = 0; i < 100; i += 1) {
        const response = await request(app).get('/health').set('X-Forwarded-For', exhaustedIp);
        expect(response.status).toBe(200);
      }

      const blocked = await request(app).get('/health').set('X-Forwarded-For', exhaustedIp);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('IP_RATE_LIMITED');

      const allowed = await request(app).get('/health').set('X-Forwarded-For', freshIp);
      expect(allowed.status).toBe(200);
    },
    30_000,
  );
});
