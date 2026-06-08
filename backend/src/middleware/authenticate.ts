import type { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../infrastructure/supabase';
import { UnauthorizedError } from '../infrastructure/errors';

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

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' },
    });
    return;
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
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
