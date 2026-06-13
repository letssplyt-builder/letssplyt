import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createEvent,
  getEventById,
  listEvents,
  lockEvent,
  regenerateJoinToken,
  reopenEvent,
} from './event.service';
import { resetEventExpenses } from './expenses.reset';
import { deleteEvent } from './event.delete';

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(100),
  date: z.string().date().optional(),
  event_date: z.string().date().optional(),
});

const listEventsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  role: z.enum(['creator', 'participant', 'all']).optional(),
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

export async function handleCreateEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    const eventDate = parsed.data.event_date ?? parsed.data.date;
    const created = await createEvent(req.user!.id, {
      title: parsed.data.title,
      event_date: eventDate,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function handleListEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = listEventsSchema.safeParse(req.query);
    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    const result = await listEvents(req.user!.id, parsed.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGetEvent(
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

    const event = await getEventById(req.user!.id, eventId);
    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
}

export async function handleLockEvent(
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

    const result = await lockEvent(req.user!.id, eventId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleReopenEvent(
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

    const result = await reopenEvent(req.user!.id, eventId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleResetExpenses(
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

    const result = await resetEventExpenses(req.user!.id, eventId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteEvent(
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

    await deleteEvent(req.user!.id, eventId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function handleRegenerateJoinToken(
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

    const result = await regenerateJoinToken(req.user!.id, eventId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
