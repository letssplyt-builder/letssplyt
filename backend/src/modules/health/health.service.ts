import { createLLMProvider } from '../../infrastructure/llm/factory';
import { getRedisClient } from '../../infrastructure/redis';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { telnyxClient } from '../../infrastructure/telnyx';
import { twilioClient } from '../../infrastructure/twilio';

export type HealthCheckStatus = 'ok' | 'error' | 'skipped';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: HealthCheckStatus;
    storage: HealthCheckStatus;
    redis: HealthCheckStatus;
    ai: HealthCheckStatus;
    sms_provider: string;
    sms: HealthCheckStatus;
  };
  version: string;
  environment: string;
}

async function checkDatabase(): Promise<HealthCheckStatus> {
  try {
    const { error } = await supabaseAdmin.from('users').select('id').limit(1);
    return error ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}

async function checkStorage(): Promise<HealthCheckStatus> {
  try {
    const { error } = await supabaseAdmin.storage.from('receipts').list('', { limit: 1 });
    return error ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}

async function checkRedis(): Promise<HealthCheckStatus> {
  const redis = getRedisClient();
  if (!redis) {
    return 'error';
  }
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

async function checkGemini(): Promise<HealthCheckStatus> {
  if (process.env.APP_ENV === 'production') {
    return 'skipped';
  }
  if (!process.env.GEMINI_API_KEY) {
    return 'error';
  }
  try {
    const provider = createLLMProvider('A1');
    await provider.complete([{ role: 'user', content: 'ping' }], { maxTokens: 1, timeout: 10_000 });
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkTwilioSms(): Promise<HealthCheckStatus> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return 'error';
  }
  try {
    await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkTelnyxSms(): Promise<HealthCheckStatus> {
  if (!process.env.TELNYX_API_KEY) {
    return 'error';
  }
  try {
    await telnyxClient.messagingProfiles.list();
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkSms(): Promise<HealthCheckStatus> {
  const provider = process.env.SMS_PROVIDER ?? 'twilio';
  if (provider === 'telnyx') {
    return checkTelnyxSms();
  }
  return checkTwilioSms();
}

function resolveOverallStatus(checks: HealthCheckResult['checks']): HealthCheckResult['status'] {
  const values = [
    checks.database,
    checks.storage,
    checks.redis,
    checks.ai === 'skipped' ? 'ok' : checks.ai,
    checks.sms,
  ];
  if (values.every((v) => v === 'ok')) {
    return 'ok';
  }
  if (values.every((v) => v === 'error')) {
    return 'error';
  }
  return 'degraded';
}

export async function runHealthChecks(version: string): Promise<HealthCheckResult> {
  const smsProvider = process.env.SMS_PROVIDER ?? 'twilio';

  const [database, storage, redis, ai, sms] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkRedis(),
    checkGemini(),
    checkSms(),
  ]);

  const checks = {
    database,
    storage,
    redis,
    ai,
    sms_provider: smsProvider,
    sms,
  };

  return {
    status: resolveOverallStatus(checks),
    checks,
    version,
    environment: process.env.APP_ENV ?? 'unknown',
  };
}
