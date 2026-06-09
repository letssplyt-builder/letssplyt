import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../infrastructure/errors';
import { appJoinEvent, getAppJoinPreview } from './join-app.service';

export async function getJoinPreviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.params.token;
    if (!token) {
      throw new AppError('VALIDATION_ERROR', 'Join token is required', 400);
    }

    const preview = await getAppJoinPreview(token);
    res.status(200).json(preview);
  } catch (err) {
    next(err);
  }
}

export async function postAppJoinHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.params.token;
    if (!token) {
      throw new AppError('VALIDATION_ERROR', 'Join token is required', 400);
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const result = await appJoinEvent(token, userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
