import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import logger from '../infrastructure/logger';
import { AppError } from '../infrastructure/errors';

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  logger.error({
    err,
    requestId: req.requestId ?? null,
    userId: req.user?.id ?? null,
    msg: 'request error',
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  Sentry.captureException(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: INTERNAL_ERROR_MESSAGE,
    },
  });
}
