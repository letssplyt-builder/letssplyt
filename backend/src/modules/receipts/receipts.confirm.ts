import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { ReceiptConfirmResponse } from '@letssplyt/shared/receipt.types';
import {
  computeReceiptGrandTotal,
  resolveDiscountsTotal,
  resolveReceiptDiscounts,
} from '@letssplyt/shared/utils/receiptDiscounts';
import { AppError, Errors } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  assertEventOwner,
  fetchEventRow,
  type EventRowWithReceiptFields,
} from '../events/event.service';

const confirmItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  price: z.number().nonnegative(),
  quantity: z.number().positive(),
});

const confirmChargeSchema = z.object({
  name: z.string().min(1).max(60),
  amount: z.number().nonnegative(),
});

const confirmDiscountSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(['percent', 'amount']),
  value: z.number().positive(),
  scope: z.enum(['bill', 'item']).optional(),
  item_id: z.string().uuid().optional(),
}).superRefine((discount, ctx) => {
  if (discount.scope === 'item' && !discount.item_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'item_id is required when scope is item',
      path: ['item_id'],
    });
  }
});

export const confirmReceiptBodySchema = z.object({
  event_id: z.string().uuid(),
  items: z.array(confirmItemSchema).min(1),
  additional_charges: z.array(confirmChargeSchema).default([]),
  discounts: z.array(confirmDiscountSchema).default([]),
  tax: z.number().nonnegative(),
  fees: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  discount_total: z.number().nonnegative(),
});

function sumItems(items: z.infer<typeof confirmItemSchema>[]): number {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Number(total.toFixed(2));
}

function sumCharges(charges: z.infer<typeof confirmChargeSchema>[]): number {
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return Number(total.toFixed(2));
}

const RECEIPT_RECONFIRM_STAGES = ['parsed', 'parsed_confirmed', 'calculated', 'calculating'] as const;

function isValidItemId(id: string | undefined): boolean {
  return Boolean(id && /^[0-9a-f-]{36}$/i.test(id));
}

function buildFoodItemRow(
  eventId: string,
  item: z.infer<typeof confirmItemSchema>,
  id: string,
) {
  return {
    id,
    event_id: eventId,
    name: item.name.trim(),
    unit_price: Number(item.price.toFixed(2)),
    quantity: item.quantity,
    confidence_score: 1,
    is_low_confidence: false,
    is_tax: false,
    is_tip: false,
    is_fee: false,
    is_shared: false,
    ai_extracted: false,
  };
}

function buildFeeItemRow(
  eventId: string,
  charge: z.infer<typeof confirmChargeSchema>,
  id: string,
) {
  return {
    id,
    event_id: eventId,
    name: charge.name.trim(),
    unit_price: Number(charge.amount.toFixed(2)),
    quantity: 1,
    confidence_score: 1,
    is_low_confidence: false,
    is_tax: false,
    is_tip: false,
    is_fee: true,
    is_shared: false,
    ai_extracted: false,
  };
}

async function syncReceiptItemsOnConfirm(
  eventId: string,
  items: z.infer<typeof confirmItemSchema>[],
  charges: z.infer<typeof confirmChargeSchema>[],
): Promise<void> {
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('receipt_items')
    .select('id, is_fee')
    .eq('event_id', eventId);

  if (existingError) {
    throw new AppError('DB_WRITE_FAILED', existingError.message, 500);
  }

  const existing = existingRows ?? [];
  const existingFoodIds = new Set(
    existing.filter((row) => !row.is_fee).map((row) => row.id as string),
  );
  const payloadFoodIds = new Set(
    items.map((item) => item.id).filter((id): id is string => isValidItemId(id)),
  );

  const idsToDelete = existing
    .filter((row) => row.is_fee || !payloadFoodIds.has(row.id as string))
    .map((row) => row.id as string);

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('receipt_items')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      throw new AppError('DB_WRITE_FAILED', deleteError.message, 500);
    }
  }

  for (const item of items) {
    const id = isValidItemId(item.id) ? item.id! : randomUUID();
    const row = buildFoodItemRow(eventId, item, id);

    if (existingFoodIds.has(id)) {
      const { error: updateError } = await supabaseAdmin
        .from('receipt_items')
        .update({
          name: row.name,
          unit_price: row.unit_price,
          quantity: row.quantity,
          confidence_score: row.confidence_score,
          is_low_confidence: row.is_low_confidence,
          is_tax: row.is_tax,
          is_tip: row.is_tip,
          is_fee: row.is_fee,
          is_shared: row.is_shared,
          ai_extracted: row.ai_extracted,
        })
        .eq('id', id);

      if (updateError) {
        throw new AppError('DB_WRITE_FAILED', updateError.message, 500);
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from('receipt_items').insert(row);
      if (insertError) {
        throw new AppError('DB_WRITE_FAILED', insertError.message, 500);
      }
    }
  }

  for (const charge of charges) {
    const row = buildFeeItemRow(eventId, charge, randomUUID());
    const { error: insertError } = await supabaseAdmin.from('receipt_items').insert(row);
    if (insertError) {
      throw new AppError('DB_WRITE_FAILED', insertError.message, 500);
    }
  }
}

