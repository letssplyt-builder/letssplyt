/**
 * Live smoke test for POST /api/v1/receipts/confirm and receipt_review on GET /events/:id.
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npx ts-node scripts/smoke-receipts-confirm.ts
 */
import { randomUUID } from 'crypto';
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
  await supabaseAdmin.from('receipt_items').delete().eq('event_id', eventId);
  await supabaseAdmin.from('participants').delete().eq('event_id', eventId);
  await supabaseAdmin.from('event_join_tokens').delete().eq('event_id', eventId);
  await supabaseAdmin.from('events').delete().eq('id', eventId);
}

async function main(): Promise<void> {
  console.log(`Smoke: receipts confirm (${BASE_URL})\n`);

  let eventId: string | null = null;

  try {
    const health = await requestJson('GET', '/health');
    if (health.status === 200) {
      pass('GET /health', `status ${health.status}`);
    } else {
      fail('GET /health', `status ${health.status}`);
      return;
    }

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
      { title: `Smoke Receipt Confirm ${Date.now()}` },
      accessToken,
    );
    const newEventId = created.body.id as string | undefined;
    if (created.status !== 201 || !newEventId) {
      fail('POST /events', `status ${created.status} ${JSON.stringify(created.body)}`);
      return;
    }
    eventId = newEventId;
    pass('POST /events', eventId);

    const addParticipant = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/participants/manual`,
      { display_name: 'Smoke Guest', join_method: 'manual_name_only' },
      accessToken,
    );
    if (addParticipant.status !== 201) {
      fail('POST /participants/manual', `status ${addParticipant.status}`);
      return;
    }
    pass('POST /participants/manual');

    const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, accessToken);
    if (locked.status !== 200) {
      fail('POST /events/:id/lock', `status ${locked.status} ${JSON.stringify(locked.body)}`);
      return;
    }
    pass('POST /events/:id/lock');

    const { error: stageError } = await supabaseAdmin
      .from('events')
      .update({
        ai_stage: 'parsed',
        tax_amount: 1,
        tip_amount: 2,
        fees_amount: 3,
        total_amount: 20,
        receipt_scan_attempted: true,
      })
      .eq('id', eventId);

    if (stageError) {
      fail('DB seed parsed stage', stageError.message);
      return;
    }

    await supabaseAdmin.from('receipt_items').delete().eq('event_id', eventId);
    const { error: itemsError } = await supabaseAdmin.from('receipt_items').insert([
      {
        id: randomUUID(),
        event_id: eventId,
        name: 'Burger',
        unit_price: 10,
        quantity: 1,
        confidence_score: 0.95,
        is_low_confidence: false,
        is_tax: false,
        is_tip: false,
        is_fee: false,
        is_shared: false,
        ai_extracted: true,
      },
      {
        id: randomUUID(),
        event_id: eventId,
        name: 'SVC Fee',
        unit_price: 3,
        quantity: 1,
        confidence_score: 0.9,
        is_low_confidence: false,
        is_tax: false,
        is_tip: false,
        is_fee: true,
        is_shared: false,
        ai_extracted: true,
      },
    ]);

    if (itemsError) {
      fail('DB seed receipt_items', itemsError.message);
      return;
    }
    pass('DB seed parsed + receipt_items');

    const beforeConfirm = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const review = beforeConfirm.body.receipt_review as Record<string, unknown> | undefined;
    if (beforeConfirm.status === 200 && review && Array.isArray(review.items)) {
      pass('GET /events/:id receipt_review', `${(review.items as unknown[]).length} items`);
    } else {
      fail(
        'GET /events/:id receipt_review',
        `status ${beforeConfirm.status} review=${JSON.stringify(review)}`,
      );
    }

    const confirmBody = {
      event_id: eventId,
      items: [{ name: 'Burger', price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 3 }],
      tax: 1,
      fees: 3,
      tip: 2,
    };

    const confirm = await requestJson('POST', '/api/v1/receipts/confirm', confirmBody, accessToken);
    const confirmed = confirm.body.confirmed as boolean | undefined;
    const totalAmount = confirm.body.total_amount as number | undefined;
    if (confirm.status === 200 && confirmed === true && totalAmount === 16) {
      pass('POST /receipts/confirm', `total_amount=${totalAmount}`);
    } else {
      fail('POST /receipts/confirm', `status ${confirm.status} ${JSON.stringify(confirm.body)}`);
    }

    const afterConfirm = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const eventPayload = afterConfirm.body.event as { ai_stage?: string } | undefined;
    const aiStage = eventPayload?.ai_stage;
    if (afterConfirm.status === 200 && aiStage === 'parsed_confirmed') {
      pass('GET /events/:id event.ai_stage', aiStage);
    } else {
      fail('GET /events/:id event.ai_stage', `status ${afterConfirm.status} ai_stage=${aiStage}`);
    }

    const { data: dbEvent } = await supabaseAdmin
      .from('events')
      .select('ai_stage, total_amount, tax_amount, tip_amount, fees_amount')
      .eq('id', eventId)
      .maybeSingle();

    if (dbEvent?.ai_stage === 'parsed_confirmed' && dbEvent.total_amount === 16) {
      pass('DB events row', `total=${dbEvent.total_amount} tax=${dbEvent.tax_amount}`);
    } else {
      fail('DB events row', JSON.stringify(dbEvent));
    }

    const { data: dbItems } = await supabaseAdmin
      .from('receipt_items')
      .select('name, is_fee, unit_price')
      .eq('event_id', eventId)
      .order('is_fee', { ascending: true });

    const foodCount = (dbItems ?? []).filter((r) => !r.is_fee).length;
    const feeCount = (dbItems ?? []).filter((r) => r.is_fee).length;
    if (foodCount === 1 && feeCount === 1) {
      pass('DB receipt_items', `food=${foodCount} fee=${feeCount}`);
    } else {
      fail('DB receipt_items', JSON.stringify(dbItems));
    }

    const reject = await requestJson('POST', '/api/v1/receipts/confirm', confirmBody, accessToken);
    const rejectError = reject.body.error as { code?: string } | undefined;
    if (reject.status === 400 && rejectError?.code === 'INVALID_AI_STAGE') {
      pass('POST /receipts/confirm reject', rejectError.code);
    } else {
      fail('POST /receipts/confirm reject', `status ${reject.status} ${JSON.stringify(reject.body)}`);
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
