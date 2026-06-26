import {
  extractDiscountsFromNegativeLines,
  mergeParsedDiscounts,
} from './receipt-parser.discounts';

/** Label for line items the model could not read reliably — user edits on Item Review. */
export const UNREADABLE_RECEIPT_ITEM_LABEL = 'Unreadable line';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOW_CONFIDENCE_CAP = 0.74;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isGarbageItemName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (/^\*+$/.test(trimmed)) return true;
  if (trimmed.length < 2 && !/\d/.test(trimmed)) return true;
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Sanitize raw A1 JSON before Zod validation: negative lines → discounts,
 * drop $0 lines and zero-amount fees, strip invalid ids, mark unreadable names.
 */
export function preprocessReceiptParseOutput(raw: unknown): unknown {
  const obj = asRecord(raw);
  if (!obj) return raw;

  if (obj.error === 'unreadable') {
    return raw;
  }

  if (!Array.isArray(obj.items)) {
    return raw;
  }

  const rawItems = obj.items;
  const fromNegatives = extractDiscountsFromNegativeLines(
    rawItems,
    Array.isArray(obj.additional_charges) ? obj.additional_charges : undefined,
  );

  const items = rawItems
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter((entry) => {
      const unitPrice = entry.unit_price;
      return typeof unitPrice === 'number' && unitPrice > 0;
    })
    .map((entry) => {
      const next = { ...entry };

      if (typeof next.id === 'string' && !isValidUuid(next.id)) {
        delete next.id;
      }

      const rawName = typeof next.name === 'string' ? next.name : '';
      if (isGarbageItemName(rawName)) {
        next.name = UNREADABLE_RECEIPT_ITEM_LABEL;
        const score =
          typeof next.confidence_score === 'number' && Number.isFinite(next.confidence_score)
            ? next.confidence_score
            : 0.5;
        next.confidence_score = Math.min(score, LOW_CONFIDENCE_CAP);
      }

      return next;
    });

  let additionalCharges = obj.additional_charges;
  if (Array.isArray(additionalCharges)) {
    additionalCharges = additionalCharges
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .filter((entry) => {
        const amount = entry.amount;
        return typeof amount === 'number' && amount > 0;
      });
  }

  const discounts = mergeParsedDiscounts(obj.discounts, fromNegatives, items.length);

  return { ...obj, items, additional_charges: additionalCharges, discounts };
}
