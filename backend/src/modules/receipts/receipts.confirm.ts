import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { ReceiptConfirmResponse } from '@letssplyt/shared/receipt.types';
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

export const confirmReceiptBodySchema = z.object({
  event_id: z.string().uuid(),
  items: z.array(confirmItemSchema).min(1),
  additional_charges: z.array(confirmChargeSchema).default([]),
  tax: z.number().nonnegative(),
  fees: z.number().nonnegative(),
  tip: z.number().nonnegative(),
});

function sumItems(items: z.infer<typeof confirmItemSchema>[]): number {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Number(total.toFixed(2));
}

function sumCharges(charges: z.infer<typeof confirmChargeSchema>[]): number {
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return Number(total.toFixed(2));
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

  if (Math.abs(chargesTotal - body.fees) > 0.02) {
    throw Errors.validation('fees must equal the sum of additional_charges');
  }

  const totalAmount = Number(
    (itemsSubtotal + body.tax + body.fees + body.tip).toFixed(2),
  );

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('events')
    .update({ ai_stage: 'parsed_confirmed' })
    .eq('id', body.event_id)
    .in('ai_stage', ['parsed', 'parsed_confirmed'])
    .select('id');

  if (claimError) {
    throw new AppError('DB_WRITE_FAILED', claimError.message, 500);
  }

  if (!claimed?.length) {
    throw new AppError(
      'INVALID_AI_STAGE',
      'Receipt can only be confirmed when ai_stage is parsed or parsed_confirmed',
      400,
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from('receipt_items')
    .delete()
    .eq('event_id', body.event_id);

  if (deleteError) {
    throw new AppError('DB_WRITE_FAILED', deleteError.message, 500);
  }

  const itemRows = body.items.map((item) => ({
    id: item.id && /^[0-9a-f-]{36}$/i.test(item.id) ? item.id : randomUUID(),
    event_id: body.event_id,
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
  }));

  const feeRows = body.additional_charges.map((charge) => ({
    id: randomUUID(),
    event_id: body.event_id,
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
  }));

  const rows = [...itemRows, ...feeRows];
  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('receipt_items').insert(rows);
    if (insertError) {
      throw new AppError('DB_WRITE_FAILED', insertError.message, 500);
    }
  }

  const { error: eventError } = await supabaseAdmin
    .from('events')
    .update({
      total_amount: totalAmount,
      tax_amount: body.tax,
      tip_amount: body.tip,
      fees_amount: body.fees,
      receipt_scan_attempted: true,
      ai_parse_success: true,
    })
    .eq('id', body.event_id);

  if (eventError) {
    throw new AppError('DB_WRITE_FAILED', eventError.message, 500);
  }

  return { confirmed: true, total_amount: totalAmount };
}
