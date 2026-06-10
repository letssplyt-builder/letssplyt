import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getGuestCounterparties, getMemberCounterparties } from './counterparties.service';
import { getGuestDetail } from './guest-detail.service';
import { getMemberDetail } from './member-detail.service';

const counterpartiesQuerySchema = z.object({
  kind: z.enum(['members', 'guests']),
});

export async function handleGetCounterparties(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { kind } = counterpartiesQuerySchema.parse(req.query);
    const viewerId = req.user!.id;

    if (kind === 'members') {
      const result = await getMemberCounterparties(viewerId);
      res.status(200).json(result);
      return;
    }

    const result = await getGuestCounterparties(viewerId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGetMemberDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const result = await getMemberDetail(req.user!.id, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGetGuestDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const phoneHash = req.params.phoneHash as string;
    const result = await getGuestDetail(req.user!.id, phoneHash);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