export async function confirmReceipt(
  userId: string,
  body: z.infer<typeof confirmReceiptBodySchema>,
): Promise<ReceiptConfirmResponse> {
  const eventRow = await fetchEventRow(body.event_id) as EventRowWithReceiptFields;
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'locked') {
    throw new AppError(
      'EVENT_NOT_LOCKED',
      'Event must be locked before confirming receipt items',
      400,
    );
  }

  const itemsSubtotal = sumItems(body.items);
  const chargesTotal = sumCharges(body.additional_charges);
  const discountItemLines = body.items
    .filter((item) => isValidItemId(item.id))
    .map((item) => ({
      id: item.id!,
      unit_price: item.price,
      quantity: item.quantity,
    }));
  const computedDiscountTotal = resolveDiscountsTotal(
    body.discounts,
    itemsSubtotal,
    discountItemLines,
  );

  if (Math.abs(chargesTotal - body.fees) > 0.02) {
    throw Errors.validation('fees must equal the sum of additional_charges');
  }

  if (Math.abs(computedDiscountTotal - body.discount_total) > 0.02) {
    throw Errors.validation('discount_total must equal the resolved sum of discounts');
  }

  const totalAmount = computeReceiptGrandTotal(
    itemsSubtotal,
    body.fees,
    body.tax,
    body.tip,
    body.discount_total,
  );

  const nextAiStage =
    eventRow.ai_stage === 'parsed' ? 'parsed_confirmed' : eventRow.ai_stage;

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('events')
    .update({ ai_stage: nextAiStage })
    .eq('id', body.event_id)
    .in('ai_stage', [...RECEIPT_RECONFIRM_STAGES])
    .select('id');

  if (claimError) {
    throw new AppError('DB_WRITE_FAILED', claimError.message, 500);
  }

  if (!claimed?.length) {
    throw new AppError(
      'INVALID_AI_STAGE',
      'Receipt can only be confirmed when ai_stage is parsed, parsed_confirmed, calculated, or calculating',
      400,
    );
  }

  const { error: deleteDiscountsError } = await supabaseAdmin
    .from('receipt_discounts')
    .delete()
    .eq('event_id', body.event_id);

  if (deleteDiscountsError) {
    throw new AppError('DB_WRITE_FAILED', deleteDiscountsError.message, 500);
  }

  await syncReceiptItemsOnConfirm(body.event_id, body.items, body.additional_charges);

  if (body.discounts.length > 0) {
    const resolvedDiscounts = resolveReceiptDiscounts(
      body.discounts,
      itemsSubtotal,
      discountItemLines,
    );
    const discountRows = resolvedDiscounts.map((discount) => ({
      id: randomUUID(),
      event_id: body.event_id,
      name: discount.name.trim(),
      discount_type: discount.type,
      value: discount.value,
      resolved_amount: discount.resolved_amount,
      receipt_item_id: discount.scope === 'item' ? discount.item_id ?? null : null,
    }));

    const { error: discountInsertError } = await supabaseAdmin
      .from('receipt_discounts')
      .insert(discountRows);

    if (discountInsertError) {
      throw new AppError('DB_WRITE_FAILED', discountInsertError.message, 500);
    }
  }

  const { error: eventError } = await supabaseAdmin
    .from('events')
    .update({
      total_amount: totalAmount,
      tax_amount: body.tax,
      tip_amount: body.tip,
      fees_amount: body.fees,
      discount_amount: body.discount_total,
      receipt_scan_attempted: true,
      ai_parse_success: true,
    })
    .eq('id', body.event_id);

  if (eventError) {
    throw new AppError('DB_WRITE_FAILED', eventError.message, 500);
  }

  return { confirmed: true, total_amount: totalAmount };
}
