import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mockSupabase } from '../../mocks/supabase.mock';
import telnyxWebhookRouter from '../../../modules/webhooks/telnyx.routes';

jest.mock('../../../infrastructure/notification/outbound-messaging.service', () => ({
  sendOutboundMessage: jest.fn(async () => ({ messageId: 'reply-1', channel: 'sms' })),
}));

import { sendOutboundMessage } from '../../../infrastructure/notification/outbound-messaging.service';

function createApp(basePath: string): express.Express {
  const app = express();
  app.use(express.json());
  app.use(basePath, telnyxWebhookRouter);
  return app;
}

const FINALIZED_DELIVERED = {
  data: {
    event_type: 'message.finalized',
    payload: {
      id: 'telnyx-msg-delivered',
      to: [{ status: 'delivered', phone_number: '+14155550002' }],
    },
  },
};

const INBOUND_STOP = {
  data: {
    event_type: 'message.received',
    payload: {
      from: { phone_number: '+14155550001' },
      text: 'STOP',
    },
  },
};

describe('Telnyx webhooks', () => {
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
    process.env.APP_ENV = 'test';
    mockSupabase.__pushMockResultForTable('notification_log', {
      data: { participant_id: 'part-1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });
  });

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
  });

  it('updates delivery on message.finalized delivered', async () => {
    const app = createApp('/api/v1/webhooks/telnyx');

    const res = await request(app)
      .post('/api/v1/webhooks/telnyx/messaging')
      .send(FINALIZED_DELIVERED);

    expect(res.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
    expect(mockSupabase.from).toHaveBeenCalledWith('participants');
  });

  it('processes inbound STOP and sends confirmation SMS', async () => {
    mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });

    const app = createApp('/api/v1/webhooks/telnyx');

    const res = await request(app)
      .post('/api/v1/webhooks/telnyx/messaging')
      .send(INBOUND_STOP);

    expect(res.status).toBe(200);
    expect(sendOutboundMessage).toHaveBeenCalledWith(
      '+14155550001',
      'sms',
      expect.stringContaining('unsubscribed'),
    );
  });

  it('rejects non-Telnyx IP when APP_ENV is staging', async () => {
    process.env.APP_ENV = 'staging';
    const app = createApp('/api/v1/webhooks/telnyx');

    const res = await request(app)
      .post('/api/v1/webhooks/telnyx/messaging')
      .set('X-Forwarded-For', '8.8.8.8')
      .send(FINALIZED_DELIVERED);

    expect(res.status).toBe(403);
  });
});
