import { formatPhoneE164 } from '../security/phone-format';
import { processSmsStartOptIn } from './process-sms-opt-in';
import { processSmsStopOptOut } from './process-sms-opt-out';

const STOP_KEYWORDS = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
]);
const START_KEYWORDS = new Set(['START', 'UNSTOP']);
const HELP_KEYWORDS = new Set(['HELP', 'INFO']);

export const INBOUND_REPLY_STOP =
  'You have been unsubscribed from LetsSplyt notifications. Reply START to resubscribe.';
export const INBOUND_REPLY_START = 'You have been resubscribed to LetsSplyt SMS notifications.';
export const INBOUND_REPLY_HELP =
  'LetsSplyt help: builder@letssplyt.com. Reply STOP to opt out.';

export type InboundSmsAction =
  | { type: 'stop'; replyText: string }
  | { type: 'start'; replyText: string }
  | { type: 'help'; replyText: string }
  | { type: 'none' };

function extractKeyword(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.split(/\s+/)[0]?.toUpperCase() ?? '';
}

export async function handleInboundSmsKeyword(
  fromE164: string,
  body: string,
): Promise<InboundSmsAction> {
  const phone = formatPhoneE164(fromE164);
  if (!phone) {
    return { type: 'none' };
  }

  const keyword = extractKeyword(body);

  if (STOP_KEYWORDS.has(keyword)) {
    await processSmsStopOptOut(phone);
    return { type: 'stop', replyText: INBOUND_REPLY_STOP };
  }

  if (START_KEYWORDS.has(keyword)) {
    await processSmsStartOptIn(phone);
    return { type: 'start', replyText: INBOUND_REPLY_START };
  }

  if (HELP_KEYWORDS.has(keyword)) {
    return { type: 'help', replyText: INBOUND_REPLY_HELP };
  }

  return { type: 'none' };
}
