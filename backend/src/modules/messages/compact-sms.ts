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

function buildShareLine(
  name: string,
  event: string,
  payer: string,
  amount: string,
): string {
  return `Hi ${name}! Your share for ${event} paid by ${payer} is: ${amount}`;
}

/**
 * Build a single-segment SMS when possible.
 * Payment links live on the hosted pay page — not inlined in the text.
 *
 * Format:
 *   Hi {name}! Your share for {event} paid by {payer} is: {amount}
 *   Pay: {url}
 */
export function buildCompactSmsMessage(params: CompactSmsParams): string {
  const name = firstWord(params.displayName, 20);
  const payer = firstWord(params.payerDisplayName, 20);
  const amount = params.formattedAmount;
  const url = params.payUrl;
  const revisionBlock = params.revisionLeadIn ? `${params.revisionLeadIn.trim()}\n` : '';

  const eventFull = trimEventTitle(params.eventName, 50);
  const payLine = `Pay: ${url}`;

  for (let len = eventFull.length; len >= 0; len -= 1) {
    const event =
      len === eventFull.length ? eventFull : trimEventTitle(params.eventName, len);
    const shareLine = buildShareLine(name, event, payer, amount);
    const message = `${revisionBlock}${shareLine}\n${payLine}`;
    if (message.length <= SMS_SINGLE_SEGMENT_LIMIT) {
      return message;
    }
  }

  // Last resort: drop event name but keep the agreed structure.
  const fallbackShare = `Hi ${name}! Your share paid by ${payer} is: ${amount}`;
  const fallback = `${revisionBlock}${fallbackShare}\n${payLine}`;
  if (fallback.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return fallback;
  }

  return `${revisionBlock}${payLine}`.slice(0, SMS_SINGLE_SEGMENT_LIMIT);
}

export function smsSegmentCount(message: string): number {
  if (message.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return 1;
  }
  return Math.ceil(message.length / 153);
}
