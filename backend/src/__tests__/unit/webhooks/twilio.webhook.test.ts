import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mockSupabase } from '../../mocks/supabase.mock';
import twilioWebhookRouter from '../../../modules/webhooks/twilio.routes';

jest.mock('../../../infrastructure/twilio-signature', () => ({
  validateTwilioWebhook: jest.fn(() => true),
}));

jest.mock('../../../infrastructure/notification/process-sms-opt-out', () => ({
  processSmsStopOptOut: jest.fn(async () => [
    {
      id: 'part-1',
      event_id: 'event-1',
      payment_status: 'pending',
      amount_owed: 20,
    },
  ]),
}));

import { validateTwilioWebhook } from '../../../infrastructure/twilio-signature';
import { processSmsStopOptOut } from '../../../infrastructure/notification/process-sms-opt-out';

function createApp(basePath: string): express.Express {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(basePath, twilioWebhookRouter);
  return app;
}

const TWILIO_SIGNATURE = 'valid-test-signature';

describe('Twilio webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
    jest.mocked(validateTwilioWebhook).mockReturnValue(true);
    mockSupabase.__setMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', {
      data: { participant_id: 'part-1' },
      error: null,
    });
  });

  it('rejects opt-out requests with invalid Twilio signature', async () => {
    jest.mocked(validateTwilioWebhook).mockReturnValue(false);
    const app = createApp('/api/v1/webhooks/twilio');

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/opt-out')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ From: '+15005550001', Body: 'STOP' });

    expect(res.status).toBe(403);
    expect(processSmsStopOptOut).not.toHaveBeenCalled();
  });

  it('processes STOP on /opt-out and returns TwiML confirmation', async () => {
    const app = createApp('/api/v1/webhooks/twilio');

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/opt-out')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ From: '+12125551234', Body: 'STOP' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toContain('unsubscribed');
    expect(processSmsStopOptOut).toHaveBeenCalledWith('+12125551234');
  });

  it('processes STOP on /webhooks/twilio/stop alias route', async () => {
    const app = createApp('/webhooks/twilio');

    const res = await request(app)
      .post('/webhooks/twilio/stop')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ From: '+12125551234', Body: 'STOP' });

    expect(res.status).toBe(200);
    expect(processSmsStopOptOut).toHaveBeenCalledWith('+12125551234');
  });

  it('updates notification_log and participant delivery on delivered callback', async () => {
    mockSupabase.__pushMockResultForTable('notification_log', {
      data: { participant_id: 'part-1' },
      error: null,
    });

    const app = createApp('/api/v1/webhooks/twilio');

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/delivery')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ MessageSid: 'SMtest123', MessageStatus: 'delivered' });

    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
    expect(mockSupabase.from).toHaveBeenCalledWith('participants');
  });
});
