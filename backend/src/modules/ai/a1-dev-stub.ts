import { randomUUID } from 'crypto';
import type { ReceiptParseResult } from './receipt-parser/receipt-parser.schema';

/** Dev-only fixture when Gemini/Anthropic quota is unavailable. Never enabled in staging/production. */
export function isA1DevStubEnabled(): boolean {
  if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
    return false;
  }
  return process.env.A1_DEV_STUB === 'true';
}

export function buildA1DevStubResult(currency = 'USD'): ReceiptParseResult {
  return {
    items: [
      {
        id: randomUUID(),
        name: 'Dev stub — Burger',
        unit_price: 12,
        quantity: 1,
        confidence_score: 0.95,
        is_low_confidence: false,
      },
      {
        id: randomUUID(),
        name: 'Dev stub — Fries',
        unit_price: 5,
        quantity: 1,
        confidence_score: 0.92,
        is_low_confidence: false,
      },
    ],
    additional_charges: [
      {
        name: 'Dev stub — Service charge',
        amount: 2.5,
        confidence_score: 0.9,
      },
    ],
    discounts: [],
    subtotal: 17,
    tax: 1.5,
    tip: 3,
    total: 24,
    currency,
    locale: 'en-US',
    parse_confidence: 0.95,
  };
}
