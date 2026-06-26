import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';
import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';

export async function fetchReceiptReviewSnapshot(
  eventId: string,
  financials: {
    tax_amount: number | null;
    tip_amount: number | null;
    fees_amount: number | null;
    discount_amount: number | null;
    currency: string;
  },
): Promise<ReceiptReviewSnapshot> {
  const { data: rows, error } = await supabaseAdmin
    .from('receipt_items')
    .select('id, name, unit_price, quantity, confidence_score, is_low_confidence, is_fee')
    .eq('event_id', eventId)
    .order('created_at');

  if (error) {
    throw new AppError('DB_READ_FAILED', error.message, 500);
  }

  const { data: discountRows, error: discountError } = await supabaseAdmin
    .from('receipt_discounts')
    .select('name, discount_type, value, resolved_amount, receipt_item_id')
    .eq('event_id', eventId)
    .order('created_at');

  if (discountError) {
    throw new AppError('DB_READ_FAILED', discountError.message, 500);
  }

  const allRows = rows ?? [];
  const foodRows = allRows.filter((row) => !row.is_fee);
  const feeRows = allRows.filter((row) => row.is_fee);

  return {
    items: foodRows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      unit_price: Number(row.unit_price),
      quantity: Number(row.quantity),
      confidence: row.is_low_confidence ? 'low' : 'high',
    })),
    additional_charges: feeRows.map((row) => ({
      name: row.name as string,
      amount: Number(row.unit_price),
      confidence: row.is_low_confidence ? 'low' : 'high',
    })),
    discounts: (discountRows ?? []).map((row) => ({
      name: row.name as string,
      type: row.discount_type as 'percent' | 'amount',
      value: Number(row.value),
      scope: row.receipt_item_id ? 'item' : 'bill',
      item_id: (row.receipt_item_id as string | null) ?? undefined,
    })),
    tax_amount: Number(financials.tax_amount ?? 0),
    tip_amount: Number(financials.tip_amount ?? 0),
    fees_amount: Number(financials.fees_amount ?? 0),
    discount_amount: Number(financials.discount_amount ?? 0),
    currency: financials.currency,
  };
}
