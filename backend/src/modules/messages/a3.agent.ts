import { createHash } from 'crypto';
import { createLLMProvider } from '../../infrastructure/llm/factory';
import { writeAuditLog } from '../../infrastructure/llm/ai-audit';
import type { LLMMessage } from '../../infrastructure/llm/llm.provider';
import {
  defaultLocaleForCurrency,
  formatCurrency,
  sanitizePromptInput,
} from '../../infrastructure/security';
import { buildA3Prompt, getRecipientPlaceholder } from './a3.prompt';
import {
  assembleParticipantMessage,
  validateMessageContainsAmount,
  type AssembledParticipantMessage,
} from './message-assembler';
import type { PayerHandleInput } from './deepLinks';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';

const MAX_RETRIES = parseInt(process.env.MESSAGE_COMPOSE_MAX_RETRIES ?? '3', 10);
const RECIPIENT_PLACEHOLDER = getRecipientPlaceholder();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number, baseMs = 500, maxMs = 10_000): number {
  const exponential = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
  return Math.floor(Math.random() * exponential);
}

const BLOCKED_GREETING_PATTERNS: RegExp[] = [
  /\$[\d,]+/,
  /£[\d,]+/,
  /€[\d,]+/,
  /₹[\d,]+/,
  /https?:\/\//i,
];

function validateGreeting(greeting: string): void {
  if (greeting.length < 10) {
    throw new Error('Greeting too short');
  }
  if (greeting.length > 300) {
    throw new Error('Greeting too long');
  }
  for (const pattern of BLOCKED_GREETING_PATTERNS) {
    if (pattern.test(greeting)) {
      throw new Error(`Greeting failed content check: ${pattern}`);
    }
  }
  if (!greeting.includes(RECIPIENT_PLACEHOLDER)) {
    throw new Error('Greeting must use Recipient placeholder');
  }
}

function personalizeGreeting(greeting: string, displayName: string): string {
  return greeting.split(RECIPIENT_PLACEHOLDER).join(displayName);
}

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
}

export async function composeParticipantMessage(
  params: ComposeParticipantMessageParams,
): Promise<AssembledParticipantMessage> {
  const locale = params.locale || defaultLocaleForCurrency(params.currency);
  const payerFirstName = params.payerDisplayName.split(' ')[0] ?? params.payerDisplayName;
  const formattedAmount = formatCurrency(params.amountOwed, params.currency, locale);
  const promptText = buildA3Prompt(
    params.eventName,
    formattedAmount,
    params.itemNames,
    payerFirstName,
  );

  const provider = createLLMProvider('A3');
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let rawText: string | null = null;

    try {
      const messages: LLMMessage[] = [{ role: 'user', content: promptText }];
      const response = await provider.complete(messages, { maxTokens: 200, timeout: 30_000 });
      rawText = response.text.trim();

      validateGreeting(rawText);
      const personalizedGreeting = personalizeGreeting(rawText, params.displayName);

      const composed = assembleParticipantMessage({
        aiGreeting: personalizedGreeting,
        displayName: params.displayName,
        amountOwed: params.amountOwed,
        currency: params.currency,
        locale,
        eventName: params.eventName,
        payerHandles: params.payerHandles,
        supportedMethods: params.supportedMethods,
        channel: params.channel,
        isRegistered: params.isRegistered,
      });

      validateMessageContainsAmount(
        composed.messageText,
        params.amountOwed,
        params.currency,
        locale,
      );

      writeAuditLog({
        eventId: params.eventId,
        agent: 'A3',
        provider: process.env.AI_PROVIDER_A3 ?? 'gemini',
        modelUsed: response.modelUsed,
        inputHash: sha256(promptText),
        outputHash: sha256(rawText),
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: true,
      });

      return composed;
    } catch (err) {
      lastError = err as Error;

      writeAuditLog({
        eventId: params.eventId,
        agent: 'A3',
        provider: process.env.AI_PROVIDER_A3 ?? 'gemini',
        modelUsed: process.env.AI_MODEL_A3 ?? 'gemini-2.5-flash',
        inputHash: sha256(promptText),
        outputHash: sha256(rawText ?? ''),
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: false,
        errorCode: lastError.message,
      });

      if (attempt < MAX_RETRIES) {
        await sleep(getRetryDelay(attempt));
      }
    }
  }

  const sanitizedName = sanitizePromptInput(params.displayName.split(' ')[0] ?? '', 100);
  const greetingName = sanitizedName.length > 0 ? sanitizedName : 'there';
  const fallbackGreeting = `Hi ${greetingName}! Here's your share from ${sanitizePromptInput(params.eventName, 80)}.`;

  const composed = assembleParticipantMessage({
    aiGreeting: fallbackGreeting,
    displayName: params.displayName,
    amountOwed: params.amountOwed,
    currency: params.currency,
    locale,
    eventName: params.eventName,
    payerHandles: params.payerHandles,
    supportedMethods: params.supportedMethods,
    channel: params.channel,
    isRegistered: params.isRegistered,
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
