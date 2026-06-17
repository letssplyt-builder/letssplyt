import pino from 'pino';

const E164_PATTERN = /\+[1-9]\d{7,14}/g;
const SECRET_PATTERN = /sb_secret_[A-Za-z0-9_]+/g;

/** Scrub E.164 phone numbers and Supabase secret keys from a log string. */
export function scrubLogString(value: string): string {
  return value.replace(E164_PATTERN, '[PHONE]').replace(SECRET_PATTERN, '[SECRET]');
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/** Deep-scrub strings in objects passed to the logger. */
export function scrubLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return scrubLogString(value);
  }

  if (value instanceof Error) {
    return {
      type: value.name,
      message: scrubLogString(value.message),
      stack: value.stack ? scrubLogString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubLogValue(item, seen));
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (!isPlainObject(value)) {
      return '[NonPlainObject]';
    }

    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = scrubLogValue(child, seen);
    }
    return result;
  }

  return value;
}

const isProduction = process.env.APP_ENV === 'production';

const baseLogger = pino({
  level: isProduction ? 'info' : 'debug',
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
  redact: {
    paths: [
      'phone_e164',
      'phone_hash',
      'phone_encrypted',
      'phoneE164',
      'name_encrypted',
      'handle_encrypted',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});

export function childLogger(bindings: {
  requestId?: string | null;
  userId?: string | null;
}): pino.Logger {
  return baseLogger.child({
    requestId: bindings.requestId ?? null,
    userId: bindings.userId ?? null,
  });
}

export default baseLogger;
