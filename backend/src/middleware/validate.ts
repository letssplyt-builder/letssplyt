import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../infrastructure/errors';

export function validate(schema: ZodSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new ValidationError('Validation failed', {
          code: 'VALIDATION_ERROR',
          details: result.error.issues,
        }),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}
