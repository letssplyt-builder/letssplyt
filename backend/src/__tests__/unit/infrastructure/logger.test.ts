import { describe, expect, it } from '@jest/globals';
import { Writable } from 'stream';
import pino from 'pino';
import {
  childLogger,
  scrubLogString,
  scrubLogValue,
} from '../../../infrastructure/logger';

function captureLog(
  fn: (log: pino.Logger) => void,
): Record<string, unknown> {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });

  const testLogger = pino(
    {
      level: 'info',
      mixin(mergeObject) {
        const bindings: Record<string, unknown> = {
          environment: process.env.APP_ENV ?? 'unknown',
        };
        if (!('requestId' in mergeObject)) {
          bindings.requestId = null;
        }
        if (!('userId' in mergeObject)) {
          bindings.userId = null;
        }
        return bindings;
      },
      hooks: {
        logMethod(inputArgs, method) {
          const scrubbed = inputArgs.map((arg) => scrubLogValue(arg));
          Reflect.apply(method, this, scrubbed);
        },
      },
    },
    stream,
  );

  fn(testLogger);
  const line = chunks[0]?.trim();
  if (!line) {
    throw new Error('no log line captured');
  }
  return JSON.parse(line) as Record<string, unknown>;
}

describe('logger', () => {
  it('scrubs E.164 phone patterns from log messages', () => {
    expect(scrubLogString('SMS to +15005550001 failed')).toBe('SMS to [PHONE] failed');
    expect(scrubLogString('+441234567890')).toBe('[PHONE]');
  });

  it('scrubs sb_secret_ strings from logs', () => {
    expect(scrubLogString('key sb_secret_abc123xyz leaked')).toBe('key [SECRET] leaked');
  });

  it('includes requestId field on every log', () => {
    const entry = captureLog((log) => {
      log.info({ msg: 'test', requestId: 'req-abc' });
    });
    expect(entry.requestId).toBe('req-abc');
  });

  it('includes APP_ENV on every log', () => {
    process.env.APP_ENV = 'test';
    const entry = captureLog((log) => log.info({ msg: 'env check' }));
    expect(entry.environment).toBe('test');
  });

  it('does not scrub non-PII strings', () => {
    const input = 'event_created for user df37aff1-f008-4f8c-8158-65af62a391c3';
    expect(scrubLogString(input)).toBe(input);
  });

  it('childLogger binds requestId and userId', () => {
    const log = childLogger({ requestId: 'rid-1', userId: 'uid-1' });
    expect(log.bindings()).toMatchObject({ requestId: 'rid-1', userId: 'uid-1' });
  });
});
