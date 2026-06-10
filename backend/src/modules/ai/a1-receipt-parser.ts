import { createHash, randomUUID } from 'crypto';
import type { ReceiptParseResponse } from '@letssplyt/shared/receipt.types';
import { AppError } from '../../infrastructure/errors';
import { createLLMProvider } from '../../infrastructure/llm/factory';
import { writeAuditLog } from '../../infrastructure/llm/ai-audit';
import type { LLMMessage } from '../../infrastructure/llm/llm.provider';
import { sanitizePromptInput } from '../../infrastructure/security/sanitize';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { buildA1DevStubResult, isA1DevStubEnabled } from './a1-dev-stub';
import { isAiQuotaError, toA1AppError } from './a1-llm-errors';
import {
  claimParsingSlot,
  getAiStage,
  getCachedReceiptResult,
  setAiStage,
} from './a1-idempotency';
import { dedupeFeeLineItems } from './receipt-parser/receipt-parser.dedupe';
import { preprocessReceiptImage } from './receipt-parser/receipt-parser.preprocess';
import { buildReceiptParserPrompt } from './receipt-parser/receipt-parser.prompt';
import {
  ReceiptParseOutputSchema,
  sumAdditionalCharges,
  type AdditionalCharge,
  type ReceiptParseResult,
} from './receipt-parser/receipt-parser.schema';

const RECEIPTS_BUCKET = 'receipts';
const MAX_RETRIES = parseInt(process.env.RECEIPT_PARSE_MAX_RETRIES ?? '3', 10);
const LOW_CONFIDENCE_THRESHOLD = parseFloat(process.env.A1_ITEM_CONFIDENCE_THRESHOLD ?? '0.75');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number, baseMs = 500, maxMs = 10_000): number {
  const exponential = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
  return Math.floor(Math.random() * exponential);
}

function isPastParsing(stage: string): boolean {
  return stage !== 'none' && stage !== 'failed' && stage !== 'parsing';
}

function mapChargeConfidence(charge: AdditionalCharge): 'high' | 'low' {
  const score = charge.confidence_score ?? 1;
  return score < LOW_CONFIDENCE_THRESHOLD ? 'low' : 'high';
}

function toApiResponse(result: ReceiptParseResult, storagePath: string): ReceiptParseResponse {
  const feesAmount = sumAdditionalCharges(result.additional_charges);
  return {
    items: result.items.map((item) => ({
      name: item.name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      confidence: item.is_low_confidence ? 'low' : 'high',
    })),
    additional_charges: result.additional_charges.map((charge) => ({
      name: charge.name,
      amount: charge.amount,
      confidence: mapChargeConfidence(charge),
    })),
    tax_amount: result.tax,
    tip_amount: result.tip,
    fees_amount: feesAmount,
    total_amount: result.total,
    currency: result.currency,
    storage_path: storagePath,
  };
}

async function fetchReceiptImageBase64(storagePath: string): Promise<{
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}> {
  const { data, error } = await supabaseAdmin.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new AppError(
      'STORAGE_READ_FAILED',
      'Could not read receipt image from storage',
      500,
      { storagePath, detail: error?.message },
    );
  }

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new AppError(
      'STORAGE_READ_FAILED',
      'Could not download receipt image',
      500,
      { status: response.status },
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType =
    storagePath.endsWith('.png')
      ? 'image/png'
      : storagePath.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

  return { base64: buffer.toString('base64'), mimeType };
}

async function persistParseResult(
  eventId: string,
  storagePath: string,
  result: ReceiptParseResult,
): Promise<void> {
  const itemsWithFlags = result.items.map((item) => {
    const isLow = item.confidence_score < LOW_CONFIDENCE_THRESHOLD;
    const id =
      item.id && /^[0-9a-f-]{36}$/i.test(item.id) ? item.id : randomUUID();
    return {
      ...item,
      id,
      is_low_confidence: isLow,
    };
  });

  await supabaseAdmin.from('receipt_items').delete().eq('event_id', eventId);

  const itemRows = itemsWithFlags.map((item) => ({
    id: item.id,
    event_id: eventId,
    name: item.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    confidence_score: item.confidence_score,
    is_low_confidence: item.is_low_confidence,
    is_tax: false,
    is_tip: false,
    is_fee: false,
    is_shared: false,
    ai_extracted: true,
    receipt_s3_key: storagePath,
  }));

  const feeRows = result.additional_charges.map((charge) => {
    const confidenceScore = charge.confidence_score ?? 1;
    const isLow = confidenceScore < LOW_CONFIDENCE_THRESHOLD;
    return {
      id: randomUUID(),
      event_id: eventId,
      name: charge.name,
      unit_price: charge.amount,
      quantity: 1,
      confidence_score: confidenceScore,
      is_low_confidence: isLow,
      is_tax: false,
      is_tip: false,
      is_fee: true,
      is_shared: false,
      ai_extracted: true,
      receipt_s3_key: storagePath,
    };
  });

  const rows = [...itemRows, ...feeRows];
  const feesAmount = sumAdditionalCharges(result.additional_charges);

  const { error: insertError } = await supabaseAdmin.from('receipt_items').insert(rows);
  if (insertError) {
    throw new AppError('DB_WRITE_FAILED', insertError.message, 500);
  }

  const { error: eventError } = await supabaseAdmin
    .from('events')
    .update({
      ai_stage: 'parsed',
      receipt_scan_attempted: true,
      ai_parse_success: true,
      ai_parse_confidence: result.parse_confidence,
      tax_amount: result.tax,
      tip_amount: result.tip,
      fees_amount: feesAmount,
      total_amount: result.total,
      currency: result.currency,
      locale: result.locale ?? 'en-US',
    })
    .eq('id', eventId);

  if (eventError) {
    throw new AppError('DB_WRITE_FAILED', eventError.message, 500);
  }
}

