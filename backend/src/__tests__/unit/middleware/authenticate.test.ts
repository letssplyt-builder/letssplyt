import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { authenticate } from '../../../middleware/authenticate';
import { SupabaseJwtError } from '../../../infrastructure/supabase-jwt';

jest.mock('../../../infrastructure/supabase-jwt', () => ({
  SupabaseJwtError: class SupabaseJwtError extends Error {
    readonly code = 'AUTH_REQUIRED';
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'SupabaseJwtError';
    }
  },
  verifySupabaseAccessToken: jest.fn(),
}));

import { verifySupabaseAccessToken } from '../../../infrastructure/supabase-jwt';

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createApp(): express.Express {
    const app = express();
    app.get('/protected', authenticate, (req, res) => {
      res.json({ userId: req.user?.id, email: req.user?.email });
    });
    return app;
  }

  it('returns 401 when Authorization header is missing', async () => {
    const response = await request(createApp()).get('/protected');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
    expect(verifySupabaseAccessToken).not.toHaveBeenCalled();
  });

  it('attaches req.user from locally verified JWT claims', async () => {
    jest.mocked(verifySupabaseAccessToken).mockResolvedValueOnce({
      userId: 'user-123',
      email: 'user@test.local',
    });

    const response = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'user-123', email: 'user@test.local' });
    expect(verifySupabaseAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('returns 401 when local JWT verification fails', async () => {
    jest
      .mocked(verifySupabaseAccessToken)
      .mockRejectedValueOnce(new SupabaseJwtError());

    const response = await request(createApp())
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
