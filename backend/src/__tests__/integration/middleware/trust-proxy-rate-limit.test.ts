import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Server } from 'http';
import request from 'supertest';
import { resetRedisClientForTests } from '../../../infrastructure/redis';
import app from '../../../app';

describe('trust proxy + global rate limiting', () => {
  let server: Server;
  let savedRedisUrl: string | undefined;
  let savedRedisToken: string | undefined;

  beforeAll(async () => {
    savedRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
    savedRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetRedisClientForTests();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    if (savedRedisUrl) {
      process.env.UPSTASH_REDIS_REST_URL = savedRedisUrl;
    }
    if (savedRedisToken) {
      process.env.UPSTASH_REDIS_REST_TOKEN = savedRedisToken;
    }
    resetRedisClientForTests();
  });

  it(
    'rate limits each X-Forwarded-For client IP independently over a live server',
    async () => {
      const exhaustedIp = '203.0.113.50';
      const freshIp = '203.0.113.51';

      for (let i = 0; i < 100; i += 1) {
        const response = await request(server).get('/health').set('X-Forwarded-For', exhaustedIp);
        expect(response.status).toBe(200);
        expect(response.body.status).toBeDefined();
        expect(response.body.checks).toBeDefined();
      }

      const blocked = await request(server).get('/health').set('X-Forwarded-For', exhaustedIp);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('IP_RATE_LIMITED');

      const allowed = await request(server).get('/health').set('X-Forwarded-For', freshIp);
      expect(allowed.status).toBe(200);
      expect(allowed.body.status).toBeDefined();
    },
    60_000,
  );
});
