import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { defaultLocaleForCurrency } from '../../infrastructure/security';
import { buildA3Prompt, getRecipientPlaceholder } from './a3.prompt';
import {
  assembleParticipantMessage,
  buildStandardOpeningLine,
  validateMessageContainsAmount,
  type AssembledParticipantMessage,
} from './message-assembler';
import type { PayerHandleInput } from './deepLinks';

export interface ComposeParticipantMessageParams {
  eventId: string;
  eventName: string;
  displayName: string;
  payerDisplayName: string;
  itemNames: string[];
  amountOwed: number;
  currency: string;
  locale: string;
  payerHandles: PayerHandleInput[];
  supportedMethods: PaymentProvider[];
  channel: 'whatsapp' | 'sms';
  isRegistered: boolean;
  breakdownUrl?: string;
}

/** Builds the participant SMS/WhatsApp body with a fixed opening line (no LLM). */
export async function composeParticipantMessage(
  params: ComposeParticipantMessageParams,
): Promise<AssembledParticipantMessage> {
  const locale = params.locale || defaultLocaleForCurrency(params.currency);
  const openingLine = buildStandardOpeningLine(
    params.displayName,
    params.eventName,
    params.payerDisplayName,
  );

  const composed = assembleParticipantMessage({
    aiGreeting: openingLine,
    displayName: params.displayName,
    amountOwed: params.amountOwed,
    currency: params.currency,
    locale,
    eventName: params.eventName,
    payerHandles: params.payerHandles,
    supportedMethods: params.supportedMethods,
    channel: params.channel,
    isRegistered: params.isRegistered,
    breakdownUrl: params.breakdownUrl,
  });

  validateMessageContainsAmount(
    composed.messageText,
    params.amountOwed,
    params.currency,
    locale,
  );

  return composed;
}

/** Exported for unit tests — must not include participant display_name or phone. */
export function buildA3PromptForTest(
  eventName: string,
  formattedAmount: string,
  itemNames: string[],
  payerFirstName: string,
): string {
  return buildA3Prompt(eventName, formattedAmount, itemNames, payerFirstName);
}

export function getRecipientPlaceholderForTest(): string {
  return getRecipientPlaceholder();
}
