import type { Request, Response, NextFunction } from 'express';

const PII_KEYS = new Set([
  'phone_e164',
  'phone_hash',
  'phone_encrypted',
  'name_encrypted',
  'guest_pii_token',
  'handle_encrypted',
]);

function deepCloneAndScrub<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepCloneAndScrub(item)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(key)) continue;
      result[key] = deepCloneAndScrub(val);
    }
    return result as T;
  }

  return value;
}

export function piiScrubberMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);

  res.json = function scrubbedJson(body: unknown) {
    const scrubbed = deepCloneAndScrub(body);
    return originalJson(scrubbed);
  };

  next();
}
