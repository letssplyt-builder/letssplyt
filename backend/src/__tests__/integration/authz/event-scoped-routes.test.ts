import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const OWNER_ID = 'owner-11111111-1111-1111-1111-111111111111';
const STRANGER_ID = 'stranger-22222222-2222-2222-2222-222222222222';
const EVENT_ID = 'event-33333333-3333-3333-3333-333333333333';
const PARTICIPANT_ID = 'part-44444444-4444-4444-4444-444444444444';
const AUTH_STRANGER = { Authorization: 'Bearer mock-stranger-token' };

const EVENT_ROW = {
  id: EVENT_ID,
  payer_id: OWNER_ID,
  title: 'Team Dinner',
  event_date: null,
  total_amount: 100,
  currency: 'USD',
  status: 'open',
  split_mode: null,
  ai_stage: 'none',
  locale: 'en-US',
  locked_at: null,
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: null,
  tip_amount: null,
  fees_amount: null,
  discount_amount: null,
  receipt_scan_attempted: false,
};

function mockStrangerAuth(): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: STRANGER_ID, email: 'stranger@test.local' } },
    error: null,
  });
}

function mockForeignEvent(): void {
  mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });
}

function mockForeignEventMemberCheckDenied(): void {
  mockForeignEvent();
  mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
}

describe('Event-scoped route authorization (cross-tenant)', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  describe('owner-only routes reject strangers before handler logic', () => {
    const ownerRoutes: Array<{
      method: 'get' | 'post' | 'delete';
      path: string;
      body?: Record<string, unknown>;
    }> = [
      { method: 'delete', path: `/api/v1/events/${EVENT_ID}` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/participants/manual`, body: { display_name: 'Guest' } },
      { method: 'delete', path: `/api/v1/events/${EVENT_ID}/participants/${PARTICIPANT_ID}` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/lock` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/expenses/reset` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/reopen` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/join-token/regenerate` },
      { method: 'get', path: `/api/v1/events/${EVENT_ID}/messages/preview` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/messages/send` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/messages/retry/${PARTICIPANT_ID}` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/messages/nudge/${PARTICIPANT_ID}` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/splits/resend` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/confirm` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/dispute` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/settlement/cash/${PARTICIPANT_ID}` },
      { method: 'get', path: `/api/v1/events/${EVENT_ID}/split/assignments` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/split/calculate`, body: { split_mode: 'equal' } },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/split/confirm` },
      { method: 'post', path: `/api/v1/events/${EVENT_ID}/splits/assign`, body: { instruction: 'equal split' } },
    ];

    it.each(ownerRoutes)('$method $path → 403 FORBIDDEN', async ({ method, path, body }) => {
      mockStrangerAuth();
      mockForeignEvent();

      const agent = request(app)[method](path).set(AUTH_STRANGER);
      const response = body ? await agent.send(body) : await agent;

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('member routes reject non-participants', () => {
    it('GET /events/:id → 403 FORBIDDEN', async () => {
      mockStrangerAuth();
      mockForeignEventMemberCheckDenied();

      const response = await request(app)
        .get(`/api/v1/events/${EVENT_ID}`)
        .set(AUTH_STRANGER);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /events/:id/settlement/:participantId/self-report → 403 FORBIDDEN', async () => {
      mockStrangerAuth();
      mockForeignEventMemberCheckDenied();

      const response = await request(app)
        .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/self-report`)
        .set(AUTH_STRANGER)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('receipt routes reject strangers via body event_id', () => {
    const receiptRoutes: Array<{
      path: string;
      body: Record<string, unknown>;
    }> = [
      { path: '/api/v1/receipts/upload-url', body: { event_id: EVENT_ID, content_type: 'image/jpeg' } },
      { path: '/api/v1/receipts/parse', body: { event_id: EVENT_ID, storage_path: 'receipts/x.jpg' } },
      { path: '/api/v1/receipts/confirm', body: { event_id: EVENT_ID } },
    ];

    it.each(receiptRoutes)('POST $path → 403 FORBIDDEN', async ({ path, body }) => {
      mockStrangerAuth();
      mockForeignEvent();

      const response = await request(app).post(path).set(AUTH_STRANGER).send(body);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});
