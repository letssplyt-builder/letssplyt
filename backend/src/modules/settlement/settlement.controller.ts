import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../infrastructure/errors';
import { getGuestCounterparties, getMemberCounterparties } from './counterparties.service';
import { getGuestDetail } from './guest-detail.service';
import { getIOwe, getOwedToMe } from './ledger.service';
import { getMemberDetail } from './member-detail.service';
import {
  guestConfirmAll,
  guestDisputeAll,
  guestMarkPaidAll,
  memberConfirmAll,
  memberDisputeAll,
  memberMarkPaidAll,
  memberSelfReportAll,
} from './bulk-settlement.service';
import {
  confirmPayment,
  disputePayment,
  markParticipantPaid,
  nudgeParticipant,
  selfReportPayment,
} from './settlement.service';

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

export async function handleGetOwedToMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getOwedToMe(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGetIOwe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getIOwe(req.user!.id);
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

const selfReportBodySchema = z.object({
  payment_method: z.enum([
    'venmo',
    'paypal',
    'cashapp',
    'zelle',
    'wise',
    'cash',
    'bank_transfer',
    'other',
  ]),
  note: z.string().max(200).optional(),
});

const disputeBodySchema = z.object({
  note: z.string().max(200).optional(),
});

const markPaidBodySchema = z.object({
  payment_method: z.enum(['cash', 'zelle', 'bank_transfer', 'other']),
  note: z.string().max(200).optional(),
});

export async function handleSelfReportPayment(
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
    const participantId = req.params.participantId;
    if (!eventId || !participantId) {
      throw new AppError('VALIDATION_ERROR', 'Event id and participant id are required', 400);
    }

    const body = selfReportBodySchema.parse(req.body);
    const result = await selfReportPayment(userId, eventId, participantId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleConfirmPayment(
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
    const participantId = req.params.participantId;
    if (!eventId || !participantId) {
      throw new AppError('VALIDATION_ERROR', 'Event id and participant id are required', 400);
    }

    const result = await confirmPayment(userId, eventId, participantId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleDisputePayment(
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
    const participantId = req.params.participantId;
    if (!eventId || !participantId) {
      throw new AppError('VALIDATION_ERROR', 'Event id and participant id are required', 400);
    }

    const body = disputeBodySchema.parse(req.body ?? {});
    const result = await disputePayment(userId, eventId, participantId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleMarkParticipantPaid(
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
    const participantId = req.params.participantId;
    if (!eventId || !participantId) {
      throw new AppError('VALIDATION_ERROR', 'Event id and participant id are required', 400);
    }

    const body = markPaidBodySchema.parse(req.body);
    const result = await markParticipantPaid(userId, eventId, participantId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleNudgeParticipant(
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
    const participantId = req.params.participantId;
    if (!eventId || !participantId) {
      throw new AppError('VALIDATION_ERROR', 'Event id and participant id are required', 400);
    }

    const result = await nudgeParticipant(userId, eventId, participantId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleMemberSelfReportAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const counterpartyUserId = req.params.userId as string;
    const body = selfReportBodySchema.parse(req.body);
    const result = await memberSelfReportAll(userId, counterpartyUserId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleMemberConfirmAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const counterpartyUserId = req.params.userId as string;
    const result = await memberConfirmAll(userId, counterpartyUserId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleMemberDisputeAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const counterpartyUserId = req.params.userId as string;
    const body = disputeBodySchema.parse(req.body ?? {});
    const result = await memberDisputeAll(userId, counterpartyUserId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleMemberMarkPaidAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const counterpartyUserId = req.params.userId as string;
    const body = markPaidBodySchema.parse(req.body);
    const result = await memberMarkPaidAll(userId, counterpartyUserId, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGuestConfirmAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const phoneHash = req.params.phoneHash as string;
    const result = await guestConfirmAll(userId, phoneHash);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGuestDisputeAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const phoneHash = req.params.phoneHash as string;
    const body = disputeBodySchema.parse(req.body ?? {});
    const result = await guestDisputeAll(userId, phoneHash, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGuestMarkPaidAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('AUTH_REQUIRED', 'Unauthorized', 401);
    }
    const phoneHash = req.params.phoneHash as string;
    const body = markPaidBodySchema.parse(req.body);
    const result = await guestMarkPaidAll(userId, phoneHash, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
