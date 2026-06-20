import { createHash } from 'crypto';
import type { Assignment } from '@letssplyt/shared/utils/splitCalculator';
import {
  calculateSplits,
  fromMinorUnits,
  largestRemainderRound,
  type ConfirmedReceiptItem,
  type ParticipantSplit,
  type ReceiptTotals,
} from '@letssplyt/shared/utils/splitCalculator';
import { AppError } from '../../infrastructure/errors';
import { writeAuditLog } from '../../infrastructure/llm/ai-audit';
import { createLLMProvider } from '../../infrastructure/llm/factory';
import type { LLMMessage } from '../../infrastructure/llm/llm.provider';
import { buildA2Prompt, type A2Participant, type A2ReceiptItem } from './a2.prompt';
import { SplitAssignmentOutputSchema } from './a2.schema';
import {
  claimCalculatingSlot,
  setAiStage,
} from './a2-idempotency';

const MAX_RETRIES = parseInt(process.env.SPLIT_CALC_MAX_RETRIES ?? '3', 10);
const CONFIDENCE_THRESHOLD = parseFloat(process.env.A2_CONFIDENCE_THRESHOLD ?? '0.70');

export interface A2AssignmentResult {
  status: 'complete' | 'partial';
  assignments: Assignment[];
  unassignedItemIds: string[];
  splits: ParticipantSplit[];
  message: string | null;
  requiresReview: boolean;
  confidence: number;
  attempts: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number, baseMs = 500, maxMs = 10_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  return Math.floor(Math.random() * exponential);
}

function validateAssignmentsAgainstParticipants(
  assignments: Assignment[],
  participantNames: string[],
  itemIds: Set<string>,
): void {
  for (const assignment of assignments) {
    if (!itemIds.has(assignment.item_id)) {
      throw new Error(`AI referenced unknown item_id: ${assignment.item_id}`);
    }
    for (const name of assignment.assigned_to) {
      if (!participantNames.includes(name)) {
        throw new Error(`AI assigned to unknown participant: "${name}"`);
      }
    }
  }
}

/**
 * A2 NLP assignment — maps natural language to item assignments, then delegates math to splitCalculator.
 */
export async function assignItems(
  eventId: string,
  rawText: string,
  items: A2ReceiptItem[],
  participants: A2Participant[],
  totals: ReceiptTotals,
  currencyCode: string,
): Promise<A2AssignmentResult> {
  if (items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one receipt item is required', 400);
  }
  if (participants.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one participant is required', 400);
  }

  const claimed = await claimCalculatingSlot(eventId);
  if (!claimed) {
    throw new AppError(
      'ALREADY_PROCESSING',
      'Split calculation is already in progress or receipt is not confirmed',
      409,
    );
  }

  const participantNames = participants.map((p) => p.display_name);
  const confirmedItems: ConfirmedReceiptItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
  }));
  const itemIds = new Set(confirmedItems.map((item) => item.id));
  const provider = createLLMProvider('A2');
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let rawTextResponse: string | null = null;
    let promptText = '';

    try {
      promptText = buildA2Prompt(items, participants, rawText);
      const messages: LLMMessage[] = [{ role: 'user', content: promptText }];
      const response = await provider.complete(messages, { maxTokens: 512, timeout: 30_000 });
      rawTextResponse = response.text.trim();

      if (!rawTextResponse) {
        throw new Error('Empty response from model');
      }

      const jsonText = rawTextResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(jsonText);
      const validated = SplitAssignmentOutputSchema.parse(parsed);

      const assignments: Assignment[] = validated.assignments.map((row) => ({
        item_id: row.item_id,
        assigned_to: row.assigned_to,
      }));

      validateAssignmentsAgainstParticipants(assignments, participantNames, itemIds);

      writeAuditLog({
        eventId,
        agent: 'A2',
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        modelUsed: response.modelUsed,
        success: true,
        inputHash: sha256(promptText),
        outputHash: sha256(rawTextResponse),
        latencyMs: Date.now() - start,
        attempts: attempt,
      });

      if (validated.unassigned_item_ids.length > 0) {
        const assignedItems = confirmedItems.filter(
          (item) => !validated.unassigned_item_ids.includes(item.id),
        );
        const assignedSubtotal = assignedItems.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        );
        const partialTotals: ReceiptTotals = {
          ...totals,
          subtotal: Number(assignedSubtotal.toFixed(2)),
          total: Number(assignedSubtotal.toFixed(2)),
          tax: 0,
          fees: 0,
          tip: 0,
          discounts: 0,
        };
        const partialAssignments = assignments.filter(
          (row) => !validated.unassigned_item_ids.includes(row.item_id),
        );
        const partialSplits = calculateSplits(
          assignedItems,
          partialAssignments,
          partialTotals,
          participantNames,
          currencyCode,
        );

        await setAiStage(eventId, 'parsed_confirmed');

        return {
          status: 'partial',
          assignments: partialAssignments,
          unassignedItemIds: validated.unassigned_item_ids,
          splits: partialSplits,
          message: 'Some items could not be assigned. Please assign them manually.',
          requiresReview: true,
          confidence: validated.confidence,
          attempts: attempt,
        };
      }

      const splits = calculateSplits(
        confirmedItems,
        assignments,
        totals,
        participantNames,
        currencyCode,
      );

      await setAiStage(eventId, 'calculated');

      return {
        status: 'complete',
        assignments,
        unassignedItemIds: [],
        splits,
        message: null,
        requiresReview: validated.confidence < CONFIDENCE_THRESHOLD,
        confidence: validated.confidence,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      writeAuditLog({
        eventId,
        agent: 'A2',
        inputTokens: 0,
        outputTokens: 0,
        modelUsed: process.env.AI_MODEL_A2 ?? 'unknown',
        success: false,
        errorCode: lastError.message,
        inputHash: sha256(promptText),
        outputHash: sha256(rawTextResponse ?? ''),
        latencyMs: Date.now() - start,
        attempts: attempt,
      });

      if (attempt < MAX_RETRIES) {
        await sleep(getRetryDelay(attempt));
      }
    }
  }

  await setAiStage(eventId, 'failed');
  throw new AppError(
    'SPLIT_CALCULATION_FAILED',
    lastError?.message ?? 'Unknown error',
    500,
  );
}

/** Even split of a total across participant display names (no LLM). */
export function calculateEvenSplits(
  total: number,
  participantNames: string[],
  currencyCode: string,
): ParticipantSplit[] {
  const n = participantNames.length;
  const share = total / n;
  const minorAmounts = largestRemainderRound(Array(n).fill(share), currencyCode);
  return participantNames.map((name, index) => ({
    participantName: name,
    amountOwed: fromMinorUnits(minorAmounts[index], currencyCode),
  }));
}

/** Portion / weight-based split (no LLM). */
export function calculatePortionSplits(
  total: number,
  weights: Array<{ name: string; weight: number }>,
  currencyCode: string,
): ParticipantSplit[] {
  const weightSum = weights.reduce((sum, row) => sum + row.weight, 0);
  if (weightSum <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Portion weights must sum to a positive value', 400);
  }

  const fractionalShares = weights.map((row) => (total * row.weight) / weightSum);
  const minorAmounts = largestRemainderRound(fractionalShares, currencyCode);

  return weights.map((row, index) => ({
    participantName: row.name,
    amountOwed: fromMinorUnits(minorAmounts[index], currencyCode),
  }));
}

