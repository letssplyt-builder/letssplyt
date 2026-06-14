import { Receiver } from '@upstash/qstash';
import type { NextFunction, Request, Response } from 'express';
import logger from '../../infrastructure/logger';

let receiver: Receiver | null = null;

function getReceiver(): Receiver | null {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) {
    return null;
  }
  if (!receiver) {
    receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next,
    });
  }
  return receiver;
}

export function readQStashRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf-8');
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  return '';
}

export async function verifyQStashSignature(
  rawBody: string,
  signature: string | undefined,
): Promise<boolean> {
  const r = getReceiver();
  if (!r) {
    if (process.env.APP_ENV === 'development' || process.env.APP_ENV === 'test') {
      logger.warn({ msg: 'QStash signing keys missing — skipping verification in dev/test' });
      return true;
    }
    return false;
  }

  if (!signature) {
    return false;
  }

  try {
    return await r.verify({
      signature,
      body: rawBody,
    });
  } catch (err) {
    logger.warn({
      msg: 'QStash signature verification error',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function verifyQStashMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawBody = readQStashRawBody(req);
  const signature = req.headers['upstash-signature'] as string | undefined;
  const valid = await verifyQStashSignature(rawBody, signature);

  if (!valid) {
    res.status(401).json({ error: 'Invalid QStash signature' });
    return;
  }

  (req as Request & { qstashRawBody?: string }).qstashRawBody = rawBody;
  next();
}

export function parseQStashJsonBody<T>(req: Request): T {
  const raw =
    (req as Request & { qstashRawBody?: string }).qstashRawBody ?? readQStashRawBody(req);
  if (!raw.trim()) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}
