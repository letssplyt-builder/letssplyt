import { defaultLocaleForCurrency, formatCurrency } from '../../infrastructure/security';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import {
  buildPaymentLinksForMethods,
  type PaymentLinkResult,
  type PayerHandleInput,
} from './deepLinks';

export interface AssembledParticipantMessage {
  messageText: string;
  paymentLinks: PaymentLinkResult[];
  channel: 'whatsapp' | 'sms';
}

export interface AssembleMessageParams {
  aiGreeting: string;
  displayName: string;
  amountOwed: number;
  currency: string;
  locale: string;
  eventName: string;
  payerHandles: PayerHandleInput[];
  supportedMethods: PaymentProvider[];
  channel: 'whatsapp' | 'sms';
  isRegistered: boolean;
  breakdownUrl?: string;
  revisionLeadIn?: string;
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

  const messageText = [
    params.revisionLeadIn,
    params.aiGreeting,
    `Your share is ${formattedAmount}.`,
    breakdownLine,
    paymentBlock,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
    .concat(nudge);

  return {
    messageText,
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
