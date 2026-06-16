/**
 * Live smoke test for QStash job handlers (E10-S01):
 * guest PII purge + analytics partition creation.
 *
 * Usage (backend running for HTTP checks, default PORT 3000):
 *   cd backend && doppler run -- npm run smoke:jobs
 *
 * Optional env:
 *   SMOKE_TEST_BASE_URL — API base (default http://127.0.0.1:PORT)
 *   SMOKE_JOBS_USE_QSTASH=1 — also enqueue via QStash publish (APP_URL must be public)
 */
import { Client } from '@upstash/qstash';
import { runAnalyticsPartitionCreation } from '../src/modules/jobs/partition.job';
import { runExpiredOtpPurge } from '../src/modules/jobs/purge-otp.job';
import { runGuestPiiPurge } from '../src/modules/jobs/purge-pii.job';
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);

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

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  } catch {
    return true;
  }
}

async function requestJob(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

async function smokeDirectPartition(): Promise<void> {
  try {
    const target = await runAnalyticsPartitionCreation({ year: 2099, month: 1 });
    if (target.partition !== 'analytics_events_2099_01') {
      fail('direct partition name', target.partition);
      return;
    }
    pass('direct partition RPC', target.partition);

    const { error } = await supabaseAdmin.rpc('create_analytics_partition', {
      partition_name: 'analytics_events_2099_01',
      start_date: '2099-01-01',
      end_date: '2099-02-01',
    });
    if (error) {
      fail('partition idempotent', error.message);
      return;
    }
    pass('direct partition idempotent', 'IF NOT EXISTS ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('create_analytics_partition')) {
      fail(
        'direct partition RPC',
        'function missing on Supabase — run `supabase db push` from repo root',
      );
    } else {
      fail('direct partition RPC', msg);
    }
  }
}

async function smokeDirectPurge(): Promise<void> {
  const testHash = `smoke-purge-${Date.now()}`;
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('guest_pii')
    .insert({
      phone_hash: testHash,
      phone_encrypted: 'smoke-enc',
      name_encrypted: 'smoke-name-enc',
      purge_after: new Date(Date.now() - 60_000).toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    fail('seed guest_pii row', insertError?.message ?? 'no id');
    return;
  }
  pass('seed expired guest_pii', inserted.id as string);

  const { purged } = await runGuestPiiPurge({ batchSize: 10 });
  if (purged < 1) {
    fail('direct purge count', `expected >= 1, got ${purged}`);
    return;
  }
  pass('direct purge', `purged=${purged}`);

  const { data: stillThere } = await supabaseAdmin
    .from('guest_pii')
    .select('id')
    .eq('id', inserted.id as string)
    .maybeSingle();

  if (stillThere) {
    fail('guest_pii removed', 'row still exists');
  } else {
    pass('guest_pii removed', 'ok');
  }
}

async function smokeDirectOtpPurge(): Promise<void> {
  const phoneHash = `smoke-otp-${Date.now()}`;
  const past = new Date(Date.now() - 60_000).toISOString();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('otp_verifications')
    .insert({
      phone_hash: phoneHash,
      code_hash: 'deadbeef',
      expires_at: past,
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    fail('seed expired otp', insertError?.message ?? 'no id');
    return;
  }
  pass('seed expired otp', inserted.id as string);

  const { deleted } = await runExpiredOtpPurge();
  if (deleted < 1) {
    fail('direct otp purge count', `expected >= 1, got ${deleted}`);
    return;
  }
  pass('direct otp purge', `deleted=${deleted}`);
}

async function smokeHttpEndpoints(): Promise<void> {
  const hasSigningKeys =
    Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY) &&
    Boolean(process.env.QSTASH_NEXT_SIGNING_KEY);

  const partitionRes = await requestJob('/api/v1/jobs/create-analytics-partition', {
    year: 2099,
    month: 2,
  });

  if (!hasSigningKeys && process.env.APP_ENV === 'development') {
    if (partitionRes.status === 200) {
      pass('HTTP partition (dev, no keys)', String(partitionRes.body.partition ?? 'ok'));
    } else {
      fail('HTTP partition (dev, no keys)', `status ${partitionRes.status}`);
    }
  } else if (partitionRes.status === 401) {
    pass('HTTP partition unsigned blocked', '401 as expected — use QStash publish or schedules');
  } else if (partitionRes.status === 200) {
    pass('HTTP partition', String(partitionRes.body.partition ?? 'ok'));
  } else {
    fail('HTTP partition', `status ${partitionRes.status} ${JSON.stringify(partitionRes.body)}`);
  }

  const purgeRes = await requestJob('/api/v1/jobs/purge-guest-pii', { batchSize: 10 });
  if (!hasSigningKeys && process.env.APP_ENV === 'development') {
    if (purgeRes.status === 200) {
      pass('HTTP purge (dev, no keys)', `purged=${purgeRes.body.purged}`);
    } else {
      fail('HTTP purge (dev, no keys)', `status ${purgeRes.status}`);
    }
  } else if (purgeRes.status === 401) {
    pass('HTTP purge unsigned blocked', '401 as expected');
  } else if (purgeRes.status === 200) {
    pass('HTTP purge', `purged=${purgeRes.body.purged}`);
  } else {
    fail('HTTP purge', `status ${purgeRes.status}`);
  }

  const otpPurgeRes = await requestJob('/api/v1/jobs/purge-expired-otps', {});
  if (!hasSigningKeys && process.env.APP_ENV === 'development') {
    if (otpPurgeRes.status === 200) {
      pass('HTTP purge-expired-otps (dev, no keys)', `deleted=${otpPurgeRes.body.deleted}`);
    } else {
      fail('HTTP purge-expired-otps (dev, no keys)', `status ${otpPurgeRes.status}`);
    }
  } else if (otpPurgeRes.status === 401) {
    pass('HTTP purge-expired-otps unsigned blocked', '401 as expected');
  } else if (otpPurgeRes.status === 200) {
    pass('HTTP purge-expired-otps', `deleted=${otpPurgeRes.body.deleted}`);
  } else {
    fail('HTTP purge-expired-otps', `status ${otpPurgeRes.status}`);
  }
}

async function smokeQStashPublish(): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const targetUrl = process.env.APP_URL ?? BASE_URL;

  if (process.env.SMOKE_JOBS_USE_QSTASH !== '1') {
    console.log('  · QStash publish skipped (set SMOKE_JOBS_USE_QSTASH=1 to enable)');
    return;
  }

  if (!token) {
    fail('QStash publish', 'QSTASH_TOKEN missing');
    return;
  }

  if (isLocalUrl(targetUrl)) {
    fail(
      'QStash publish',
      `APP_URL is local (${targetUrl}) — QStash cannot reach localhost. Use ngrok or staging APP_URL.`,
    );
    return;
  }

  const client = new Client({ token });
  const purgeMsg = await client.publishJSON({
    url: `${targetUrl.replace(/\/$/, '')}/api/v1/jobs/purge-guest-pii`,
    body: { batchSize: 10 },
  });
  pass('QStash publish purge', purgeMsg.messageId);

  const partitionMsg = await client.publishJSON({
    url: `${targetUrl.replace(/\/$/, '')}/api/v1/jobs/create-analytics-partition`,
    body: { year: 2099, month: 3 },
  });
  pass('QStash publish partition', partitionMsg.messageId);
  console.log('  · Check target server logs for job completion (async delivery)');
}

async function main(): Promise<void> {
  console.log('LetsSplyt smoke:jobs');
  console.log(`  BASE_URL=${BASE_URL}`);
  console.log(`  APP_ENV=${process.env.APP_ENV ?? '(unset)'}`);
  console.log('');

  console.log('1) Direct job handlers (Supabase — no HTTP, no QStash schedule)');
  await smokeDirectPartition();
  await smokeDirectPurge();
  await smokeDirectOtpPurge();
  console.log('');

  console.log('2) HTTP endpoints (backend must be running)');
  try {
    await smokeHttpEndpoints();
  } catch (err) {
    fail('HTTP reachability', err instanceof Error ? err.message : String(err));
  }
  console.log('');

  console.log('3) Optional QStash publish (one-shot, not a schedule)');
  await smokeQStashPublish();
  console.log('');

  const failed = results.filter((r) => !r.ok);
  console.log(`Result: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
