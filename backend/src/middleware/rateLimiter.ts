import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../infrastructure/errors';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'IP_RATE_LIMITED',
        message: 'Too many requests from this IP',
      },
    });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'OTP_RATE_LIMITED',
        message: 'Too many authentication requests',
      },
    });
  },
});

/** In-memory OTP rate tracking per phone hash (Redis upgrade in later stories). */
const otpRequestCounts = new Map<string, { count: number; resetAt: number }>();
const otpVerifyAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkOtpRequestRate(phoneHash: string, maxPerHour = 5): void {
  const now = Date.now();
  const entry = otpRequestCounts.get(phoneHash);
  if (!entry || entry.resetAt < now) {
    otpRequestCounts.set(phoneHash, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return;
  }
  entry.count += 1;
  if (entry.count > maxPerHour) {
    throw new RateLimitError('OTP rate limited for this phone', 3600);
  }
}

export function checkOtpVerifyRate(phoneHash: string, maxPer10Min = 5): void {
  const now = Date.now();
  const entry = otpVerifyAttempts.get(phoneHash);
  if (!entry || entry.resetAt < now) {
    otpVerifyAttempts.set(phoneHash, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }
  entry.count += 1;
  if (entry.count > maxPer10Min) {
    throw new RateLimitError('Too many verification attempts', 600);
  }
}
