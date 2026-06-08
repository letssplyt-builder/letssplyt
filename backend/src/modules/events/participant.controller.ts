import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { addManualParticipant, deleteParticipant } from './participant.service';

const e164Regex = /^\+[1-9]\d{7,14}$/;

const manualParticipantSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100),
    phone_e164: z.string().regex(e164Regex, 'Must be a valid E.164 phone number').optional(),
    join_method: z.enum(['manual_phone', 'manual_name_only']),
  })
  .superRefine((data, ctx) => {
    if (data.join_method === 'manual_phone' && !data.phone_e164) {
      ctx.addIssue({
        code: 'custom',
        message: 'phone_e164 is required when join_method is manual_phone',
        path: ['phone_e164'],
      });
    }
    if (data.join_method === 'manual_name_only' && data.phone_e164) {
      ctx.addIssue({
        code: 'custom',
        message: 'phone_e164 must not be provided for manual_name_only participants',
        path: ['phone_e164'],
      });
    }
  });

function validationError(res: Response, issues: z.ZodIssue[]): void {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: issues,
    },
  });
}

export async function handleAddManualParticipant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.id;
    if (!eventId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Event id is required' },
      });
      return;
    }

    const parsed = manualParticipantSchema.safeParse(req.body);
    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    const created = await addManualParticipant(req.user!.id, eventId, parsed.data);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteParticipant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.id;
    const participantId = req.params.participantId;

    if (!eventId || !participantId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Event id and participant id are required' },
      });
      return;
    }

    await deleteParticipant(req.user!.id, eventId, participantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
