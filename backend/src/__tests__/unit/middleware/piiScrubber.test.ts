import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import logger from '../../../infrastructure/logger';
import { piiScrubberMiddleware } from '../../../middleware/piiScrubber';

jest.mock('../../../infrastructure/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  },
}));

function createApp(): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    req.requestId = 'req-test-1';
    next();
  });
  app.use(piiScrubberMiddleware);
  app.get('/test', (_req, res) => {
    res.json({ id: '1', phone_encrypted: 'cipher', nested: { phone_hash: 'abc' } });
  });
  app.get('/clean', (_req, res) => {
    res.json({ id: '1', name: 'Alex' });
  });
  return app;
}

describe('piiScrubberMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips PII keys from JSON responses', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '1', nested: {} });
    expect(res.body.phone_encrypted).toBeUndefined();
  });

  it('logs when PII keys are stripped', async () => {
    const app = createApp();
    await request(app).get('/test');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'PII scrubber stripped keys from JSON response',
        requestId: 'req-test-1',
        strippedKeys: expect.arrayContaining(['phone_encrypted', 'phone_hash']),
        strippedCount: 2,
      }),
    );
  });

  it('does not log when no PII keys are present', async () => {
    const app = createApp();
    await request(app).get('/clean');

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
