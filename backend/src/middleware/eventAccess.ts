import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../infrastructure/errors';
import {
  assertEventAccess,
  assertEventOwner,
  fetchEventRow,
  type EventRowWithReceiptFields,
} from '../modules/events/event.service';

export type EventAccessLevel = 'owner' | 'member';

async function authorizeEventAccess(
  req: Request,
  eventId: string,
  level: EventAccessLevel,
): Promise<EventRowWithReceiptFields> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const eventRow = await fetchEventRow(eventId);
  if (level === 'owner') {
    await assertEventOwner(eventRow, userId);
  } else {
    await assertEventAccess(eventRow, userId);
  }

  return eventRow;
}

/** Assert event access using `:id` route param. Attaches loaded row to `req.event`. */
export function requireEventAccess(level: EventAccessLevel) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const eventId = req.params.id;
    if (!eventId) {
      next(new Error('requireEventAccess: missing :id route param'));
      return;
    }

    void authorizeEventAccess(req, eventId, level)
      .then((eventRow) => {
        req.event = eventRow;
        next();
      })
      .catch(next);
  };
}

/** Assert event access using JSON body `event_id`. Attaches loaded row to `req.event`. */
export function requireEventAccessFromBody(level: EventAccessLevel) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const eventId = req.body?.event_id;
    if (typeof eventId !== 'string' || !eventId.trim()) {
      next(new Error('requireEventAccessFromBody: missing body.event_id'));
      return;
    }

    void authorizeEventAccess(req, eventId.trim(), level)
      .then((eventRow) => {
        req.event = eventRow;
        next();
      })
      .catch(next);
  };
}
