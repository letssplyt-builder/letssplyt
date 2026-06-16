/**
 * Live smoke test for E12-S01: health check + analytics event ingestion.
 *
 * Usage (backend must be running, default PORT 3000):
 *   cd backend && doppler run -- npm run smoke:analytics-health
 */
import { hashAnalyticsUserId } from '../src/modules/analytics/analytics.service';
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const ALEX_PHONE = '+15005550001';

type StepResult = { name: string; ok: boolean; detail: string };
const results: StepResult[] = [];

function pass(name: string, detail = 'ok'): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}: ${detail}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

async function requestJson(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { _raw: text };
    }
  }
  return { status: res.status, body: parsed };
}

type HealthChecks = Record<string, string>;

function assertHealthOk(name: string, res: { status: number; body: Record<string, unknown> }): boolean {
  if (res.status !== 200) {
    fail(name, `status ${res.status} ${JSON.stringify(res.body)}`);
    return false;
  }
  const status = res.body.status as string | undefined;
  const checks = res.body.checks as HealthChecks | undefined;
  if (status !== 'ok' || !checks) {
    fail(name, `unexpected body ${JSON.stringify(res.body)}`);
    return false;
  }
  const failed = Object.entries(checks).filter(([key, value]) => key !== 'sms_provider' && value !== 'ok');
  if (failed.length > 0) {
    fail(name, `checks not ok: ${JSON.stringify(failed)}`);
    return false;
  }
  pass(name, `status=${status} sms_provider=${checks.sms_provider}`);
  return true;
}

async function countAnalyticsEvents(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('analytics_events')
    .select('*', { count: 'exact', head: true });
  if (error) {
    throw new Error(`count analytics_events: ${error.message}`);
  }
  return count ?? 0;
}

async function main(): Promise<void> {
  const smokeRunId = `smoke-e12-s01-${Date.now()}`;
  console.log(`Smoke: analytics + health (E12-S01) (${BASE_URL})`);
  console.log(`smoke_run=${smokeRunId}`);
  console.log('');

  try {
    const healthV1 = await requestJson('GET', '/api/v1/health');
    assertHealthOk('GET /api/v1/health', healthV1);

    const healthRoot = await requestJson('GET', '/health');
    assertHealthOk('GET /health', healthRoot);

    const noAuth = await requestJson('POST', '/api/v1/analytics/events', {
      events: [{ name: 'event_created', properties: {}, timestamp: Date.now() }],
    });
    if (noAuth.status === 401) {
      pass('POST /analytics/events unauthenticated', '401 as expected');
    } else {
      fail('POST /analytics/events unauthenticated', `expected 401, got ${noAuth.status}`);
    }

    const verify = await requestJson('POST', '/api/v1/auth/otp/verify', {
      phone_e164: ALEX_PHONE,
      code: '123456',
      context: 'login',
    });
    const accessToken = verify.body.access_token as string | undefined;
    const user = verify.body.user as { id?: string } | undefined;
    const userId = user?.id;
    if (verify.status !== 200 || !accessToken || !userId) {
      fail('POST /auth/otp/verify', `status ${verify.status} ${JSON.stringify(verify.body)}`);
      return;
    }
    pass('POST /auth/otp/verify', `user=${userId}`);

    const badEvent = await requestJson(
      'POST',
      '/api/v1/analytics/events',
      {
        events: [{ name: 'totally_fake_event', properties: {}, timestamp: Date.now() }],
      },
      accessToken,
    );
    if (badEvent.status === 400) {
      pass('POST /analytics/events unknown name', '400 as expected');
    } else {
      fail('POST /analytics/events unknown name', `expected 400, got ${badEvent.status}`);
    }

    const beforeCount = await countAnalyticsEvents();
    pass('analytics_events count before', String(beforeCount));

    const ts = Date.now();
    const record = await requestJson(
      'POST',
      '/api/v1/analytics/events',
      {
        events: [
          {
            name: 'event_created',
            properties: { smoke_run: smokeRunId, source: 'smoke-e12-s01' },
            timestamp: ts,
          },
          {
            name: 'event_locked',
            properties: { smoke_run: smokeRunId },
            timestamp: ts + 1,
          },
        ],
        session_id: `session-${smokeRunId}`,
        platform: 'ios',
        app_version: '1.0.0-smoke',
      },
      accessToken,
    );
    const recorded = record.body.recorded as number | undefined;
    if (record.status !== 200 || recorded !== 2) {
      fail('POST /analytics/events valid batch', `status ${record.status} body=${JSON.stringify(record.body)}`);
      return;
    }
    pass('POST /analytics/events valid batch', `recorded=${recorded}`);

    const afterCount = await countAnalyticsEvents();
    if (afterCount !== beforeCount + 2) {
      fail('analytics_events count increased', `before=${beforeCount} after=${afterCount}`);
    } else {
      pass('analytics_events count increased', `+2 (${beforeCount} → ${afterCount})`);
    }

    const expectedHash = hashAnalyticsUserId(userId);
    const { data: rows, error: rowError } = await supabaseAdmin
      .from('analytics_events')
      .select('user_id, anonymous_id, event_name, session_id, platform, app_version, created_at')
      .contains('properties', { smoke_run: smokeRunId });

    if (rowError || !rows?.length) {
      fail('DB row verification', rowError?.message ?? 'no rows found');
    } else {
      const allHashed = rows.every(
        (row) => row.user_id === null && row.anonymous_id === expectedHash && row.anonymous_id !== userId,
      );
      const sessionOk = rows.every((row) => row.session_id === `session-${smokeRunId}`);
      const platformOk = rows.every((row) => row.platform === 'ios');
      const versionOk = rows.every((row) => row.app_version === '1.0.0-smoke');
      if (allHashed && sessionOk && platformOk && versionOk) {
        pass('DB privacy + metadata', `${rows.length} rows hashed anonymous_id`);
      } else {
        fail(
          'DB privacy + metadata',
          JSON.stringify({ allHashed, sessionOk, platformOk, versionOk, sample: rows[0] }),
        );
      }
    }
  } finally {
    const { error: cleanupError } = await supabaseAdmin
      .from('analytics_events')
      .delete()
      .contains('properties', { smoke_run: smokeRunId });
    if (cleanupError) {
      console.warn(`  ⚠ cleanup failed: ${cleanupError.message}`);
    } else {
      console.log('  ✓ cleanup smoke rows');
    }
  }

  console.log('');
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.length}/${results.length} steps`);
    process.exit(1);
  }
  console.log(`PASSED: ${results.length}/${results.length} steps`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
