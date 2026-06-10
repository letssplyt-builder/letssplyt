import { sanitizePromptInput } from '../../infrastructure/security/sanitize';

const RECIPIENT_PLACEHOLDER = 'Recipient';

export function getRecipientPlaceholder(): string {
  return RECIPIENT_PLACEHOLDER;
}

/**
 * A3 prompt — participant identity uses RECIPIENT_PLACEHOLDER only (no display_name or phone).
 */
export function buildA3Prompt(
  eventName: string,
  formattedAmount: string,
  itemNames: string[],
  payerFirstName: string,
): string {
  const safeEvent = sanitizePromptInput(eventName, 80);
  const safePayer = sanitizePromptInput(payerFirstName, 30);
  const safeItems = itemNames
    .slice(0, 5)
    .map((name) => sanitizePromptInput(name, 40))
    .join(', ');

  const itemContext =
    safeItems.length > 0 ? `Items for ${RECIPIENT_PLACEHOLDER}: ${safeItems}.` : '';

  return `Write a friendly, warm 2-sentence payment reminder message.

Context:
- Event: "${safeEvent}"
- Person who paid the bill: ${safePayer}
- Person who needs to pay back: ${RECIPIENT_PLACEHOLDER}
- Amount owed: ${formattedAmount}
- ${itemContext}

Rules:
- Be warm and casual, as if texting a friend
- Mention ${RECIPIENT_PLACEHOLDER} and the event name
- Do NOT include payment method names or URLs
- Do NOT write more than 2 sentences
- Return ONLY the message text — no JSON, no labels, no quotes, no markdown`;
}
