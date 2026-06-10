import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mockSupabase } from '../../mocks/supabase.mock';
import twilioWebhookRouter from '../../../modules/webhooks/twilio.routes';

jest.mock('../../../infrastructure/twilio-signature', () => ({
  validateTwilioWebhook: jest.fn(() => true),
}));

import { validateTwilioWebhook } from '../../../infrastructure/twilio-signature';

function createApp(): express.Express {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use('/api/v1/webhooks/twilio', twilioWebhookRouter);
  return app;
}

const TWILIO_SIGNATURE = 'valid-test-signature';

describe('Twilio webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
    jest.mocked(validateTwilioWebhook).mockReturnValue(true);
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', {
      data: { participant_id: 'part-1' },
      error: null,
    });
  });

  it('rejects opt-out requests with invalid Twilio signature', async () => {
    jest.mocked(validateTwilioWebhook).mockReturnValue(false);
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/opt-out')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ From: '+15005550001', Body: 'STOP' });

    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalledWith('sms_opt_outs');
  });

  it('inserts sms_opt_outs on STOP message', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/opt-out')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ From: '+15005550001', Body: 'STOP' });

    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('sms_opt_outs');
  });

  it('updates notification_log on delivery callback', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/delivery')
      .set('X-Twilio-Signature', TWILIO_SIGNATURE)
      .type('form')
      .send({ MessageSid: 'SMtest123', MessageStatus: 'delivered' });

    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
  });
});
