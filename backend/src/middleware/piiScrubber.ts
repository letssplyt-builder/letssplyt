import type { Request, Response, NextFunction } from 'express';
import logger from '../infrastructure/logger';

const PII_KEYS = new Set([
  'phone_e164',
  'phone_hash',
  'phone_encrypted',
  'name_encrypted',
  'guest_pii_token',
  'handle_encrypted',
]);

function deepCloneAndScrub<T>(value: T, strippedKeys: string[]): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepCloneAndScrub(item, strippedKeys)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(key)) {
        strippedKeys.push(key);
        continue;
      }
      result[key] = deepCloneAndScrub(val, strippedKeys);
    }
    return result as T;
  }

  return value;
}

export function piiScrubberMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);

  res.json = function scrubbedJson(body: unknown) {
    const strippedKeys: string[] = [];
    const scrubbed = deepCloneAndScrub(body, strippedKeys);
    if (strippedKeys.length > 0) {
      logger.warn({
        msg: 'PII scrubber stripped keys from JSON response',
        requestId: req.requestId ?? null,
        strippedKeys: [...new Set(strippedKeys)],
        strippedCount: strippedKeys.length,
      });
    }
    return originalJson(scrubbed);
  };

  next();
}
