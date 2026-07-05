import { RateLimitError } from './errors';
import { getRedisClient } from './redis';
import { isOtpDevBypassEnabled } from '../modules/auth/otp-dev-bypass';

interface MemoryCounterEntry {
  count: number;
  resetAt: number;
}

const memoryCounters = new Map<string, MemoryCounterEntry>();

function pruneExpiredMemoryCounters(now: number): void {
  for (const [key, entry] of memoryCounters.entries()) {
    if (entry.resetAt < now) {
      memoryCounters.delete(key);
    }
  }
}

function useRedisCounters(): boolean {
  if (process.env.APP_ENV === 'test' || process.env.APP_ENV === 'development') {
    return false;
  }
  return getRedisClient() !== null;
}

async function incrementRedisCounter(
  redisKey: string,
  windowSeconds: number,
  max: number,
  message: string,
  retryAfterSeconds: number,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis client unavailable');
  }

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  if (count > max) {
    throw new RateLimitError(message, retryAfterSeconds);
  }
}

function incrementMemoryCounter(
  key: string,
  windowMs: number,
  max: number,
  message: string,
  retryAfterSeconds: number,
): void {
  const now = Date.now();
  pruneExpiredMemoryCounters(now);

  const entry = memoryCounters.get(key);
  if (!entry || entry.resetAt < now) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > max) {
    throw new RateLimitError(message, retryAfterSeconds);
  }
}

export async function checkOtpRequestRate(phoneHash: string, maxPerHour = 5): Promise<void> {
  if (isOtpDevBypassEnabled()) return;

  const redisKey = `otp:request:${phoneHash}`;
  if (useRedisCounters()) {
    await incrementRedisCounter(
      redisKey,
      60 * 60,
      maxPerHour,
      'OTP rate limited for this phone',
      3600,
    );
    return;
  }

  incrementMemoryCounter(
    redisKey,
    60 * 60 * 1000,
    maxPerHour,
    'OTP rate limited for this phone',
    3600,
  );
}

export async function recordFailedOtpVerify(phoneHash: string, maxPer10Min = 5): Promise<void> {
  if (isOtpDevBypassEnabled()) return;

  const redisKey = `otp:verify-fail:${phoneHash}`;
  if (useRedisCounters()) {
    await incrementRedisCounter(
      redisKey,
      10 * 60,
      maxPer10Min,
      'Too many verification attempts',
      600,
    );
    return;
  }

  incrementMemoryCounter(
    redisKey,
    10 * 60 * 1000,
    maxPer10Min,
    'Too many verification attempts',
    600,
  );
}

/** Clears in-memory OTP counters — integration tests. */
export function resetOtpRateLimitState(): void {
  memoryCounters.clear();
}
