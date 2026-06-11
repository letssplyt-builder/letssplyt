import type { Assignment } from '@letssplyt/shared/utils/splitCalculator';
import {
  calculateSplits,
  fromMinorUnits,
  toMinorUnits,
  type ConfirmedReceiptItem,
  type ParticipantSplit,
  type ReceiptTotals,
} from '@letssplyt/shared/utils/splitCalculator';
import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  assertEventOwner,
  fetchEventRow,
  type EventRowWithReceiptFields,
} from '../events/event.service';
import { assignItems, calculateEvenSplits, calculatePortionSplits } from './a2.agent';
import { setAiStage } from './a2-idempotency';

export interface SplitParticipantRow {
  id: string;
  display_name: string;
}

export interface CalculateSplitBody {
  split_mode: 'equal' | 'itemised' | 'portion';
  assignments?: Array<{ item_id: string; participant_ids: string[] }>;
  nlp_instruction?: string;
  manual_splits?: Array<{ participant_id: string; value: number }>;
  manual_total?: number;
}

export interface SplitCalculateResponse {
  splits: Array<{
    participant_id: string;
    display_name: string;
    amount_owed: number;
    item_names: string[];
  }>;
  total_check: number;
  unassigned_item_ids: string[];
  confidence: number;
  requires_review: boolean;
}

export interface AssignSplitResponse {
  status: 'complete' | 'partial';
  assignments: Array<{ item_id: string; participant_ids: string[] }>;
  unassigned_item_ids: string[];
  confidence: number;
  requires_review: boolean;
  message: string | null;
}

const CONFIRMED_STAGES = new Set([
  'parsed_confirmed',
  'calculating',
  'calculated',
  'messaging',
  'complete',
]);

async function loadParticipants(eventId: string): Promise<SplitParticipantRow[]> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('id, display_name')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    display_name: row.display_name as string,
  }));
}

async function loadFoodItems(eventId: string): Promise<ConfirmedReceiptItem[]> {
  const { data, error } = await supabaseAdmin
    .from('receipt_items')
    .select('id, name, unit_price, quantity, is_fee')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('RECEIPT_ITEMS_FETCH_FAILED', 'Could not load receipt items', 500);
  }

  return (data ?? [])
    .filter((row) => !row.is_fee)
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      unit_price: Number(row.unit_price),
      quantity: Number(row.quantity),
    }));
}

function buildReceiptTotals(
  eventRow: EventRowWithReceiptFields,
  foodItems: ConfirmedReceiptItem[],
  manualTotal?: number,
): ReceiptTotals {
  const subtotal = Number(
    foodItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0).toFixed(2),
  );
  const tax = Number(eventRow.tax_amount ?? 0);
  const fees = Number(eventRow.fees_amount ?? 0);
  const tip = Number(eventRow.tip_amount ?? 0);
  const total =
    manualTotal !== undefined
      ? Number(manualTotal.toFixed(2))
      : Number(eventRow.total_amount ?? subtotal + tax + fees + tip);

  return { subtotal, tax, fees, tip, total };
}

function mapParticipantIdsToNames(
  participantIds: string[],
  participants: SplitParticipantRow[],
): string[] {
  const byId = new Map(participants.map((p) => [p.id, p.display_name]));
  const names: string[] = [];
  for (const id of participantIds) {
    const name = byId.get(id);
    if (!name) {
      throw new AppError('VALIDATION_ERROR', `Unknown participant_id: ${id}`, 400);
    }
    names.push(name);
  }
  return names;
}

function toCalculatorAssignments(
  rows: Array<{ item_id: string; participant_ids: string[] }>,
  participants: SplitParticipantRow[],
): Assignment[] {
  return rows.map((row) => ({
    item_id: row.item_id,
    assigned_to: mapParticipantIdsToNames(row.participant_ids, participants),
  }));
}

function itemNamesForParticipant(
  participantName: string,
  assignments: Assignment[],
  items: ConfirmedReceiptItem[],
): string[] {
  const itemMap = new Map(items.map((item) => [item.id, item.name]));
  const names: string[] = [];
  for (const assignment of assignments) {
    if (assignment.assigned_to.includes(participantName)) {
      const name = itemMap.get(assignment.item_id);
      if (name) names.push(name);
    }
  }
  return names;
}

