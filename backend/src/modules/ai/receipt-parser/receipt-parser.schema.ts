import { z } from 'zod';

export const ReceiptItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  unit_price: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  confidence_score: z.number().min(0).max(1),
  is_low_confidence: z.boolean().optional(),
});

export const AdditionalChargeSchema = z.object({
  name: z.string().min(1).max(60),
  amount: z.number().positive(),
  confidence_score: z.number().min(0).max(1).optional(),
});

export const ReceiptParseResultSchema = z.object({
  items: z.array(ReceiptItemSchema).min(1),
  additional_charges: z.array(AdditionalChargeSchema).default([]),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  total: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  locale: z.string().optional(),
  parse_confidence: z.number().min(0).max(1),
});

export const ReceiptParseErrorSchema = z.object({
  error: z.literal('unreadable'),
  reason: z.string(),
});

export const ReceiptParseOutputSchema = z.union([
  ReceiptParseResultSchema,
  ReceiptParseErrorSchema,
]);

export type AdditionalCharge = z.infer<typeof AdditionalChargeSchema>;
export type ReceiptParseResult = z.infer<typeof ReceiptParseResultSchema>;
export type ReceiptParseOutput = z.infer<typeof ReceiptParseOutputSchema>;

/** Sum of all additional_charges — stored as events.fees_amount. */
export function sumAdditionalCharges(charges: AdditionalCharge[]): number {
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return Number(total.toFixed(2));
}
