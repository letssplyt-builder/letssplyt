import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../infrastructure/errors';
import { confirmReceipt, confirmReceiptBodySchema } from './receipts.confirm';
import { createReceiptUploadUrl, parseReceipt } from './receipts.service';

const uploadUrlSchema = z.object({
  event_id: z.string().uuid(),
});

const parseSchema = z.object({
  event_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
});

export async function postUploadUrlHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const body = uploadUrlSchema.parse(req.body);
    const result = await createReceiptUploadUrl(userId, body.event_id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function postConfirmHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const body = confirmReceiptBodySchema.parse(req.body);
    const result = await confirmReceipt(userId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function postParseHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const body = parseSchema.parse(req.body);
    const result = await parseReceipt(userId, body.event_id, body.storage_path);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