function buildSplitResponse(
  splits: ParticipantSplit[],
  participants: SplitParticipantRow[],
  assignments: Assignment[],
  foodItems: ConfirmedReceiptItem[],
  unassignedItemIds: string[],
  confidence: number,
  requiresReview: boolean,
  total: number,
): SplitCalculateResponse {
  const nameToId = new Map(participants.map((p) => [p.display_name, p.id]));

  const responseSplits = splits.map((split) => {
    const participantId = nameToId.get(split.participantName);
    if (!participantId) {
      throw new AppError('INTERNAL_ERROR', `Split name not found: ${split.participantName}`, 500);
    }
    return {
      participant_id: participantId,
      display_name: split.participantName,
      amount_owed: split.amountOwed,
      item_names: itemNamesForParticipant(split.participantName, assignments, foodItems),
    };
  });

  const totalCheck = Number(
    responseSplits.reduce((sum, row) => sum + row.amount_owed, 0).toFixed(2),
  );

  return {
    splits: responseSplits,
    total_check: totalCheck,
    unassigned_item_ids: unassignedItemIds,
    confidence,
    requires_review: requiresReview,
  };
}

async function persistItemAssignments(
  eventId: string,
  assignments: Assignment[],
  participants: SplitParticipantRow[],
  foodItems: ConfirmedReceiptItem[],
  currencyCode: string,
  method: 'nlp' | 'manual' | 'even' | 'drag',
): Promise<void> {
  const nameToId = new Map(participants.map((p) => [p.display_name, p.id]));
  const itemMap = new Map(foodItems.map((item) => [item.id, item]));

  const { error: deleteError } = await supabaseAdmin
    .from('item_assignments')
    .delete()
    .in(
      'item_id',
      foodItems.map((item) => item.id),
    );

  if (deleteError) {
    throw new AppError('DB_WRITE_FAILED', deleteError.message, 500);
  }

  const rows: Array<{
    item_id: string;
    participant_id: string;
    share_amount: number;
    assignment_method: string;
  }> = [];

  for (const assignment of assignments) {
    const item = itemMap.get(assignment.item_id);
    if (!item) continue;

    const totalItemMinor = toMinorUnits(item.unit_price * item.quantity, currencyCode);
    const sharePerPersonMinor = Math.floor(totalItemMinor / assignment.assigned_to.length);
    const remainderMinor = totalItemMinor % assignment.assigned_to.length;

    for (let i = 0; i < assignment.assigned_to.length; i++) {
      const name = assignment.assigned_to[i];
      const participantId = nameToId.get(name);
      if (!participantId) continue;

      const extra = i === 0 ? remainderMinor : 0;
      const shareMinor = sharePerPersonMinor + extra;
      rows.push({
        item_id: assignment.item_id,
        participant_id: participantId,
        share_amount: fromMinorUnits(shareMinor, currencyCode),
        assignment_method: method,
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('item_assignments').insert(rows);
    if (insertError) {
      throw new AppError('DB_WRITE_FAILED', insertError.message, 500);
    }
  }

  await supabaseAdmin.from('events').update({ split_mode: 'itemised' }).eq('id', eventId);
}

async function assertReceiptConfirmed(eventRow: EventRowWithReceiptFields): Promise<void> {
  if (!CONFIRMED_STAGES.has(eventRow.ai_stage)) {
    throw new AppError(
      'RECEIPT_NOT_CONFIRMED',
      'Receipt must be confirmed before calculating splits',
      409,
    );
  }
}

export async function assignSplitsWithNlp(
  userId: string,
  eventId: string,
  rawText: string,
): Promise<AssignSplitResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);
  await assertReceiptConfirmed(eventRow);

  const participants = await loadParticipants(eventId);
  const foodItems = await loadFoodItems(eventId);
  const totals = buildReceiptTotals(eventRow, foodItems);
  const currency = eventRow.currency ?? 'USD';

  const result = await assignItems(
    eventId,
    rawText,
    foodItems,
    participants,
    totals,
    currency,
  );

  if (result.status === 'complete') {
    await persistItemAssignments(
      eventId,
      result.assignments,
      participants,
      foodItems,
      currency,
      'nlp',
    );
  }

  const participantIdsByName = new Map(participants.map((p) => [p.display_name, p.id]));

  return {
    status: result.status,
    assignments: result.assignments.map((row) => ({
      item_id: row.item_id,
      participant_ids: row.assigned_to.map((name) => {
        const id = participantIdsByName.get(name);
        if (!id) {
          throw new AppError('INTERNAL_ERROR', `Unknown participant name: ${name}`, 500);
        }
        return id;
      }),
    })),
    unassigned_item_ids: result.unassignedItemIds,
    confidence: result.confidence,
    requires_review: result.requiresReview,
    message: result.message,
  };
}

export async function calculateEventSplits(
  userId: string,
  eventId: string,
  body: CalculateSplitBody,
): Promise<SplitCalculateResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  const participants = await loadParticipants(eventId);
  if (participants.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Event has no participants', 400);
  }

  const foodItems = await loadFoodItems(eventId);
  const currency = eventRow.currency ?? 'USD';
  const totals = buildReceiptTotals(eventRow, foodItems, body.manual_total);

  if (body.split_mode === 'equal') {
    const participantNames = participants.map((p) => p.display_name);
    const splits = calculateEvenSplits(totals.total, participantNames, currency);
    await setAiStage(eventId, 'calculated');
    await supabaseAdmin
      .from('events')
      .update({
        split_mode: 'equal',
        ...(body.manual_total !== undefined
          ? { total_amount: Number(body.manual_total.toFixed(2)) }
          : {}),
      })
      .eq('id', eventId);

    return buildSplitResponse(
      splits,
      participants,
      [],
      foodItems,
      [],
      1,
      false,
      totals.total,
    );
  }

  if (body.split_mode === 'portion') {
    if (!body.manual_splits?.length) {
      throw new AppError('VALIDATION_ERROR', 'manual_splits required for portion mode', 400);
    }

    const byId = new Map(participants.map((p) => [p.id, p.display_name]));
    const weights = body.manual_splits.map((row) => {
      const name = byId.get(row.participant_id);
      if (!name) {
        throw new AppError('VALIDATION_ERROR', `Unknown participant_id: ${row.participant_id}`, 400);
      }
      return { name, weight: row.value };
    });

    const splits = calculatePortionSplits(totals.total, weights, currency);
    await setAiStage(eventId, 'calculated');
    await supabaseAdmin
      .from('events')
      .update({
        split_mode: 'portion',
        ...(body.manual_total !== undefined
          ? { total_amount: Number(body.manual_total.toFixed(2)) }
          : {}),
      })
      .eq('id', eventId);

    return buildSplitResponse(
      splits,
      participants,
      [],
      foodItems,
      [],
      1,
      false,
      totals.total,
    );
  }

  // itemised
  await assertReceiptConfirmed(eventRow);

  if (body.nlp_instruction?.trim()) {
    const nlpResult = await assignItems(
      eventId,
      body.nlp_instruction.trim(),
      foodItems,
      participants,
      totals,
      currency,
    );

    if (nlpResult.status === 'partial') {
      return buildSplitResponse(
        nlpResult.splits,
        participants,
        nlpResult.assignments,
        foodItems,
        nlpResult.unassignedItemIds,
        nlpResult.confidence,
        true,
        totals.total,
      );
    }

    await persistItemAssignments(
      eventId,
      nlpResult.assignments,
      participants,
      foodItems,
      currency,
      'nlp',
    );

    return buildSplitResponse(
      nlpResult.splits,
      participants,
      nlpResult.assignments,
      foodItems,
      [],
      nlpResult.confidence,
      nlpResult.requiresReview,
      totals.total,
    );
  }

  if (!body.assignments?.length) {
    throw new AppError(
      'VALIDATION_ERROR',
      'assignments or nlp_instruction required for itemised mode',
      400,
    );
  }

  const calculatorAssignments = toCalculatorAssignments(body.assignments, participants);

  let splits: ParticipantSplit[];
  try {
    splits = calculateSplits(
      foodItems,
      calculatorAssignments,
      totals,
      participants.map((p) => p.display_name),
      currency,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Sum invariant')) {
      throw new AppError('SUM_INVARIANT_VIOLATED', message, 500);
    }
    throw new AppError('VALIDATION_ERROR', message, 400);
  }

  await persistItemAssignments(
    eventId,
    calculatorAssignments,
    participants,
    foodItems,
    currency,
    'manual',
  );
  await setAiStage(eventId, 'calculated');

  return buildSplitResponse(
    splits,
    participants,
    calculatorAssignments,
    foodItems,
    [],
    1,
    false,
    totals.total,
  );
}

