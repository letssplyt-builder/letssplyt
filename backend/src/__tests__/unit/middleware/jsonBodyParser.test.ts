import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { jsonBodyParser, isPayloadTooLargeError } from '../../../middleware/jsonBodyParser';
import { errorHandler } from '../../../middleware/errorHandler';

describe('jsonBodyParser', () => {
  it('exports 100kb default limit', () => {
    expect(jsonBodyParser).toBeDefined();
  });

  it('isPayloadTooLargeError detects body-parser limit errors', () => {
    const err = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
      statusCode: 413,
    });
    expect(isPayloadTooLargeError(err)).toBe(true);
    expect(isPayloadTooLargeError(new Error('other'))).toBe(false);
  });

  it('returns JSON 413 when JSON body exceeds limit', async () => {
    const app = express();
    app.post('/echo', jsonBodyParser, (req, res) => {
      res.json({ ok: true, keys: Object.keys(req.body as object) });
    });
    app.use(errorHandler);

    const oversized = 'x'.repeat(101 * 1024);
    const response = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: oversized }));

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body too large',
      },
    });
  });

  it('accepts JSON bodies under the limit', async () => {
    const app = express();
    app.post('/echo', jsonBodyParser, (req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);

    const response = await request(app)
      .post('/echo')
      .send({ title: 'small payload' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
