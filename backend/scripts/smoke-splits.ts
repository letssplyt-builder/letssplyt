/**
 * Live smoke test for split calculate + NLP assign APIs (E07-S05).
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npx ts-node scripts/smoke-splits.ts
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
  const { data: items } = await supabaseAdmin
    .from('receipt_items')
    .select('id')
    .eq('event_id', eventId);
  const itemIds = (items ?? []).map((row) => row.id as string);
  if (itemIds.length > 0) {
    await supabaseAdmin.from('item_assignments').delete().in('item_id', itemIds);
  }
  await supabaseAdmin.from('receipt_items').delete().eq('event_id', eventId);
  await supabaseAdmin.from('participants').delete().eq('event_id', eventId);
  await supabaseAdmin.from('event_join_tokens').delete().eq('event_id', eventId);
  await supabaseAdmin.from('events').delete().eq('id', eventId);
}

async function setupConfirmedEvent(accessToken: string): Promise<{
  eventId: string;
  payerParticipantId: string;
  guestParticipantId: string;
  payerDisplayName: string;
  guestDisplayName: string;
  burgerItemId: string;
  saladItemId: string;
} | null> {
  const created = await requestJson(
    'POST',
    '/api/v1/events',
    { title: `Smoke Splits ${Date.now()}` },
    accessToken,
  );
  const eventId = created.body.id as string | undefined;
  if (created.status !== 201 || !eventId) {
    fail('POST /events', `status ${created.status} ${JSON.stringify(created.body)}`);
    return null;
  }
  pass('POST /events', eventId);

  const addGuest = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/participants/manual`,
    { display_name: 'Jordan', join_method: 'manual_name_only' },
    accessToken,
  );
  const guestParticipantId = addGuest.body.id as string | undefined;
  if (addGuest.status !== 201 || !guestParticipantId) {
    fail('POST /participants/manual', `status ${addGuest.status}`);
    await cleanup(eventId);
    return null;
  }
  pass('POST /participants/manual', guestParticipantId);

  const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, accessToken);
  if (locked.status !== 200) {
    fail('POST /events/:id/lock', `status ${locked.status}`);
    await cleanup(eventId);
    return null;
  }
  pass('POST /events/:id/lock');

  const { data: eventRow } = await supabaseAdmin
    .from('events')
    .select('payer_id')
    .eq('id', eventId)
    .maybeSingle();

  const { data: participants } = await supabaseAdmin
    .from('participants')
    .select('id, display_name, user_id')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  const payerId = eventRow?.payer_id as string;
  const payerParticipant = (participants ?? []).find((row) => row.user_id === payerId);
  const payerParticipantId = payerParticipant?.id as string | undefined;
  if (!payerParticipantId) {
    fail('DB payer participant', JSON.stringify(participants));
    await cleanup(eventId);
    return null;
  }
  pass('DB payer participant', payerParticipant?.display_name as string);

  const burgerItemId = randomUUID();
  const saladItemId = randomUUID();

  await supabaseAdmin.from('events').update({
    ai_stage: 'parsed',
    tax_amount: 2.4,
    tip_amount: 3,
    fees_amount: 0,
    total_amount: 35.4,
    receipt_scan_attempted: true,
  }).eq('id', eventId);

  await supabaseAdmin.from('receipt_items').insert([
    {
      id: burgerItemId,
      event_id: eventId,
      name: 'Burger',
      unit_price: 18,
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
      id: saladItemId,
      event_id: eventId,
      name: 'Salad',
      unit_price: 12,
      quantity: 1,
      confidence_score: 0.9,
      is_low_confidence: false,
      is_tax: false,
      is_tip: false,
      is_fee: false,
      is_shared: false,
      ai_extracted: true,
    },
  ]);

  const confirm = await requestJson(
    'POST',
    '/api/v1/receipts/confirm',
    {
      event_id: eventId,
      items: [
        { id: burgerItemId, name: 'Burger', price: 18, quantity: 1 },
        { id: saladItemId, name: 'Salad', price: 12, quantity: 1 },
      ],
      additional_charges: [],
      tax: 2.4,
      fees: 0,
      tip: 3,
    },
    accessToken,
  );

  if (confirm.status !== 200 || confirm.body.confirmed !== true) {
    fail('POST /receipts/confirm', `status ${confirm.status} ${JSON.stringify(confirm.body)}`);
    await cleanup(eventId);
    return null;
  }
  pass('POST /receipts/confirm', `total=${confirm.body.total_amount}`);

  const guestParticipant = (participants ?? []).find((row) => row.id === guestParticipantId);

  return {
    eventId,
    payerParticipantId,
    guestParticipantId,
    payerDisplayName: payerParticipant?.display_name as string,
    guestDisplayName: (guestParticipant?.display_name as string) ?? 'Jordan',
    burgerItemId,
    saladItemId,
  };
}

async function main(): Promise<void> {
  console.log(`Smoke: splits API (${BASE_URL})\n`);

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

    const setup = await setupConfirmedEvent(accessToken);
    if (!setup) return;

    eventId = setup.eventId;
    const {
      payerParticipantId,
      guestParticipantId,
      payerDisplayName,
      guestDisplayName,
      burgerItemId,
      saladItemId,
    } = setup;

    const equal = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      { split_mode: 'equal' },
      accessToken,
    );
    const equalSplits = equal.body.splits as Array<{ amount_owed: number }> | undefined;
    const equalSum = equalSplits?.reduce((sum, row) => sum + row.amount_owed, 0) ?? 0;
    if (equal.status === 200 && equalSplits?.length === 2 && Math.abs(equalSum - 35.4) <= 0.02) {
      pass('POST split/calculate equal', `sum=${equalSum.toFixed(2)}`);
    } else {
      fail('POST split/calculate equal', `status ${equal.status} ${JSON.stringify(equal.body)}`);
    }

    await supabaseAdmin.from('events').update({ ai_stage: 'parsed_confirmed' }).eq('id', eventId);

    const itemised = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      {
        split_mode: 'itemised',
        assignments: [
          { item_id: burgerItemId, participant_ids: [payerParticipantId] },
          { item_id: saladItemId, participant_ids: [guestParticipantId] },
        ],
      },
      accessToken,
    );
    const itemisedSplits = itemised.body.splits as
      | Array<{ participant_id: string; amount_owed: number; item_names: string[] }>
      | undefined;
    const itemisedSum = itemisedSplits?.reduce((sum, row) => sum + row.amount_owed, 0) ?? 0;
    const payerRow = itemisedSplits?.find((row) => row.participant_id === payerParticipantId);
    if (
      itemised.status === 200 &&
      itemisedSplits?.length === 2 &&
      Math.abs(itemisedSum - 35.4) <= 0.02 &&
      payerRow?.item_names?.includes('Burger')
    ) {
      pass('POST split/calculate itemised', `sum=${itemisedSum.toFixed(2)} payer=$${payerRow.amount_owed}`);
    } else {
      fail('POST split/calculate itemised', `status ${itemised.status} ${JSON.stringify(itemised.body)}`);
    }

    const { data: assignmentRows } = await supabaseAdmin
      .from('item_assignments')
      .select('item_id, participant_id, assignment_method')
      .in('item_id', [burgerItemId, saladItemId]);

    if ((assignmentRows ?? []).length === 2) {
      pass('DB item_assignments', `${assignmentRows?.length} rows`);
    } else {
      fail('DB item_assignments', JSON.stringify(assignmentRows));
    }

    const { data: stageAfterItemised } = await supabaseAdmin
      .from('events')
      .select('ai_stage')
      .eq('id', eventId)
      .maybeSingle();

    if (stageAfterItemised?.ai_stage === 'calculated') {
      pass('DB ai_stage after itemised', stageAfterItemised.ai_stage);
    } else {
      fail('DB ai_stage after itemised', String(stageAfterItemised?.ai_stage));
    }

    await supabaseAdmin.from('events').update({ ai_stage: 'parsed_confirmed' }).eq('id', eventId);
    await supabaseAdmin.from('item_assignments').delete().in('item_id', [burgerItemId, saladItemId]);

    const portion = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      {
        split_mode: 'portion',
        manual_splits: [
          { participant_id: payerParticipantId, value: 2 },
          { participant_id: guestParticipantId, value: 1 },
        ],
      },
      accessToken,
    );
    const portionSplits = portion.body.splits as Array<{ amount_owed: number }> | undefined;
    const portionSum = portionSplits?.reduce((sum, row) => sum + row.amount_owed, 0) ?? 0;
    if (portion.status === 200 && Math.abs(portionSum - 35.4) <= 0.02) {
      pass('POST split/calculate portion', `sum=${portionSum.toFixed(2)}`);
    } else {
      fail('POST split/calculate portion', `status ${portion.status} ${JSON.stringify(portion.body)}`);
    }

    await supabaseAdmin.from('events').update({ ai_stage: 'parsed_confirmed' }).eq('id', eventId);

    const nlp = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/splits/assign`,
      {
        instruction: `${payerDisplayName} had the burger, ${guestDisplayName} had the salad`,
      },
      accessToken,
    );
    const nlpStatus = nlp.body.status as string | undefined;
    const nlpAssignments = nlp.body.assignments as Array<{ item_id: string; participant_ids: string[] }> | undefined;
    if (
      nlp.status === 200 &&
      nlpStatus === 'complete' &&
      nlpAssignments?.length === 2
    ) {
      pass(
        'POST splits/assign NLP',
        `assignments=${nlpAssignments.length} confidence=${nlp.body.confidence}`,
      );
    } else if (nlp.status === 500 && (nlp.body.error as { code?: string })?.code === 'SPLIT_CALCULATION_FAILED') {
      const llmDetail = (nlp.body.error as { message?: string })?.message ?? 'unknown';
      fail('POST splits/assign NLP', `SPLIT_CALCULATION_FAILED: ${llmDetail}`);
    } else {
      fail('POST splits/assign NLP', `status ${nlp.status} ${JSON.stringify(nlp.body)}`);
    }

    await supabaseAdmin.from('events').update({ ai_stage: 'parsed' }).eq('id', eventId);

    const reject = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      {
        split_mode: 'itemised',
        assignments: [{ item_id: burgerItemId, participant_ids: [payerParticipantId] }],
      },
      accessToken,
    );
    const rejectCode = (reject.body.error as { code?: string })?.code;
    if (reject.status === 409 && rejectCode === 'RECEIPT_NOT_CONFIRMED') {
      pass('POST split/calculate reject not confirmed', rejectCode);
    } else {
      fail('POST split/calculate reject', `status ${reject.status} ${JSON.stringify(reject.body)}`);
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