async function callA1Model(
  eventId: string,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  eventTitle?: string,
): Promise<ReceiptParseResult> {
  const provider = createLLMProvider('A1');
  if (!provider.supportsVision) {
    throw new AppError(
      'PROVIDER_NO_VISION',
      'Configured A1 provider does not support vision input',
      500,
    );
  }

  const preprocessed = await preprocessReceiptImage(imageBase64);
  const prompt = buildReceiptParserPrompt();
  const contextLine =
    eventTitle
      ? `Event context: ${sanitizePromptInput(eventTitle, 120)}`
      : undefined;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let rawText: string | null = null;

    try {
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              base64: preprocessed,
              mimeType,
            },
            {
              type: 'text',
              text: contextLine ? `${prompt}\n\n${contextLine}` : prompt,
            },
          ],
        },
      ];
      const response = await provider.complete(messages, { maxTokens: 2048, timeout: 60_000 });
      rawText = response.text.trim();

      if (!rawText) {
        throw new Error('Empty response from model');
      }

      const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(jsonText);
      const validated = ReceiptParseOutputSchema.parse(parsed);

      if ('error' in validated) {
        throw new AppError('RECEIPT_UNREADABLE', validated.reason, 400);
      }

      const items = validated.items.map((item) => ({
        ...item,
        id:
          item.id && /^[0-9a-f-]{36}$/i.test(item.id) ? item.id : randomUUID(),
        is_low_confidence: item.confidence_score < LOW_CONFIDENCE_THRESHOLD,
      }));

      const additionalCharges = validated.additional_charges.map((charge) => ({
        ...charge,
        confidence_score: charge.confidence_score ?? 1,
      }));

      const result: ReceiptParseResult = {
        ...validated,
        items,
        additional_charges: additionalCharges,
      };

      writeAuditLog({
        agent: 'A1',
        eventId,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        modelUsed: response.modelUsed,
        success: true,
        inputHash: sha256(prompt),
        outputHash: sha256(rawText),
        latencyMs: Date.now() - start,
        attempts: attempt,
      });

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (err instanceof AppError && err.code === 'RECEIPT_UNREADABLE') {
        throw err;
      }

      if (isAiQuotaError(err)) {
        throw toA1AppError(err);
      }

      writeAuditLog({
        agent: 'A1',
        eventId,
        inputTokens: 0,
        outputTokens: 0,
        modelUsed: process.env.AI_MODEL_A1 ?? 'unknown',
        success: false,
        errorCode: lastError.message,
        inputHash: sha256(prompt),
        outputHash: sha256(rawText ?? ''),
        latencyMs: Date.now() - start,
        attempts: attempt,
      });

      if (attempt < MAX_RETRIES) {
        await sleep(getRetryDelay(attempt));
      }
    }
  }

  throw toA1AppError(lastError);
}

/**
 * Run A1 receipt parsing with atomic idempotency and DB persistence.
 */
export async function runA1ReceiptParse(
  eventId: string,
  storagePath: string,
  eventTitle?: string,
): Promise<ReceiptParseResponse> {
  const stage = await getAiStage(eventId);

  if (stage === 'parsing') {
    throw new AppError('ALREADY_PROCESSING', 'Receipt is already being parsed', 409);
  }

  if (isPastParsing(stage)) {
    const cached = await getCachedReceiptResult(eventId);
    return toApiResponse(cached, storagePath);
  }

  const claimed = await claimParsingSlot(eventId);
  if (!claimed) {
    const current = await getAiStage(eventId);
    if (current === 'parsing') {
      throw new AppError('ALREADY_PROCESSING', 'Receipt is already being parsed', 409);
    }
    if (isPastParsing(current)) {
      const cached = await getCachedReceiptResult(eventId);
      return toApiResponse(cached, storagePath);
    }
    throw new AppError('PARSE_FAILED', 'Could not claim receipt parsing slot', 500);
  }

  try {
    const result = isA1DevStubEnabled()
      ? buildA1DevStubResult()
      : await (async () => {
          const { base64, mimeType } = await fetchReceiptImageBase64(storagePath);
          return callA1Model(eventId, base64, mimeType, eventTitle);
        })();
    const normalized = dedupeFeeLineItems(result);
    await persistParseResult(eventId, storagePath, normalized);
    return toApiResponse(normalized, storagePath);
  } catch (err) {
    if (err instanceof AppError && err.code === 'RECEIPT_UNREADABLE') {
      await setAiStage(eventId, 'failed');
      throw err;
    }

    await setAiStage(eventId, 'failed');
    throw toA1AppError(err);
  }
}
