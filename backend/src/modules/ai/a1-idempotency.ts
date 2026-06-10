import type { AiStage } from '@letssplyt/shared/event.types';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type { ReceiptParseResult } from './receipt-parser/receipt-parser.schema';

export class IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

const CLAIMABLE_STAGES: AiStage[] = ['none', 'failed'];

/**
 * Atomically transition ai_stage to 'parsing' from 'none' or 'failed'.
 * Returns true when this request claimed the slot; false if another stage is active.
 */
export async function claimParsingSlot(eventId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .update({ ai_stage: 'parsing' })
    .eq('id', eventId)
    .in('ai_stage', CLAIMABLE_STAGES)
    .select('id');

  if (error) {
    throw new IdempotencyError(error.message);
  }

  return (data?.length ?? 0) > 0;
}

export async function setAiStage(eventId: string, stage: AiStage): Promise<void> {
  const { error } = await supabaseAdmin.from('events').update({ ai_stage: stage }).eq('id', eventId);

  if (error) {
    throw new Error(`Failed to set ai_stage for event ${eventId}: ${error.message}`);
  }
}

export async function getAiStage(eventId: string): Promise<AiStage> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('ai_stage')
    .eq('id', eventId)
    .single();

  if (error || !data) {
    throw new Error(`Cannot read ai_stage for event ${eventId}: ${error?.message ?? 'not found'}`);
  }

  return data.ai_stage as AiStage;
}

/** Reads financial summary from events + line items from receipt_items. */
export async function getCachedReceiptResult(eventId: string): Promise<ReceiptParseResult> {
  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('total_amount, tax_amount, tip_amount, currency, locale')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Error(
      `Cannot retrieve cached receipt for event ${eventId}: ${eventError?.message ?? 'missing'}`,
    );
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('receipt_items')
    .select('id, name, unit_price, quantity, confidence_score, is_low_confidence')
    .eq('event_id', eventId)
    .order('created_at');

  if (itemsError) {
    throw new Error(
      `Cannot retrieve receipt items for event ${eventId}: ${itemsError.message}`,
    );
  }

  const mappedItems = (items ?? []).map((item) => ({
    id: item.id as string,
    name: item.name as string,
    unit_price: Number(item.unit_price),
    quantity: Number(item.quantity),
    confidence_score: Number(item.confidence_score),
    is_low_confidence: Boolean(item.is_low_confidence),
  }));

  const subtotal = mappedItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return {
    items: mappedItems,
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(event.tax_amount ?? 0),
    tip: Number(event.tip_amount ?? 0),
    total: Number(event.total_amount ?? 0),
    currency: (event.currency as string) ?? 'USD',
    locale: (event.locale as string) ?? 'en-US',
    parse_confidence: 1,
  };
}
