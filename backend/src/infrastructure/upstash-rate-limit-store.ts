import type { IncrementResponse, Store } from 'express-rate-limit';
import { getRedisClient } from './redis';

/**
 * express-rate-limit store backed by Upstash Redis REST (multi-instance safe).
 */
export class UpstashRateLimitStore implements Store {
  prefix: string;

  constructor(
    prefix: string,
    private readonly windowMs: number,
  ) {
    this.prefix = prefix;
  }

  private redisKey(key: string): string {
    return `ratelimit:${this.prefix}:${key}`;
  }

  private windowSeconds(): number {
    return Math.max(1, Math.ceil(this.windowMs / 1000));
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error('UpstashRateLimitStore requires Redis');
    }

    const redisKey = this.redisKey(key);
    const totalHits = await redis.incr(redisKey);
    if (totalHits === 1) {
      await redis.expire(redisKey, this.windowSeconds());
    }

    const ttlMs = await redis.pttl(redisKey);
    const resetTime =
      typeof ttlMs === 'number' && ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined;

    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.decr(this.redisKey(key));
  }

  async resetKey(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.del(this.redisKey(key));
  }
}

export function createUpstashRateLimitStore(
  prefix: string,
  windowMs: number,
): UpstashRateLimitStore | undefined {
  if (process.env.APP_ENV === 'test' || process.env.APP_ENV === 'development') {
    return undefined;
  }
  if (!getRedisClient()) {
    return undefined;
  }
  return new UpstashRateLimitStore(prefix, windowMs);
}
