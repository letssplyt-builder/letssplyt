import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { runAnalyticsPartitionCreation } from './partition.job';
import { parseQStashJsonBody } from './qstash.receiver';
import { runExpiredOtpPurge } from './purge-otp.job';
import { runGuestPiiPurge } from './purge-pii.job';

const purgeBodySchema = z.object({
  batchSize: z.number().int().min(1).max(2000).optional(),
});

const partitionBodySchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
}).refine(
  (body) =>
    body.year === undefined && body.month === undefined ||
    body.year !== undefined && body.month !== undefined,
  { message: 'year and month must both be provided when specifying a target month' },
);

export async function handlePurgeGuestPii(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = purgeBodySchema.safeParse(parseQStashJsonBody(req));
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await runGuestPiiPurge(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateAnalyticsPartition(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = partitionBodySchema.safeParse(parseQStashJsonBody(req));
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await runAnalyticsPartitionCreation(parsed.data);
    res.json({
      partition: result.partition,
      created: result.created,
      startDate: result.startDate,
      endDate: result.endDate,
    });
  } catch (err) {
    next(err);
  }
}

export async function handlePurgeExpiredOtps(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await runExpiredOtpPurge();
    res.json(result);
  } catch (err) {
    next(err);
  }
}
