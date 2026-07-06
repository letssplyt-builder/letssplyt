import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { requireEventAccess } from '../../../middleware/eventAccess';

jest.mock('../../../modules/events/event.service', () => ({
  fetchEventRow: jest.fn(),
  assertEventOwner: jest.fn(() => Promise.resolve()),
  assertEventAccess: jest.fn(() => Promise.resolve()),
}));

import {
  assertEventAccess,
  assertEventOwner,
  fetchEventRow,
} from '../../../modules/events/event.service';

const EVENT_ID = 'event-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-11111111-1111-1111-1111-111111111111';
const EVENT_ROW = { id: EVENT_ID, payer_id: USER_ID, title: 'Dinner', status: 'open' };

describe('requireEventAccess middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchEventRow).mockResolvedValue(EVENT_ROW as never);
  });

  function createApp(level: 'owner' | 'member'): express.Express {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: USER_ID, email: 'user@test.local' };
      next();
    });
    app.get('/events/:id', requireEventAccess(level), (req, res) => {
      res.json({ eventId: req.event?.id });
    });
    return app;
  }

  it('loads event and attaches req.event for owner access', async () => {
    const app = createApp('owner');
    const response = await request(app).get(`/events/${EVENT_ID}`);
    expect(response.status).toBe(200);
    expect(response.body.eventId).toBe(EVENT_ID);
    expect(assertEventOwner).toHaveBeenCalledWith(EVENT_ROW, USER_ID);
    expect(assertEventAccess).not.toHaveBeenCalled();
  });

  it('uses member access check when level is member', async () => {
    const app = createApp('member');
    const response = await request(app).get(`/events/${EVENT_ID}`);
    expect(response.status).toBe(200);
    expect(assertEventAccess).toHaveBeenCalledWith(EVENT_ROW, USER_ID);
    expect(assertEventOwner).not.toHaveBeenCalled();
  });
});