export interface ConfirmSplitBody {
  splits: Array<{ participant_id: string; amount_owed: number }>;
}

export interface ConfirmSplitResponse {
  confirmed: true;
  event_status: string;
  ai_stage: 'calculated';
  splits: Array<{ participant_id: string; amount_owed: number }>;
}

function isSumWithinTolerance(sum: number, expected: number): boolean {
  return Math.abs(sum - expected) <= 0.01;
}

export async function confirmEventSplit(
  userId: string,
  eventId: string,
  body: ConfirmSplitBody,
): Promise<ConfirmSplitResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'locked') {
    throw new AppError('EVENT_NOT_LOCKED', 'Event must be locked before confirming split', 409);
  }

  if (!body.splits.length) {
    throw new AppError('VALIDATION_ERROR', 'splits array is required', 400);
  }

  const participants = await loadParticipants(eventId);
  const participantIds = new Set(participants.map((p) => p.id));

  for (const split of body.splits) {
    if (!participantIds.has(split.participant_id)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Unknown participant_id: ${split.participant_id}`,
        400,
      );
    }
    if (split.amount_owed < 0) {
      throw new AppError('VALIDATION_ERROR', 'amount_owed must be non-negative', 400);
    }
  }

  const sum = Number(
    body.splits.reduce((acc, row) => acc + row.amount_owed, 0).toFixed(2),
  );

  const storedTotal =
    eventRow.total_amount !== null && eventRow.total_amount !== undefined
      ? Number(eventRow.total_amount)
      : 0;
  const expectedTotal = storedTotal > 0 ? storedTotal : sum;

  if (!isSumWithinTolerance(sum, expectedTotal)) {
    throw new AppError(
      'SUM_MISMATCH',
      `Split total ${sum} does not match event total ${storedTotal > 0 ? storedTotal : expectedTotal}`,
      400,
    );
  }

  for (const split of body.splits) {
    const { error } = await supabaseAdmin
      .from('participants')
      .update({ amount_owed: split.amount_owed })
      .eq('id', split.participant_id)
      .eq('event_id', eventId);

    if (error) {
      throw new AppError('DB_WRITE_FAILED', error.message, 500);
    }
  }

  if (storedTotal <= 0) {
    const { error: totalError } = await supabaseAdmin
      .from('events')
      .update({ total_amount: sum })
      .eq('id', eventId);
    if (totalError) {
      throw new AppError('DB_WRITE_FAILED', totalError.message, 500);
    }
  }

  await setAiStage(eventId, 'calculated');

  return {
    confirmed: true,
    event_status: eventRow.status,
    ai_stage: 'calculated',
    splits: body.splits.map((row) => ({
      participant_id: row.participant_id,
      amount_owed: row.amount_owed,
    })),
  };
}

export interface SplitAssignmentsResponse {
  assignments: Array<{ item_id: string; participant_ids: string[] }>;
}

export async function getSplitAssignments(
  userId: string,
  eventId: string,
): Promise<SplitAssignmentsResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  const { data, error } = await supabaseAdmin
    .from('item_assignments')
    .select('item_id, participant_id, receipt_items!inner(event_id)')
    .eq('receipt_items.event_id', eventId);

  if (error) {
    throw new AppError('ITEM_ASSIGNMENTS_FETCH_FAILED', 'Could not load item assignments', 500);
  }

  const byItem = new Map<string, string[]>();
  for (const row of data ?? []) {
    const itemId = row.item_id as string;
    const participantId = row.participant_id as string;
    const existing = byItem.get(itemId) ?? [];
    if (!existing.includes(participantId)) {
      existing.push(participantId);
    }
    byItem.set(itemId, existing);
  }

  return {
    assignments: [...byItem.entries()].map(([item_id, participant_ids]) => ({
      item_id,
      participant_ids,
    })),
  };
}
