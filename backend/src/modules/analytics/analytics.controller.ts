import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ANALYTICS_EVENT_NAMES } from './events.enum';
import { recordAnalyticsEvents } from './analytics.service';

const eventSchema = z.object({
  name: z.enum(ANALYTICS_EVENT_NAMES),
  properties: z.record(z.unknown()).default({}),
  timestamp: z.number().int().positive(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
  session_id: z.string().max(128).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  app_version: z.string().max(32).optional(),
});

export async function handleRecordAnalyticsEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: parsed.error.issues,
        },
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' },
      });
      return;
    }

    const recorded = await recordAnalyticsEvents(parsed.data.events, {
      userId,
      sessionId: parsed.data.session_id,
      platform: parsed.data.platform,
      appVersion: parsed.data.app_version,
    });

    res.status(200).json({ recorded });
  } catch (err) {
    next(err);
  }
}
