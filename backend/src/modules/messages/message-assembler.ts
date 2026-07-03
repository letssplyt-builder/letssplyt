import {
  defaultLocaleForCurrency,
  formatCurrency,
  sanitizePromptInput,
} from '../../infrastructure/security';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import {
  buildPaymentLinksForMethods,
  type PaymentLinkResult,
  type PayerHandleInput,
} from './deepLinks';
import { buildCompactSmsMessage } from './compact-sms';
import { buildShortBreakdownUrl } from './breakdown-url';

export interface AssembledParticipantMessage {
  messageText: string;
  paymentLinks: PaymentLinkResult[];
  channel: 'whatsapp' | 'sms';
}

/** Deterministic SMS/WhatsApp opening — no AI variability. */
export function buildStandardOpeningLine(
  displayName: string,
  eventName: string,
  payerDisplayName: string,
): string {
  const safeName = sanitizePromptInput(displayName, 80);
  const safeEvent = sanitizePromptInput(eventName, 80);
  const safePayer = sanitizePromptInput(payerDisplayName, 80);
  return `Hi ${safeName}!! Here is your share from ${safeEvent} organized by ${safePayer}.`;
}

export interface AssembleMessageParams {
  aiGreeting: string;
  displayName: string;
  payerDisplayName: string;
  amountOwed: number;
  currency: string;
  locale: string;
  eventName: string;
  payerHandles: PayerHandleInput[];
  supportedMethods: PaymentProvider[];
  channel: 'whatsapp' | 'sms';
  isRegistered: boolean;
  breakdownUrl?: string;
  breakdownToken?: string;
  revisionLeadIn?: string;
}

function assembleWhatsAppMessage(
  params: AssembleMessageParams,
  formattedAmount: string,
  paymentLinks: PaymentLinkResult[],
): string {
  const paymentLines = paymentLinks.map((link) => `${link.label}: ${link.url}`);
  const paymentBlock =
    paymentLines.length > 0
      ? `Pay here:\n${paymentLines.join('\n')}`
      : 'Please reply to confirm when you have paid.';

  const nudge = params.isRegistered
    ? ''
    : '\n\nTrack your payments with LetsSplyt: https://letssplyt.app/download';

  const breakdownLine = params.breakdownUrl
    ? `See full split: ${params.breakdownUrl}`
    : '';

  return [
    params.revisionLeadIn,
    params.aiGreeting,
    `Your share is ${formattedAmount}.`,
    breakdownLine,
    paymentBlock,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
    .concat(nudge);
}

function assembleSmsMessage(
  params: AssembleMessageParams,
  formattedAmount: string,
  payUrl: string,
): string {
  return buildCompactSmsMessage({
    displayName: params.displayName,
    payerDisplayName: params.payerDisplayName,
    eventName: params.eventName,
    formattedAmount,
    payUrl,
    revisionLeadIn: params.revisionLeadIn,
  });
}

export function assembleParticipantMessage(params: AssembleMessageParams): AssembledParticipantMessage {
  const locale = params.locale || defaultLocaleForCurrency(params.currency);
  const formattedAmount = formatCurrency(params.amountOwed, params.currency, locale);

  const paymentLinks = buildPaymentLinksForMethods(
    params.payerHandles,
    params.supportedMethods,
    params.amountOwed,
    params.eventName,
    params.currency,
    locale,
  );

  if (params.channel === 'sms') {
    const payUrl =
      params.breakdownUrl ??
      (params.breakdownToken ? buildShortBreakdownUrl(params.breakdownToken) : '');

    const messageText = payUrl
      ? assembleSmsMessage(params, formattedAmount, payUrl)
      : assembleWhatsAppMessage(params, formattedAmount, paymentLinks);

    return {
      messageText,
      paymentLinks,
      channel: params.channel,
    };
  }

  return {
    messageText: assembleWhatsAppMessage(params, formattedAmount, paymentLinks),
    paymentLinks,
    channel: params.channel,
  };
}

export function validateMessageContainsAmount(
  message: string,
  amountOwed: number,
  currency: string,
  locale: string,
): void {
  const resolvedLocale = locale || defaultLocaleForCurrency(currency);
  const formattedAmount = formatCurrency(amountOwed, currency, resolvedLocale);

  if (!message.includes(formattedAmount)) {
    throw new Error(
      `Message validation failed: expected "${formattedAmount}" in message`,
    );
  }
}
