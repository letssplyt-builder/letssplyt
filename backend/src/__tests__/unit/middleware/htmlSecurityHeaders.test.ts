import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { htmlSecurityHeaders } from '../../../middleware/htmlSecurityHeaders';

function createTestApp(): express.Express {
  const app = express();
  app.use('/join', htmlSecurityHeaders, (_req, res) => {
    res.type('html').send('<html><body>ok</body></html>');
  });
  app.use('/split', htmlSecurityHeaders, (_req, res) => {
    res.type('html').setHeader('Cache-Control', 'private, no-store').send('<html><body>ok</body></html>');
  });
  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('htmlSecurityHeaders', () => {
  const app = createTestApp();

  it('sets CSP, referrer policy, and frame protection on /join HTML routes', async () => {
    const response = await request(app).get('/join/test-token');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['content-security-policy']).toContain("script-src 'unsafe-inline'");
    expect(response.headers['content-security-policy']).toContain("style-src 'unsafe-inline'");
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('sets the same security headers on /split HTML routes', async () => {
    const response = await request(app).get('/split/test-token');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('does not apply HTML security headers to JSON API routes', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['referrer-policy']).toBeUndefined();
  });
});
