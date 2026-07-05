import rateLimit from 'express-rate-limit';
import { createUpstashRateLimitStore } from '../infrastructure/upstash-rate-limit-store';

export {
  checkOtpRequestRate,
  recordFailedOtpVerify,
  resetOtpRateLimitState,
} from '../infrastructure/otp-rate-counter';
import { isOtpDevBypassEnabled } from '../modules/auth/otp-dev-bypass';

const GLOBAL_WINDOW_MS = 15 * 60 * 1000;
const AUTH_WINDOW_MS = 60 * 1000;

export const globalRateLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createUpstashRateLimitStore('global', GLOBAL_WINDOW_MS),
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
  windowMs: AUTH_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isOtpDevBypassEnabled(),
  store: createUpstashRateLimitStore('auth', AUTH_WINDOW_MS),
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'OTP_RATE_LIMITED',
        message: 'Too many authentication requests',
      },
    });
  },
});
