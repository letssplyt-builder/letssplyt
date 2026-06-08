import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PAYMENT_PROVIDERS } from '@letssplyt/shared/profile.types';
import {
  createHandle,
  deleteHandle,
  getHandles,
  getMe,
  updateMe,
} from './profile.service';

const patchMeSchema = z.object({
  display_name: z.string().max(50).optional(),
  expo_push_token: z.string().max(200).optional(),
  avatar_colour: z.string().optional(),
});

const createHandleSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  handle_value: z.string().min(1).max(100),
});

function extractJwt(req: Request): string {
  const header = req.headers.authorization;
  return header?.slice('Bearer '.length).trim() ?? '';
}

function validationError(res: Response, issues: z.ZodIssue[]): void {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: issues,
    },
  });
}

export async function handleGetMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await getMe(req.user!.id, extractJwt(req));
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function handlePatchMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    const profile = await updateMe(req.user!.id, extractJwt(req), parsed.data, {
      deviceId: req.header('X-Device-ID') ?? undefined,
      platform: req.header('X-Platform') ?? undefined,
    });
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function handleGetHandles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const handles = await getHandles(req.user!.id);
    res.status(200).json({ data: handles });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateHandle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createHandleSchema.safeParse(req.body);
    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    const handle = await createHandle(
      req.user!.id,
      parsed.data.provider,
      parsed.data.handle_value,
    );
    res.status(201).json(handle);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteHandle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const handleId = req.params.id;
    if (!handleId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Handle id is required' },
      });
      return;
    }

    await deleteHandle(req.user!.id, handleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
