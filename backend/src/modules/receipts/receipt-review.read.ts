import type { ReceiptReviewSnapshot } from '@letssplyt/shared/receipt.types';
import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';

export async function fetchReceiptReviewSnapshot(
  eventId: string,
  financials: {
    tax_amount: number | null;
    tip_amount: number | null;
    fees_amount: number | null;
    currency: string;
  },
): Promise<ReceiptReviewSnapshot> {
  const { data: rows, error } = await supabaseAdmin
    .from('receipt_items')
    .select('name, unit_price, quantity, confidence_score, is_low_confidence, is_fee')
    .eq('event_id', eventId)
    .order('created_at');

  if (error) {
    throw new AppError('DB_READ_FAILED', error.message, 500);
  }

  const allRows = rows ?? [];
  const foodRows = allRows.filter((row) => !row.is_fee);
  const feeRows = allRows.filter((row) => row.is_fee);

  return {
    items: foodRows.map((row) => ({
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
    tax_amount: Number(financials.tax_amount ?? 0),
    tip_amount: Number(financials.tip_amount ?? 0),
    fees_amount: Number(financials.fees_amount ?? 0),
    currency: financials.currency,
  };
}
