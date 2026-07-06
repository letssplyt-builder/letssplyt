import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import * as Sentry from '@sentry/node';
import { errorHandler } from '../../../middleware/errorHandler';
import { AppError, Errors, ValidationError } from '../../../infrastructure/errors';

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('errorHandler middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createApp(routeError: unknown): express.Express {
    const app = express();
    app.get('/boom', (_req, _res, next) => {
      next(routeError);
    });
    app.use(errorHandler);
    return app;
  }

  it('returns JSON for AppError with status and code', async () => {
    const app = createApp(Errors.forbidden('You do not have access to this event'));

    const response = await request(app).get('/boom');

    expect(response.status).toBe(403);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this event',
      },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('includes validation details without double-wrapping the code', async () => {
    const issues = [{ path: ['title'], message: 'Required' }];
    const app = createApp(new ValidationError('Validation failed', issues));

    const response = await request(app).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: issues,
      },
    });
  });

  it('returns JSON 413 for payload too large errors', async () => {
    const err = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
      statusCode: 413,
    });
    const app = createApp(err);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body too large',
      },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('returns JSON 500 for unknown errors instead of Express HTML', async () => {
    const app = createApp(new Error('database exploded'));

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(response.text).not.toContain('Internal Server Error');
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('omits details key when AppError has no details', async () => {
    const app = createApp(new AppError('CUSTOM', 'Something failed', 418));

    const response = await request(app).get('/boom');

    expect(response.status).toBe(418);
    expect(response.body).toEqual({
      error: {
        code: 'CUSTOM',
        message: 'Something failed',
      },
    });
    expect(response.body.error).not.toHaveProperty('details');
  });
});
