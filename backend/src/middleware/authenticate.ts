import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../infrastructure/errors';
import {
  SupabaseJwtError,
  verifySupabaseAccessToken,
} from '../infrastructure/supabase-jwt';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' },
    });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' },
    });
    return;
  }

  try {
    const verified = await verifySupabaseAccessToken(token);
    req.user = { id: verified.userId, email: verified.email };
    next();
  } catch (err) {
    if (err instanceof SupabaseJwtError) {
      res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' },
      });
      return;
    }
    next(err);
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user?.id) {
    next(new UnauthorizedError());
    return;
  }
  next();
}
