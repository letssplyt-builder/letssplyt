import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../infrastructure/errors';
import {
  assignSplitsWithNlp,
  calculateEventSplits,
  confirmEventSplit,
  getSplitAssignments,
} from './splits.service';

const calculateBodySchema = z.object({
  split_mode: z.enum(['equal', 'itemised', 'portion']),
  assignments: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        participant_ids: z.array(z.string().uuid()).min(1),
      }),
    )
    .optional(),
  nlp_instruction: z.string().max(500).optional(),
  manual_splits: z
    .array(
      z.object({
        participant_id: z.string().uuid(),
        value: z.number().positive(),
      }),
    )
    .optional(),
  manual_total: z.number().nonnegative().optional(),
});

const assignBodySchema = z.object({
  instruction: z.string().min(1).max(500),
});

const confirmBodySchema = z.object({
  splits: z
    .array(
      z.object({
        participant_id: z.string().uuid(),
        amount_owed: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export async function postSplitCalculateHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const eventId = req.params.id;
    if (!eventId) {
      throw new AppError('VALIDATION_ERROR', 'Event id is required', 400);
    }

    const body = calculateBodySchema.parse(req.body);
    const result = await calculateEventSplits(userId, eventId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function postSplitConfirmHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const eventId = req.params.id;
    if (!eventId) {
      throw new AppError('VALIDATION_ERROR', 'Event id is required', 400);
    }

    const body = confirmBodySchema.parse(req.body);
    const result = await confirmEventSplit(userId, eventId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSplitAssignmentsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const eventId = req.params.id;
    if (!eventId) {
      throw new AppError('VALIDATION_ERROR', 'Event id is required', 400);
    }

    const result = await getSplitAssignments(userId, eventId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function postSplitsAssignHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }

    const eventId = req.params.id;
    if (!eventId) {
      throw new AppError('VALIDATION_ERROR', 'Event id is required', 400);
    }

    const body = assignBodySchema.parse(req.body);
    const result = await assignSplitsWithNlp(userId, eventId, body.instruction);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
