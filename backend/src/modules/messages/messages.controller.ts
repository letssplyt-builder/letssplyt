import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../infrastructure/errors';
import { previewEventMessages } from './messages.service';
import { sendEventMessages } from './send.service';

export async function handleSendMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const eventId = req.params.eventId ?? req.params.id;
    if (!eventId) {
      throw new AppError('VALIDATION_ERROR', 'Event id is required', 400);
    }

    const participantIds = req.body?.participant_ids as string[] | undefined;
    const result = await sendEventMessages(userId, eventId, participantIds);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handlePreviewMessages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const eventId = req.params.eventId ?? req.params.id;
    if (!eventId) {
      throw new AppError('VALIDATION_ERROR', 'Event id is required', 400);
    }

    const result = await previewEventMessages(userId, eventId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
