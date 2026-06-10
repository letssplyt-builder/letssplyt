import { sanitizePromptInput } from '../../infrastructure/security/sanitize';

export interface A2ReceiptItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export interface A2Participant {
  display_name: string;
}

export function buildA2Prompt(
  items: A2ReceiptItem[],
  participants: A2Participant[],
  naturalLanguageInstruction: string | null,
): string {
  const itemList = items
    .map(
      (item) =>
        `  { "id": "${item.id}", "name": "${sanitizePromptInput(item.name, 60)}", ` +
        `"unit_price": ${item.unit_price}, "qty": ${item.quantity} }`,
    )
    .join(',\n');

  const participantList = participants
    .map((p) => `"${sanitizePromptInput(p.display_name, 100)}"`)
    .join(', ');

  const instruction = naturalLanguageInstruction
    ? `\nPayer's instruction: "${sanitizePromptInput(naturalLanguageInstruction, 200)}"`
    : '';

  return `You are a bill-splitting assistant. Assign receipt items to participants.
${instruction}

Participants: [${participantList}]

Items:
[
${itemList}
]

Rules:
- Every item must be assigned to at least one participant
- An item can be shared by multiple participants (split equally between them)
- Only use participant names from the Participants list above — exact spelling required
- "Everyone" or "all" means assign to every participant in the list
- If you cannot confidently assign an item, add its id to unassigned_item_ids
- Return ONLY valid JSON — no markdown, no explanation, no code fences

Return this exact schema:
{
  "assignments": [
    {
      "item_id": "string (the item id from the Items list)",
      "assigned_to": ["string"] (one or more participant names — exact spelling)
    }
  ],
  "unassigned_item_ids": ["string"] (ids you could not confidently assign — empty array if all assigned),
  "confidence": number (0.0 to 1.0 — your confidence in these assignments overall)
}`;
}
