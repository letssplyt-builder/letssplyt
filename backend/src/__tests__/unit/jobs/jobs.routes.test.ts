import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import jobsRouter from '../../../modules/jobs/jobs.routes';

const mockVerify = jest.fn<() => Promise<boolean>>();

jest.mock('@upstash/qstash', () => ({
  Receiver: jest.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}));

jest.mock('../../../modules/jobs/purge-pii.job', () => ({
  runGuestPiiPurge: jest.fn(() => Promise.resolve({ purged: 3 })),
}));

jest.mock('../../../modules/jobs/partition.job', () => ({
  runAnalyticsPartitionCreation: jest.fn(() =>
    Promise.resolve({
      partition: 'analytics_events_2026_07',
      created: true,
      startDate: '2026-07-01',
      endDate: '2026-08-01',
    }),
  ),
}));

import { runGuestPiiPurge } from '../../../modules/jobs/purge-pii.job';
import { runAnalyticsPartitionCreation } from '../../../modules/jobs/partition.job';

function createApp(): express.Express {
  const app = express();
  app.use('/api/v1/jobs', express.raw({ type: 'application/json' }), jobsRouter);
  return app;
}

describe('jobs routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next';
    mockVerify.mockResolvedValue(true);
  });

  it('rejects purge-guest-pii with invalid QStash signature', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/jobs/purge-guest-pii')
      .set('upstash-signature', 'bad-sig')
      .send(JSON.stringify({ batchSize: 50 }));

    expect(res.status).toBe(401);
    expect(runGuestPiiPurge).not.toHaveBeenCalled();
  });

  it('runs purge-guest-pii with valid signature', async () => {
    const app = createApp();
    const body = JSON.stringify({ batchSize: 50 });

    const res = await request(app)
      .post('/api/v1/jobs/purge-guest-pii')
      .set('upstash-signature', 'valid-sig')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ purged: 3 });
    expect(mockVerify).toHaveBeenCalledWith({
      signature: 'valid-sig',
      body,
    });
    expect(runGuestPiiPurge).toHaveBeenCalledWith({ batchSize: 50 });
  });

  it('runs create-analytics-partition with valid signature', async () => {
    const app = createApp();
    const body = JSON.stringify({ year: 2026, month: 8 });

    const res = await request(app)
      .post('/api/v1/jobs/create-analytics-partition')
      .set('upstash-signature', 'valid-sig')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.partition).toBe('analytics_events_2026_07');
    expect(res.body.created).toBe(true);
    expect(runAnalyticsPartitionCreation).toHaveBeenCalledWith({ year: 2026, month: 8 });
  });
});
