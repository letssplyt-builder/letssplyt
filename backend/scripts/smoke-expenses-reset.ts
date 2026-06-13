/**
 * Live smoke test for POST /events/:id/expenses/reset (reset expense workflow).
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npx ts-node scripts/smoke-expenses-reset.ts
 */
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

async function cleanup(eventId: string): Promise<void> {
  const { data: items } = await supabaseAdmin
    .from('receipt_items')
    .select('id')
    .eq('event_id', eventId);
  const itemIds = (items ?? []).map((row) => row.id as string);
  if (itemIds.length > 0) {
    await supabaseAdmin.from('item_assignments').delete().in('item_id', itemIds);
  }
  await supabaseAdmin.from('receipt_items').delete().eq('event_id', eventId);
  await supabaseAdmin.from('ai_audit_log').delete().eq('event_id', eventId);
  await supabaseAdmin.from('participants').delete().eq('event_id', eventId);
  await supabaseAdmin.from('event_join_tokens').delete().eq('event_id', eventId);
  await supabaseAdmin.from('events').delete().eq('id', eventId);
}

async function main(): Promise<void> {
  console.log(`Smoke: expenses reset (${BASE_URL})\n`);

  let eventId: string | null = null;

  try {
    const health = await requestJson('GET', '/health');
    if (health.status !== 200) {
      fail('GET /health', `status ${health.status}`);
      return;
    }
    pass('GET /health', `status ${health.status}`);

    const verify = await requestJson('POST', '/api/v1/auth/otp/verify', {
      phone_e164: ALEX_PHONE,
      code: '123456',
      context: 'login',
    });
    const accessToken = verify.body.access_token as string | undefined;
    if (verify.status !== 200 || !accessToken) {
      fail('POST /auth/otp/verify', `status ${verify.status} ${JSON.stringify(verify.body)}`);
      return;
    }
    pass('POST /auth/otp/verify', 'token received');

    const created = await requestJson(
      'POST',
      '/api/v1/events',
      { title: `Smoke Reset ${Date.now()}` },
      accessToken,
    );
    const createdId = created.body.id as string | undefined;
    if (created.status !== 201 || !createdId) {
      fail('POST /events', `status ${created.status}`);
      return;
    }
    eventId = createdId;
    pass('POST /events', eventId);

    const addGuest = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/participants/manual`,
      { display_name: 'Jordan', join_method: 'manual_name_only' },
      accessToken,
    );
    if (addGuest.status !== 201) {
      fail('POST /participants/manual', `status ${addGuest.status}`);
      return;
    }
    pass('POST /participants/manual');

    const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, accessToken);
    if (locked.status !== 200) {
      fail('POST /events/:id/lock', `status ${locked.status}`);
      return;
    }
    pass('POST /events/:id/lock');

    const calculate = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      { split_mode: 'equal', manual_total: 84 },
      accessToken,
    );
    if (calculate.status !== 200) {
      fail('POST split/calculate equal', `status ${calculate.status} ${JSON.stringify(calculate.body)}`);
      return;
    }
    pass('POST split/calculate equal', 'manual_total=84');

    const detailBefore = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const eventBefore = detailBefore.body.event as { ai_stage?: string; total_amount?: number | null } | undefined;
    if (detailBefore.status === 200 && eventBefore?.ai_stage === 'calculated') {
      pass('GET /events/:id before reset', `ai_stage=${eventBefore.ai_stage}`);
    } else {
      fail('GET /events/:id before reset', JSON.stringify(detailBefore.body));
      return;
    }

    const reset = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/expenses/reset`,
      {},
      accessToken,
    );
    if (reset.status === 200 && reset.body.reset === true && reset.body.ai_stage === 'none') {
      pass('POST /events/:id/expenses/reset', 'reset=true');
    } else {
      fail('POST /events/:id/expenses/reset', `status ${reset.status} ${JSON.stringify(reset.body)}`);
      return;
    }

    const detailAfter = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const eventAfter = detailAfter.body.event as {
      ai_stage?: string;
      total_amount?: number | null;
      split_mode?: string | null;
    } | undefined;
    if (
      detailAfter.status === 200 &&
      eventAfter?.ai_stage === 'none' &&
      eventAfter.total_amount == null &&
      eventAfter.split_mode == null &&
      detailAfter.body.receipt_review === undefined
    ) {
      pass('GET /events/:id after reset', 'ai_stage=none, totals cleared');
    } else {
      fail('GET /events/:id after reset', JSON.stringify(detailAfter.body));
    }

    const { data: dbEvent } = await supabaseAdmin
      .from('events')
      .select('ai_stage, total_amount, receipt_scan_attempted, split_mode')
      .eq('id', eventId)
      .maybeSingle();

    if (
      dbEvent?.ai_stage === 'none' &&
      dbEvent.total_amount == null &&
      dbEvent.receipt_scan_attempted === false &&
      dbEvent.split_mode == null
    ) {
      pass('DB events row after reset', `ai_stage=${dbEvent.ai_stage}`);
    } else {
      fail('DB events row after reset', JSON.stringify(dbEvent));
    }

    const { count: itemCount } = await supabaseAdmin
      .from('receipt_items')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if ((itemCount ?? 0) === 0) {
      pass('DB receipt_items after reset', '0 rows');
    } else {
      fail('DB receipt_items after reset', `count=${itemCount}`);
    }

    const resetAgain = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/expenses/reset`,
      {},
      accessToken,
    );
    const againCode = (resetAgain.body.error as { code?: string } | undefined)?.code;
    if (resetAgain.status === 400 && againCode === 'NOTHING_TO_RESET') {
      pass('POST /events/:id/expenses/reset twice', againCode);
    } else {
      fail('POST /events/:id/expenses/reset twice', `status ${resetAgain.status} ${JSON.stringify(resetAgain.body)}`);
    }
  } finally {
    if (eventId) {
      await cleanup(eventId);
      console.log(`  (cleaned up event ${eventId})`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length === 0) {
    console.log(`All ${results.length} smoke checks passed.`);
    process.exit(0);
  } else {
    console.error(`${failed.length}/${results.length} checks failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
