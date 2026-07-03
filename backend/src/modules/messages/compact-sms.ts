import { sanitizePromptInput } from '../../infrastructure/security';

/** Standard GSM-7 single-segment limit (US carriers). */
export const SMS_SINGLE_SEGMENT_LIMIT = 160;

export interface CompactSmsParams {
  displayName: string;
  payerDisplayName: string;
  eventName: string;
  formattedAmount: string;
  payUrl: string;
  revisionLeadIn?: string;
}

function firstWord(name: string, maxLen: number): string {
  const word = name.trim().split(/\s+/)[0] ?? name.trim();
  if (word.length <= maxLen) {
    return word;
  }
  return word.slice(0, Math.max(1, maxLen - 1)) + '…';
}

function trimEventTitle(eventName: string, maxLen: number): string {
  const safe = sanitizePromptInput(eventName, 80).trim();
  if (safe.length <= maxLen) {
    return safe;
  }
  if (maxLen <= 1) {
    return '…';
  }
  return safe.slice(0, maxLen - 1) + '…';
}

/**
 * Build a single-segment SMS when possible.
 * Payment links live on the hosted pay page (short URL) — not inlined in the text.
 */
export function buildCompactSmsMessage(params: CompactSmsParams): string {
  const name = firstWord(params.displayName, 20);
  const payer = firstWord(params.payerDisplayName, 20);
  const amount = params.formattedAmount;
  const url = params.payUrl;
  const prefix = params.revisionLeadIn ? `${params.revisionLeadIn.trim()} ` : '';

  const templates: Array<(event: string) => string> = [
    (event) => `${prefix}Hi ${name}! ${payer} — ${event}. Owe ${amount}. Pay: ${url}`,
    (event) => `${prefix}Hi ${name}! ${payer}. Owe ${amount} (${event}). Pay: ${url}`,
    () => `${prefix}Hi ${name}! Owe ${amount} to ${payer}. Pay: ${url}`,
    () => `${prefix}Owe ${amount} to ${payer}. Pay: ${url}`,
  ];

  const eventFull = trimEventTitle(params.eventName, 40);

  for (const build of templates) {
    for (let len = eventFull.length; len >= 0; len -= 1) {
      const event = len === eventFull.length ? eventFull : trimEventTitle(params.eventName, len);
      const message = build(event);
      if (message.length <= SMS_SINGLE_SEGMENT_LIMIT) {
        return message;
      }
    }
  }

  return `${prefix}Pay ${amount}: ${url}`.slice(0, SMS_SINGLE_SEGMENT_LIMIT);
}

export function smsSegmentCount(message: string): number {
  if (message.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return 1;
  }
  return Math.ceil(message.length / 153);
}
