import type { NextFunction, Request, Response } from 'express';

const TELNYX_NETWORK = ipv4ToInt('192.76.120.192');
const TELNYX_MASK = 0xffffffff << (32 - 27) >>> 0;

function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return null;
    }
    value = (value << 8) + n;
  }
  return value >>> 0;
}

export function isTelnyxWebhookIp(ip: string): boolean {
  const addr = ipv4ToInt(normalizeIp(ip));
  if (addr === null || TELNYX_NETWORK === null) {
    return false;
  }
  return (addr & TELNYX_MASK) === (TELNYX_NETWORK & TELNYX_MASK);
}

/** Allow Telnyx webhook source IPs (192.76.120.192/27). Skipped in development/test. */
export function telnyxIpGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.APP_ENV === 'development' || process.env.APP_ENV === 'test') {
    next();
    return;
  }

  const ip = req.ip ?? '';
  if (!isTelnyxWebhookIp(ip)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}
