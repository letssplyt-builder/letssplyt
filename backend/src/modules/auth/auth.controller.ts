import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendOtp, verifyOtpAndCreateSession } from './auth.service';
import { AppError } from '../../infrastructure/errors';

const otpRequestSchema = z.object({
  phone_e164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be a valid E.164 phone number'),
  channel: z.enum(['sms', 'whatsapp']).optional(),
  context: z.enum(['login', 'register']).optional(),
});

const otpVerifySchema = z.object({
  phone_e164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be a valid E.164 phone number'),
  code: z.string().regex(/^[0-9]{6}$/, 'Code must be exactly 6 digits'),
  display_name: z.string().max(50).optional(),
  context: z.enum(['login', 'register', 'join_event']).optional(),
  join_token: z.string().optional(),
  device_id: z.string().min(8).max(128).optional(),
  platform: z.enum(['ios', 'android']).optional(),
});

export async function handleOtpRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = otpRequestSchema.safeParse(req.body);
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

    const result = await sendOtp(
      parsed.data.phone_e164,
      parsed.data.channel ?? 'sms',
      parsed.data.context,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleOtpVerify(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
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

    const session = await verifyOtpAndCreateSession(
      parsed.data.phone_e164,
      parsed.data.code,
      parsed.data.display_name,
      parsed.data.context ?? 'register',
      {
        deviceId: parsed.data.device_id,
        platform: parsed.data.platform,
      },
    );

    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
