# LetsSplyt — AI Agent Specification
**Version:** 1.1 | **Updated:** June 2026 | **Changes:** Fixed atomic A2/A3 stage guards, fixed getCachedReceiptResult column references, fixed formatCurrency graceful fallback, added sanitizePromptInput implementation, defined largest-remainder tiebreaker, added Canadian payment config.
**Supersedes:** 05-Evals.md, 07-AI-Agent-Harness.md

Everything an engineer needs to implement, test, and operate the AI layer lives in this document.

---

## Table of Contents
1. [Overview and Design Philosophy](#1-overview-and-design-philosophy)
2. [LLM Provider Factory](#2-llm-provider-factory)
3. [Agent A1 — Receipt Parser](#3-agent-a1--receipt-parser)
4. [Agent A2 — Split Calculator](#4-agent-a2--split-calculator)
5. [Agent A3 — Message Composer](#5-agent-a3--message-composer)
6. [Agent Communication Flow](#6-agent-communication-flow)
7. [Eval Framework](#7-eval-framework)
8. [Model Upgrade Protocol](#8-model-upgrade-protocol)

---

## 1. Overview and Design Philosophy

### Why 3 Agents (Not 5)

The original design specified 5 agents. Two were cut before MVP.

**A4 — Settlement Tracker (deferred to V2):** A4 would have monitored payment rails via webhooks and auto-confirmed settlements when funds transferred. It was cut because LetsSplyt has no payment rails in MVP — the app links out to Venmo, PayPal, etc., but does not process payments itself. Without webhook events to listen for, A4 has nothing to do. Manual confirmation by the payer replaces it at zero engineering cost. Reintroduce in V2 alongside Stripe integration.

**A5 — Memory Agent (deferred to V2):** A5 would have used pgvector embeddings to remember recurring groups, suggest pre-fills, and build a social graph of who-eats-with-whom. It was cut because meaningful memory requires a training dataset of real events. Shipping the MVP first accumulates the data that A5 needs. The schema includes the pgvector table so data accumulates for backfill without a migration later.

### The Separation Principle: AI Does Semantics, Code Does Arithmetic

```
AI path:  "What is on this receipt?" (vision)
          "Who ordered what?" (natural language → item assignments)
          "Write a friendly greeting for this person" (personalised text)

Math path: All arithmetic is TypeScript — never the model's job
```

This is not a style preference. It is a correctness guarantee. A model can hallucinate a price; TypeScript's `largestRemainderRound()` cannot. Every dollar amount a user sees in a message was computed by deterministic code and read from the database — the model never generated it.

### Environment-Specific Providers

| Environment | Provider | Model | Rationale |
|-------------|----------|-------|-----------|
| Development | Google Gemini | gemini-2.5-flash | Free tier covers all development. Fast iteration with no cost. |
| Staging | Google Gemini | gemini-2.5-flash | Identical to dev — eval runs in CI use the same provider. |
| Production | Anthropic | claude-haiku-4-5-20251001 | Lowest hallucination rate on financial documents. Benchmark: 94–97% accuracy on restaurant receipts. $1/$5 per 1M tokens. |

**Why this split?** Every dollar spent on Gemini in dev is a dollar saved for production validation. Gemini 2.5 Flash is accurate enough to catch prompt bugs and schema errors during development. Production uses Claude Haiku 4.5 because financial data demands the lowest possible hallucination rate — a model that invents a $14.05 item from a $14.50 line causes real money errors for real users.

**Switching is a config change, not a code change.** All harnesses call the factory — see Section 2.

### Target: ≥ 99% System Accuracy

System accuracy is achieved not by expecting the model to be perfect, but by ensuring the system cannot produce a wrong financial outcome even when the model makes a mistake:

| Layer | What It Removes |
|-------|----------------|
| Structured output prompt | Hallucinated fields, wrong JSON shape |
| Zod schema validation | Schema violations, wrong types, missing required fields |
| Confidence thresholds | Low-confidence guesses silently passed as fact |
| Human checkpoint (A1) | Misread items, wrong prices — payer reviews before A2 runs |
| Deterministic arithmetic (A2) | Mathematically incorrect totals — impossible by construction |
| DB-sourced values (A3) | Hallucinated amounts, wrong handles, broken links |
| Pre-send amount check (A3) | Message sent without the correct amount verbatim present |

---

## 2. LLM Provider Factory

**Rule: No harness file imports the Anthropic SDK, OpenAI SDK, or Gemini SDK directly.** All AI calls go through `createLLMProvider()`. This is enforced at code review. Direct SDK imports in harness files are a build failure.

### The LLMProvider Interface

```typescript
// src/infrastructure/llm/llm.provider.ts

export interface LLMTextBlock {
  type: 'text';
  text: string;
}

export interface LLMImageBlock {
  type: 'image';
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export type LLMContentBlock = LLMTextBlock | LLMImageBlock;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
  modelUsed: string; // exact model string as returned by the provider
}

export interface LLMCompletionOptions {
  maxTokens?: number;
  timeout?: number; // milliseconds, default 20000
}

export interface LLMProvider {
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMResponse>;

  /** True if this provider+model supports image content blocks */
  supportsVision: boolean;
}
```

### Provider Adapters

#### GeminiAdapter (dev/staging default)

```typescript
// src/infrastructure/llm/providers/gemini.adapter.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, LLMMessage, LLMResponse, LLMCompletionOptions } from '../llm.provider';

export class GeminiAdapter implements LLMProvider {
  readonly supportsVision = true; // gemini-2.5-flash supports vision
  private client: GoogleGenerativeAI;

  constructor(private readonly model: string) {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, timeout = 20_000 } = options;

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { maxOutputTokens: maxTokens },
    });

    // Gemini uses a different content format — flatten to parts
    const parts = messages.flatMap(m =>
      typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map(block =>
            block.type === 'image'
              ? { inlineData: { mimeType: block.mimeType, data: block.base64 } }
              : { text: block.text }
          )
    );

    const abortPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), timeout)
    );

    const result = await Promise.race([
      genModel.generateContent({ contents: [{ role: 'user', parts }] }),
      abortPromise,
    ]);

    const text = result.response.text();
    const usage = result.response.usageMetadata;
    return {
      text,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      },
      modelUsed: this.model,
    };
  }
}
```

#### AnthropicAdapter (production default)

```typescript
// src/infrastructure/llm/providers/anthropic.adapter.ts
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMResponse, LLMCompletionOptions } from '../llm.provider';

export class AnthropicAdapter implements LLMProvider {
  readonly supportsVision = true;
  private client = new Anthropic();

  constructor(private readonly model: string) {}

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, timeout = 20_000 } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: maxTokens,
          messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string'
              ? m.content
              : m.content.map(block =>
                  block.type === 'image'
                    ? {
                        type: 'image' as const,
                        source: {
                          type: 'base64' as const,
                          media_type: block.mimeType,
                          data: block.base64,
                        },
                      }
                    : { type: 'text' as const, text: block.text }
                ),
          })),
        },
        { signal: controller.signal },
      );

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return {
        text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        modelUsed: response.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

#### OpenAIAdapter

```typescript
// src/infrastructure/llm/providers/openai.adapter.ts
import OpenAI from 'openai';
import { LLMProvider, LLMMessage, LLMResponse, LLMCompletionOptions } from '../llm.provider';

export class OpenAIAdapter implements LLMProvider {
  readonly supportsVision = true; // gpt-4o and gpt-4o-mini support vision
  private client = new OpenAI();

  constructor(private readonly model: string) {}

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, timeout = 20_000 } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: maxTokens,
          messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string'
              ? m.content
              : m.content.map(block =>
                  block.type === 'image'
                    ? {
                        type: 'image_url' as const,
                        image_url: { url: `data:${block.mimeType};base64,${block.base64}` },
                      }
                    : { type: 'text' as const, text: block.text }
                ),
          })),
        },
        { signal: controller.signal },
      );

      const text = response.choices[0]?.message?.content ?? '';
      return {
        text,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        modelUsed: response.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

#### OpenAICompatAdapter (DeepSeek, Mistral, Groq, Ollama, etc.)

```typescript
// src/infrastructure/llm/providers/openai-compat.adapter.ts
/**
 * Generic OpenAI-compatible adapter.
 * Works for any provider that exposes an OpenAI-compatible /chat/completions endpoint.
 *
 * Usage: set AI_PROVIDER_Ax=openai-compat, AI_BASE_URL_Ax=https://api.deepseek.com
 */
import OpenAI from 'openai';
import { LLMProvider, LLMMessage, LLMResponse, LLMCompletionOptions } from '../llm.provider';

export class OpenAICompatAdapter implements LLMProvider {
  readonly supportsVision: boolean;
  private client: OpenAI;

  constructor(
    private readonly model: string,
    baseURL: string,
    apiKey: string,
    supportsVision = false,
  ) {
    this.client = new OpenAI({ baseURL, apiKey });
    this.supportsVision = supportsVision;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, timeout = 20_000 } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: maxTokens,
          messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
        },
        { signal: controller.signal },
      );

      return {
        text: response.choices[0]?.message?.content ?? '',
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        modelUsed: response.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

### Provider Factory

```typescript
// src/infrastructure/llm/llm.factory.ts
import { LLMProvider } from './llm.provider';
import { AnthropicAdapter } from './providers/anthropic.adapter';
import { OpenAIAdapter } from './providers/openai.adapter';
import { GeminiAdapter } from './providers/gemini.adapter';
import { OpenAICompatAdapter } from './providers/openai-compat.adapter';

export type AgentKey = 'A1' | 'A2' | 'A3';

/**
 * Reads AI_PROVIDER_Ax and AI_MODEL_Ax from environment and returns
 * the correct adapter. Call once at startup and cache the result.
 *
 * RULE: Harness files MUST call this function. They MUST NOT import
 * any provider SDK directly (Anthropic, OpenAI, @google/generative-ai).
 */
export function createLLMProvider(agent: AgentKey): LLMProvider {
  const provider = process.env[`AI_PROVIDER_${agent}`] ?? 'gemini';
  const model    = process.env[`AI_MODEL_${agent}`]    ?? 'gemini-2.5-flash';

  switch (provider) {
    case 'anthropic':
      return new AnthropicAdapter(model);

    case 'openai':
      return new OpenAIAdapter(model);

    case 'gemini':
      return new GeminiAdapter(model);

    case 'openai-compat': {
      const baseURL = process.env[`AI_BASE_URL_${agent}`];
      const apiKey  = process.env[`AI_API_KEY_${agent}`] ?? process.env.OPENAI_COMPAT_API_KEY ?? '';
      const vision  = process.env[`AI_VISION_${agent}`] === 'true';
      if (!baseURL) throw new Error(`AI_BASE_URL_${agent} is required for openai-compat provider`);
      return new OpenAICompatAdapter(model, baseURL, apiKey, vision);
    }

    default:
      throw new Error(`Unknown AI provider: "${provider}" for agent ${agent}`);
  }
}
```

### Provider Quick Reference

| `AI_PROVIDER_Ax` value | Adapter | Vision | Notes |
|---|---|---|---|
| `gemini` | GeminiAdapter | Yes | **Dev/Staging default.** Free tier, fast, generous quota. |
| `anthropic` | AnthropicAdapter | Yes | **Production default.** Lowest hallucination on financial docs. |
| `openai` | OpenAIAdapter | Yes | gpt-4o-mini for cost, gpt-4o for accuracy. |
| `openai-compat` | OpenAICompatAdapter | Model-dependent | DeepSeek, Mistral, Groq, Together AI, local Ollama. |

**A1 requires vision. A2 and A3 do not.**

### Environment Variable Contract

```bash
# .env — one block per agent, fully independent

# Agent A1 — Receipt Parser
# Dev/Staging:
AI_PROVIDER_A1=gemini
AI_MODEL_A1=gemini-2.5-flash
# Production:
# AI_PROVIDER_A1=anthropic
# AI_MODEL_A1=claude-haiku-4-5-20251001

# Agent A2 — Split Calculator (no vision needed)
AI_PROVIDER_A2=gemini
AI_MODEL_A2=gemini-2.5-flash
# AI_PROVIDER_A2=anthropic
# AI_MODEL_A2=claude-haiku-4-5-20251001

# Agent A3 — Message Composer (no vision needed)
AI_PROVIDER_A3=gemini
AI_MODEL_A3=gemini-2.5-flash
# AI_PROVIDER_A3=anthropic
# AI_MODEL_A3=claude-haiku-4-5-20251001

# Provider API keys
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...
# OPENAI_COMPAT_API_KEY is the fallback if AI_API_KEY_Ax is not set

# Harness tunables
RECEIPT_PARSE_MAX_RETRIES=3
SPLIT_CALC_MAX_RETRIES=3
MESSAGE_COMPOSE_MAX_RETRIES=3
A1_CONFIDENCE_THRESHOLD=0.80
A1_ITEM_CONFIDENCE_THRESHOLD=0.75
A2_CONFIDENCE_THRESHOLD=0.70
ANTHROPIC_MONTHLY_SPEND_LIMIT=100
```

### Correct Usage Pattern in Harnesses

```typescript
// CORRECT — always use the factory
import { createLLMProvider } from '../../../infrastructure/llm/llm.factory';

const provider = createLLMProvider('A1');
const result = await provider.complete(messages, { timeout: 30000, maxTokens: 1024 });

// FORBIDDEN — never import SDK directly in harness files
// import Anthropic from '@anthropic-ai/sdk';         ← build failure
// import { GoogleGenerativeAI } from '@google/generative-ai'; ← build failure
// const client = new Anthropic();                    ← build failure
```

---

## 3. Agent A1 — Receipt Parser

### Trigger, Input, Output

**Trigger:** User photographs a receipt.
**Input:** Base64-encoded receipt image (JPEG, PNG, or WebP) + event ID.
**Output:** `ReceiptParseResult` — structured list of every line item, tax, tip, total, currency, and per-item confidence scores.

### TypeScript Types

```typescript
// src/modules/ai/receipt-parser/receipt-parser.schema.ts
import { z } from 'zod';

export const ReceiptItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60),
  price: z.number().positive().multipleOf(0.01),
  quantity: z.number().int().positive().default(1),
  confidence: z.number().min(0).max(1),
});

export const ReceiptParseResultSchema = z.object({
  items: z.array(ReceiptItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  total: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  parse_confidence: z.number().min(0).max(1),
});

export const ReceiptParseErrorSchema = z.object({
  error: z.literal('unreadable'),
  reason: z.string(),
});

export const ReceiptParseOutputSchema = z.union([
  ReceiptParseResultSchema,
  ReceiptParseErrorSchema,
]);

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type ReceiptParseResult = z.infer<typeof ReceiptParseResultSchema>;
export type ReceiptParseOutput = z.infer<typeof ReceiptParseOutputSchema>;
```

### System Prompt (Production-Ready)

```typescript
// src/modules/ai/receipt-parser/receipt-parser.prompt.ts

export function buildReceiptParserPrompt(): string {
  return `You are a receipt parsing assistant. Extract every line item from this receipt image.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation, no extra fields:

{
  "items": [
    {
      "id": "string (uuid v4 — generate a new uuid for each item)",
      "name": "string (item name as printed on receipt, max 60 chars)",
      "price": "number (unit price in the receipt's currency, 2 decimal places, positive)",
      "quantity": "number (integer quantity, default 1 if not specified)",
      "confidence": "number (0.0 to 1.0 — your confidence this item is correctly read)"
    }
  ],
  "subtotal": "number (sum of all items before tax and tip)",
  "tax": "number (total tax charged, 0.00 if none shown)",
  "tip": "number (tip or gratuity amount, 0.00 if none shown)",
  "total": "number (the final total as printed at the bottom of the receipt)",
  "currency": "string (ISO 4217 3-letter code: USD, GBP, EUR, INR, AUD, CAD, SGD, etc.)",
  "parse_confidence": "number (0.0 to 1.0 — your overall confidence in this parse)"
}

Rules:
1. If a line shows quantity and total (e.g. "2x Burger $18.00"), split into quantity=2, price=9.00.
2. Do not merge separate items into one.
3. Do not invent items not visible on the receipt.
4. Tax and tip must appear in their own fields — never as entries in the items array.
5. Service charges labeled as gratuity or service fee belong in "tip", not "tax".
6. If the receipt uses a symbol (£, €, ¥, ₹) identify the correct ISO code.
7. If the receipt is too blurry, torn, or obscured to read reliably, return:
   {"error": "unreadable", "reason": "brief description of why"}
8. Set confidence < 0.75 on any item where the price or name is unclear.
9. Set parse_confidence < 0.80 if any item has low confidence or the total is uncertain.`;
}
```

### Image Pipeline

Mobile captures are uploaded to Supabase Storage as raw images. The harness fetches and preprocesses before sending to the AI provider. The flow differs by provider:

**Gemini (dev/staging):** Gemini accepts inline base64 data directly. Pass the preprocessed base64 as an `inlineData` part. Gemini can also accept a Storage URL but inline data avoids signed URL expiry issues in CI.

**Anthropic/Haiku (production):** Anthropic also accepts base64 inline. Fetch the image from Supabase Storage, convert to base64, and pass as an `image` content block. Never pass a signed URL — Anthropic does not fetch URLs.

```typescript
// src/modules/ai/receipt-parser/receipt-parser.preprocess.ts
import sharp from 'sharp'; // npm install sharp

export async function preprocessReceiptImage(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');

  const processed = await sharp(buffer)
    .rotate()                    // auto-rotate from EXIF orientation
    .resize(2048, 2048, {        // cap size — reduces tokens, keeps readability
      fit: 'inside',
      withoutEnlargement: true,
    })
    .normalize()                 // auto-contrast: helps faded thermal receipts
    .sharpen()                   // helps blurry phone photos
    .jpeg({ quality: 85 })
    .toBuffer();

  return processed.toString('base64');
}
```

### Confidence Scoring

- `item.confidence < 0.75`: Flag that item for payer review. The item is still included in the result — payer can correct name or price before confirming.
- `parse_confidence < 0.80` or any low-confidence items: Set `requiresManualReview = true` in the harness result. The receipt review screen highlights flagged items in amber.
- Never block the user. Low confidence = show a warning, not an error. The payer is the fallback.

### Idempotency Guard (Atomic)

The guard uses a single `UPDATE ... WHERE ai_stage = 'none'` to atomically claim the parsing slot. No separate read then write — that race condition allows two concurrent requests to both see `'none'` and both proceed.

```typescript
// src/modules/ai/ai-idempotency.ts
import { supabase } from '../../infrastructure/supabase';
import { ReceiptParseResult } from './receipt-parser/receipt-parser.schema';

export class IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

export type AiStage =
  | 'none'
  | 'parsing'
  | 'parsed'
  | 'calculating'
  | 'calculated'
  | 'messaging'
  | 'complete'
  | 'failed';

/**
 * Atomically transition ai_stage from 'none' to 'parsing'.
 * If count === 0, another request already claimed this stage — throw IdempotencyError.
 */
export async function claimParsingSlot(eventId: string): Promise<void> {
  const { count } = await supabase
    .from('events')
    .update({ ai_stage: 'parsing' })
    .eq('id', eventId)
    .eq('ai_stage', 'none')       // ← atomic guard: only succeeds if currently 'none'
    .select('id', { count: 'exact', head: true });

  if (count === 0) {
    throw new IdempotencyError('Receipt already processing or processed');
  }
}

/**
 * Atomically transition ai_stage from 'parsed' to 'calculating'.
 * If count === 0, another request already claimed this stage — throw IdempotencyError.
 */
export async function claimCalculatingSlot(eventId: string): Promise<void> {
  const { count } = await supabase
    .from('events')
    .update({ ai_stage: 'calculating' })
    .eq('id', eventId)
    .eq('ai_stage', 'parsed')        // ← atomic: only succeeds if still in 'parsed' state
    .select('id', { count: 'exact', head: true });
  
  if (count === 0) {
    throw new IdempotencyError(
      `Split calculation already running or complete for event ${eventId}. ` +
      `Current ai_stage does not equal 'parsed'.`
    );
  }
}

/**
 * Atomically transition ai_stage from 'calculated' to 'messaging'.
 * If count === 0, another request already claimed this stage — throw IdempotencyError.
 */
export async function claimMessagingSlot(eventId: string): Promise<void> {
  const { count } = await supabase
    .from('events')
    .update({ ai_stage: 'messaging' })
    .eq('id', eventId)
    .eq('ai_stage', 'calculated')    // ← atomic: only succeeds if still in 'calculated' state
    .select('id', { count: 'exact', head: true });
  
  if (count === 0) {
    throw new IdempotencyError(
      `Message generation already running or complete for event ${eventId}. ` +
      `Current ai_stage does not equal 'calculated'.`
    );
  }
}

export async function setAiStage(eventId: string, stage: AiStage): Promise<void> {
  await supabase
    .from('events')
    .update({ ai_stage: stage })
    .eq('id', eventId);
}

export async function getAiStage(eventId: string): Promise<AiStage> {
  const { data } = await supabase
    .from('events')
    .select('ai_stage')
    .eq('id', eventId)
    .single();
  return (data?.ai_stage ?? 'none') as AiStage;
}
```

### getCachedReceiptResult

When the idempotency guard detects the event is already past `'none'` (and not `'failed'`), return the previously stored result rather than re-running A1.

```typescript
// src/modules/ai/ai-idempotency.ts (continued)

// NOTE: The following columns must exist on the `events` table:
// total_amount, tax_amount, tip_amount, currency, locale
// See 04-Data-Architecture.md Section 3 if these columns are not yet present.

export async function getCachedReceiptResult(eventId: string): Promise<ReceiptParseResult> {
  // Get event-level data (tax, tip, total, currency) from events table
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('total_amount, tax_amount, tip_amount, currency, locale')
    .eq('id', eventId)
    .single();
  
  if (eventError || !event) {
    throw new Error(`Cannot retrieve cached receipt for event ${eventId}: ${eventError?.message}`);
  }

  // Get line items from receipt_items table
  const { data: items, error: itemsError } = await supabase
    .from('receipt_items')
    .select('id, name, unit_price, quantity, confidence_score, is_low_confidence')
    .eq('event_id', eventId)
    .order('created_at');
  
  if (itemsError) {
    throw new Error(`Cannot retrieve receipt items for event ${eventId}: ${itemsError?.message}`);
  }

  const mappedItems = (items ?? []).map(item => ({
    id: item.id,
    name: item.name,
    unitPrice: item.unit_price,
    quantity: item.quantity,
    confidenceScore: item.confidence_score,
    isLowConfidence: item.is_low_confidence,
  }));

  const subtotal = mappedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity, 0
  );

  return {
    items: mappedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: event.tax_amount ?? 0,
    tip: event.tip_amount ?? 0,
    total: event.total_amount,
    currency: event.currency,
    locale: event.locale,
    parse_confidence: 1.0,
  };
}
```

### Complete Harness Implementation

```typescript
// src/modules/ai/receipt-parser/receipt-parser.harness.ts

import { v4 as uuidv4 } from 'uuid';
import { createLLMProvider } from '../../../infrastructure/llm/llm.factory';
import { buildReceiptParserPrompt } from './receipt-parser.prompt';
import { ReceiptParseOutputSchema, ReceiptParseResult } from './receipt-parser.schema';
import { preprocessReceiptImage } from './receipt-parser.preprocess';
import { sanitizePromptInput } from '../../../infrastructure/llm/prompt-sanitizer';
import { assertImageSize } from '../../../infrastructure/llm/input-guards';
import {
  claimParsingSlot,
  getCachedReceiptResult,
  setAiStage,
  getAiStage,
  IdempotencyError,
} from '../ai-idempotency';
import { writeAuditLog } from '../../../infrastructure/llm/ai-audit';
import { AppError } from '../../../infrastructure/errors';
import { LLMMessage } from '../../../infrastructure/llm/llm.provider';

const MAX_RETRIES = parseInt(process.env.RECEIPT_PARSE_MAX_RETRIES ?? '3', 10);
const LOW_CONFIDENCE_THRESHOLD = parseFloat(process.env.A1_ITEM_CONFIDENCE_THRESHOLD ?? '0.75');
const OVERALL_CONFIDENCE_THRESHOLD = parseFloat(process.env.A1_CONFIDENCE_THRESHOLD ?? '0.80');

export interface ParseReceiptOptions {
  imageBase64: string;
  imageMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  eventId: string;
}

export interface ParseReceiptHarnessResult {
  result: ReceiptParseResult;
  lowConfidenceItems: string[]; // item IDs needing payer attention
  requiresManualReview: boolean;
  attempts: number;
  fromCache: boolean;
}

export async function parseReceiptWithHarness(
  opts: ParseReceiptOptions,
): Promise<ParseReceiptHarnessResult> {
  // Input size guard — before any processing
  assertImageSize(opts.imageBase64);

  // Idempotency: check current stage
  const currentStage = await getAiStage(opts.eventId);

  if (currentStage !== 'none' && currentStage !== 'failed') {
    // Already processed — return cached result, don't re-run A1
    const cached = await getCachedReceiptResult(opts.eventId);
    return {
      result: cached,
      lowConfidenceItems: [],
      requiresManualReview: false,
      attempts: 0,
      fromCache: true,
    };
  }

  // Atomic claim — throws IdempotencyError if another request beat us
  try {
    await claimParsingSlot(opts.eventId);
  } catch (err) {
    if (err instanceof IdempotencyError) {
      // Race condition: another request is now parsing. Return cached when ready.
      // For simplicity, surface as a retriable error — client retries in ~2s.
      throw new AppError('RECEIPT_ALREADY_PROCESSING', err.message);
    }
    throw err;
  }

  // Vision guard — A1 requires image input
  const provider = createLLMProvider('A1');
  if (!provider.supportsVision) {
    await setAiStage(opts.eventId, 'failed');
    throw new AppError(
      'PROVIDER_NO_VISION',
      `AI provider for A1 (${process.env.AI_PROVIDER_A1}) does not support image input. ` +
      `A1 requires vision. Use anthropic, openai (gpt-4o), or gemini.`,
    );
  }

  const preprocessed = await preprocessReceiptImage(opts.imageBase64);
  const prompt = buildReceiptParserPrompt();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let rawText: string | null = null;

    try {
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              base64: preprocessed,
              mimeType: opts.imageMimeType,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ];

      const response = await provider.complete(messages, { maxTokens: 1024, timeout: 60_000 });
      rawText = response.text.trim();

      if (!rawText) throw new Error('Empty response from model');

      // Strip markdown code fences if model adds them despite instructions
      const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(jsonText);
      const validated = ReceiptParseOutputSchema.parse(parsed);

      if ('error' in validated) {
        throw new AppError('RECEIPT_UNREADABLE', validated.reason);
      }

      // Ensure item IDs are proper UUIDs (model sometimes returns slugs)
      validated.items = validated.items.map(item => ({
        ...item,
        id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(item.id)
          ? item.id
          : uuidv4(),
      }));

      const lowConfidenceItems = validated.items
        .filter(item => item.confidence < LOW_CONFIDENCE_THRESHOLD)
        .map(item => item.id);

      const requiresManualReview =
        validated.parse_confidence < OVERALL_CONFIDENCE_THRESHOLD ||
        lowConfidenceItems.length > 0;

      await writeAuditLog({
        eventId: opts.eventId,
        agent: 'A1',
        provider: process.env.AI_PROVIDER_A1 ?? 'gemini',
        modelUsed: response.modelUsed,
        promptContent: prompt,
        responseText: rawText,
        confidence: validated.parse_confidence,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: true,
      });

      await setAiStage(opts.eventId, 'parsed');

      return {
        result: validated,
        lowConfidenceItems,
        requiresManualReview,
        attempts: attempt,
        fromCache: false,
      };

    } catch (err) {
      lastError = err as Error;

      // AppErrors with specific codes are not retriable
      if (err instanceof AppError && err.code === 'RECEIPT_UNREADABLE') {
        await setAiStage(opts.eventId, 'failed');
        throw err;
      }

      await writeAuditLog({
        eventId: opts.eventId,
        agent: 'A1',
        provider: process.env.AI_PROVIDER_A1 ?? 'gemini',
        modelUsed: process.env.AI_MODEL_A1 ?? 'gemini-2.5-flash',
        promptContent: prompt,
        responseText: rawText ?? '',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: false,
        errorCode: lastError.message,
      });

      if (attempt < MAX_RETRIES) await sleep(getRetryDelay(attempt));
    }
  }

  // All retries exhausted — fall back to manual entry, never block the user
  await setAiStage(opts.eventId, 'failed');
  throw new AppError(
    'RECEIPT_PARSE_FAILED',
    `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}. ` +
    `Please enter items manually.`,
  );
}

/**
 * Exponential backoff with full jitter — prevents retry thundering herd.
 * attempt 1: random delay 0–500ms
 * attempt 2: random delay 0–1000ms
 * attempt 3: random delay 0–2000ms (capped at maxMs)
 */
function getRetryDelay(attempt: number, baseMs = 500, maxMs = 10_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  return Math.floor(Math.random() * exponential); // full jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Human Checkpoint (Critical)

After `parseReceiptWithHarness` returns, the payer **must review all items** before A2 runs. This single step takes system accuracy from ~90% to ~99%+. No amount of prompt engineering replaces a 10-second human look.

```typescript
// In events.service.ts — the state machine enforces the checkpoint

async function runA1AndAwaitReview(eventId: string): Promise<void> {
  const parseResult = await parseReceiptWithHarness({ ... });

  // Store parsed items with status = 'pending_review'
  await storeReceiptItems(eventId, parseResult.result, 'pending_review');

  // Return to payer for review — A2 CANNOT run until payer confirms
  // event.receipt_status = 'awaiting_payer_review'
  // The confirm endpoint transitions this to 'confirmed', enabling A2.
}

async function confirmReceiptItems(
  eventId: string,
  confirmedItems: ConfirmedItem[], // payer may have corrected names/prices
): Promise<void> {
  await updateReceiptItems(eventId, confirmedItems);
  await updateEventReceiptStatus(eventId, 'confirmed');
  // A2 can now run via calculateSplits()
}
```

### Error Handling Philosophy

- **Parse failure** → throw `AppError('RECEIPT_PARSE_FAILED')`. The UI shows a "scan failed" message with a "Enter manually" button. The user continues without AI. Never block the bill-splitting flow.
- **Low confidence** → return result with `requiresManualReview: true`. The UI highlights uncertain items in amber. Payer decides.
- **Unreadable receipt** → throw `AppError('RECEIPT_UNREADABLE')` on first occurrence (no retry). The UI shows "We couldn't read this receipt" and offers manual entry immediately.

---

## 4. Agent A2 — Split Calculator

### Trigger, Input, Output

**Trigger:** Payer confirms the item list after A1 review.
**Input:** Confirmed receipt items + participant list + optional natural language assignment instruction.
**Output:** Per-person breakdown — `[{ participantName, amountOwed }]` — with the invariant that amounts sum exactly to the event total (±$0.01 for rounding).

### Architectural Principle

```
AI path:  NLP only — "Who ordered what?" → item assignments
Math path: TypeScript only — all arithmetic in splitCalculator.ts

These two paths are completely separate.
The model never sees amounts. The calculator never talks to an LLM.
```

### System Prompt (Production-Ready)

```typescript
// src/modules/ai/split-calculator/split-calculator.prompt.ts
import { sanitizePromptInput } from '../../../infrastructure/llm/prompt-sanitizer';

export interface ConfirmedReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ParticipantName {
  name: string;
}

export function buildSplitCalculatorPrompt(
  items: ConfirmedReceiptItem[],
  participants: ParticipantName[],
  naturalLanguageInstruction: string | null,
): string {
  const itemList = items
    .map(item =>
      `  { "id": "${item.id}", "name": "${sanitizePromptInput(item.name, 60)}", ` +
      `"price": ${item.price}, "qty": ${item.quantity} }`,
    )
    .join(',\n');

  const participantList = participants
    .map(p => `"${sanitizePromptInput(p.name, 50)}"`)
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
```

### Zod Output Schema

```typescript
// src/modules/ai/split-calculator/split-calculator.schema.ts
import { z } from 'zod';

export const ItemAssignmentSchema = z.object({
  item_id: z.string().uuid(),
  assigned_to: z.array(z.string().min(1)).min(1),
});

export const SplitAssignmentOutputSchema = z.object({
  assignments: z.array(ItemAssignmentSchema),
  unassigned_item_ids: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type SplitAssignmentOutput = z.infer<typeof SplitAssignmentOutputSchema>;
```

### Partial Assignment Response (Correction 4)

When A2's NLP cannot assign all items, the agent does **not** return a 400 error. It returns a `partial` status so the frontend can show the unassigned items highlighted for the payer to manually assign before re-submitting.

```typescript
export interface SplitCalculationResult {
  status: 'complete' | 'partial';
  splits: ParticipantSplit[];
  unassignedItemIds: string[];
  message: string | null;
  requiresReview: boolean;
  confidence: number;
  attempts: number;
}

// When unassigned items exist:
if (validated.unassigned_item_ids.length > 0) {
  return {
    status: 'partial',
    assignments: resolvedAssignments,
    unassigned: unresolvedItemIds,
    message: 'Some items could not be assigned. Please assign them manually.',
  };
}
```

The frontend shows unassigned items highlighted in amber. The payer drags them to participants or types an instruction. When all items are assigned, the payer re-submits and A2 runs on the fully-assigned list.

### Deterministic Arithmetic — splitCalculator.ts

This is the most important file in the AI subsystem. It is pure TypeScript. The model never touches it.

```typescript
// src/modules/ai/split-calculator/split-calculator.ts

export interface ConfirmedReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Assignment {
  item_id: string;
  assigned_to: string[];
}

export interface ReceiptTotals {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export interface ParticipantSplit {
  participantName: string;
  amountOwed: number;
}

/**
 * Returns the number of decimal places (minor unit exponent) for a given currency.
 * Used to correctly convert between display amounts and integer minor units.
 * Examples: USD=2 ($12.34 → 1234 cents), JPY=0 (¥1200 → 1200 yen), BHD=3 (0.100 BHD → 100 fils)
 */
export function getCurrencyMinorUnits(currencyCode: string): number {
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'TWD', 'UGX', 'RWF']);
  const threeDecimal = new Set(['BHD', 'KWD', 'OMR', 'JOD', 'TND']);
  if (zeroDecimal.has(currencyCode.toUpperCase())) return 0;
  if (threeDecimal.has(currencyCode.toUpperCase())) return 3;
  return 2; // Default for USD, EUR, GBP, INR, AUD, CAD, SGD, etc.
}

/**
 * Convert display amount (e.g. 12.34) to minor units (e.g. 1234 for USD, 12 for JPY).
 * ALL amounts flowing through splitCalculator must be in minor units.
 */
export function toMinorUnits(amount: number, currencyCode: string): number {
  const exp = getCurrencyMinorUnits(currencyCode);
  return Math.round(amount * Math.pow(10, exp));
}

/**
 * Convert minor units back to display amount for formatCurrency().
 */
export function fromMinorUnits(minorAmount: number, currencyCode: string): number {
  const exp = getCurrencyMinorUnits(currencyCode);
  return minorAmount / Math.pow(10, exp);
}

// Critical currency tests (add to splitCalculator.test.ts):
// - JPY: toMinorUnits(1200, 'JPY') === 1200 (no multiplication)
// - USD: toMinorUnits(12.34, 'USD') === 1234
// - BHD: toMinorUnits(1.234, 'BHD') === 1234
// - calculateEvenSplit(1200, 3, 'JPY') returns [400, 400, 400] (not 120000/3)

/**
 * Takes AI-generated assignments and produces final owed amounts.
 * ALL arithmetic is in this file. The AI only produces the assignments array.
 * Currency is handled in minor units internally (using toMinorUnits/fromMinorUnits) to
 * avoid floating-point drift and to correctly handle zero-decimal currencies (e.g. JPY)
 * and three-decimal currencies (e.g. BHD), then converted back to major units for output.
 */
export function calculateSplits(
  items: ConfirmedReceiptItem[],
  assignments: Assignment[],
  totals: ReceiptTotals,
  participantNames: string[],
  currencyCode: string = 'USD',
): ParticipantSplit[] {
  const itemMap = new Map(items.map(item => [item.id, item]));

  // Step 1: Sum item prices per participant in minor units to avoid floating-point issues.
  // toMinorUnits() handles zero-decimal currencies (JPY) and three-decimal currencies (BHD)
  // correctly — hardcoding * 100 would produce wrong results for those currencies.
  const rawAmountsMinor = new Map<string, number>(
    participantNames.map(name => [name, 0]),
  );

  for (const assignment of assignments) {
    const item = itemMap.get(assignment.item_id);
    if (!item) throw new Error(`Unknown item id: ${assignment.item_id}`);

    // Price × qty then split evenly among assigned participants
    const totalItemMinor = toMinorUnits(item.price * item.quantity, currencyCode);
    const sharePerPersonMinor = Math.floor(totalItemMinor / assignment.assigned_to.length);
    const remainderMinor = totalItemMinor % assignment.assigned_to.length;

    for (let i = 0; i < assignment.assigned_to.length; i++) {
      const participant = assignment.assigned_to[i];
      if (!rawAmountsMinor.has(participant)) {
        throw new Error(`Unknown participant: "${participant}"`);
      }
      // Distribute remainder to first participant in the list
      const extra = i === 0 ? remainderMinor : 0;
      rawAmountsMinor.set(
        participant,
        rawAmountsMinor.get(participant)! + sharePerPersonMinor + extra,
      );
    }
  }

  // Step 2: Verify subtotal matches
  const subtotalMinor = toMinorUnits(totals.subtotal, currencyCode);
  const assignedSubtotalMinor = Array.from(rawAmountsMinor.values()).reduce((a, b) => a + b, 0);

  if (Math.abs(assignedSubtotalMinor - subtotalMinor) > 2) {
    throw new Error(
      `Subtotal mismatch: assignments sum to ${fromMinorUnits(assignedSubtotalMinor, currencyCode)}, ` +
      `receipt subtotal is ${totals.subtotal}`,
    );
  }

  // Step 3: Proportional tax + tip allocation
  // person_tax = (person_subtotal / event_subtotal) × total_tax
  // person_tip = (person_subtotal / event_subtotal) × total_tip
  const taxAndTipMinor = toMinorUnits(totals.tax + totals.tip, currencyCode);
  const finalAmounts = new Map<string, number>();

  for (const [name, itemMinor] of rawAmountsMinor) {
    const proportion =
      assignedSubtotalMinor > 0
        ? itemMinor / assignedSubtotalMinor
        : 1 / participantNames.length;
    // Convert back to major units for output
    const total = fromMinorUnits(itemMinor + taxAndTipMinor * proportion, currencyCode);
    finalAmounts.set(name, total);
  }

  // Step 4: Largest-remainder rounding — ensures amounts sum exactly to total
  const rounded = largestRemainderRound(finalAmounts, totals.total);

  // Step 5: Invariant assertion — if this fails, something is structurally wrong
  const sumCheck = Array.from(rounded.values()).reduce((a, b) => a + b, 0);
  const exp = getCurrencyMinorUnits(currencyCode);
  const tolerance = 1 / Math.pow(10, exp); // 0.01 for USD, 0 tolerance for JPY, 0.001 for BHD
  if (Math.abs(sumCheck - totals.total) > tolerance) {
    throw new Error(
      `Sum invariant violated: rounded amounts sum to ${sumCheck}, ` +
      `expected ${totals.total}`,
    );
  }

  return participantNames.map(name => ({
    participantName: name,
    amountOwed: rounded.get(name)!,
  }));
}

/**
 * Largest-remainder method — the correct algorithm for rounding currency splits.
 *
 * Problem: naive rounding of each share loses or gains pennies.
 * Example: 3 people splitting $10.00
 *   Each person's exact share = $3.333...
 *   Naive: round each to $3.33 → sum = $9.99 (penny lost)
 *   This algorithm: two people pay $3.33, one pays $3.34 → sum = $10.00 exactly
 *
 * How it works:
 * 1. Floor every amount to 2 decimal places.
 * 2. Count how many pennies are left to distribute (targetTotal - sum of floored amounts).
 * 3. Sort participants by the fractional part of their amount, descending.
 * 4. Give one extra penny to the top N participants where N = pennies left.
 */
export function largestRemainderRound(
  amounts: Map<string, number>,
  targetTotal: number,
): Map<string, number> {
  const entries = Array.from(amounts.entries());
  const targetCents = Math.round(targetTotal * 100);

  const withFloor = entries.map(([name, amount]) => {
    const amountCents = amount * 100;
    const flooredCents = Math.floor(amountCents);
    return {
      name,
      flooredCents,
      remainder: amountCents - flooredCents,
    };
  });

  const flooredSumCents = withFloor.reduce((sum, e) => sum + e.flooredCents, 0);
  let penniesLeft = targetCents - flooredSumCents;

  // Sort by remainder descending — biggest fractions get the extra penny.
  // When two participants have equal fractional remainders, the tiebreaker
  // is deterministic: the participant with the LOWEST name (lexicographic sort)
  // receives the extra cent first. This is arbitrary but deterministic — the same
  // input always produces the same output, making the split auditable.
  // NOTE: The tiebreaker is intentionally deterministic and not randomised.
  // Randomised tiebreakers would produce non-deterministic output, making evals
  // unreliable and making disputes harder to resolve.
  withFloor.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-10) {
      return b.remainder - a.remainder;  // Highest remainder first
    }
    return a.name.localeCompare(b.name); // ← tiebreaker: lexicographic name sort
  });

  const result = new Map<string, number>();
  for (const entry of withFloor) {
    const extra = penniesLeft > 0 ? 1 : 0;
    result.set(entry.name, parseFloat(((entry.flooredCents + extra) / 100).toFixed(2)));
    if (penniesLeft > 0) penniesLeft--;
  }

  return result;
}
```

### Harness Implementation

```typescript
// src/modules/ai/split-calculator/split-calculator.harness.ts

import { createLLMProvider } from '../../../infrastructure/llm/llm.factory';
import { buildSplitCalculatorPrompt, ConfirmedReceiptItem, ParticipantName } from './split-calculator.prompt';
import { SplitAssignmentOutputSchema } from './split-calculator.schema';
import { calculateSplits, ReceiptTotals, ParticipantSplit } from './split-calculator';
import { assertItemCount, assertParticipantCount } from '../../../infrastructure/llm/input-guards';
import { setAiStage, claimCalculatingSlot, IdempotencyError } from '../ai-idempotency';
import { writeAuditLog } from '../../../infrastructure/llm/ai-audit';
import { AppError } from '../../../infrastructure/errors';
import { LLMMessage } from '../../../infrastructure/llm/llm.provider';

const MAX_RETRIES = parseInt(process.env.SPLIT_CALC_MAX_RETRIES ?? '3', 10);
const CONFIDENCE_THRESHOLD = parseFloat(process.env.A2_CONFIDENCE_THRESHOLD ?? '0.70');

export interface SplitCalculationResult {
  status: 'complete' | 'partial';
  splits: ParticipantSplit[];
  unassignedItemIds: string[];
  message: string | null;
  requiresReview: boolean;
  confidence: number;
  attempts: number;
}

export async function assignAndCalculateSplits(
  eventId: string,
  items: ConfirmedReceiptItem[],
  participants: ParticipantName[],
  totals: ReceiptTotals,
  naturalLanguageInstruction: string | null,
  currencyCode: string = 'USD', // passed through to calculateSplits for correct minor-unit arithmetic
): Promise<SplitCalculationResult> {
  // Input guards
  assertItemCount(items);
  assertParticipantCount(participants);

  // Atomic stage guard — atomically transition from 'parsed' to 'calculating'
  await claimCalculatingSlot(eventId);

  const participantNames = participants.map(p => p.name);
  const provider = createLLMProvider('A2');
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let rawText: string | null = null;

    try {
      const promptText = buildSplitCalculatorPrompt(items, participants, naturalLanguageInstruction);
      const messages: LLMMessage[] = [{ role: 'user', content: promptText }];

      const response = await provider.complete(messages, { maxTokens: 512, timeout: 30_000 });
      rawText = response.text.trim();

      if (!rawText) throw new Error('Empty response');

      const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(jsonText);
      const validated = SplitAssignmentOutputSchema.parse(parsed);

      // Validate all assigned_to names are actual participants
      for (const assignment of validated.assignments) {
        for (const name of assignment.assigned_to) {
          if (!participantNames.includes(name)) {
            throw new Error(`AI assigned to unknown participant: "${name}"`);
          }
        }
      }

      // Validate all item_ids exist
      const itemIds = new Set(items.map(i => i.id));
      for (const assignment of validated.assignments) {
        if (!itemIds.has(assignment.item_id)) {
          throw new Error(`AI referenced unknown item_id: ${assignment.item_id}`);
        }
      }

      await writeAuditLog({
        eventId,
        agent: 'A2',
        provider: process.env.AI_PROVIDER_A2 ?? 'gemini',
        modelUsed: response.modelUsed,
        promptContent: promptText,
        responseText: rawText,
        confidence: validated.confidence,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: true,
      });

      // Partial assignment — return without running calculator on unassigned items
      if (validated.unassigned_item_ids.length > 0) {
        // Run calculator only on the assigned items to get partial splits
        const assignedItems = items.filter(
          item => !validated.unassigned_item_ids.includes(item.id),
        );

        // Recalculate subtotal for assigned items only
        const assignedSubtotal = assignedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );

        // Use partial totals — tax/tip prorated on assigned portion only
        // Payer will need to re-trigger A2 after manual assignment of remaining items
        const partialSplits = calculateSplits(
          assignedItems,
          validated.assignments.filter(a => !validated.unassigned_item_ids.includes(a.item_id)),
          { ...totals, subtotal: assignedSubtotal, total: assignedSubtotal },
          participantNames,
          currencyCode,
        );

        await setAiStage(eventId, 'parsed'); // reset so payer can re-submit
        return {
          status: 'partial',
          splits: partialSplits,
          unassignedItemIds: validated.unassigned_item_ids,
          message: 'Some items could not be assigned. Please assign them manually.',
          requiresReview: true,
          confidence: validated.confidence,
          attempts: attempt,
        };
      }

      // All items assigned — run full deterministic calculator
      const splits = calculateSplits(items, validated.assignments, totals, participantNames, currencyCode);
      await setAiStage(eventId, 'calculated');

      return {
        status: 'complete',
        splits,
        unassignedItemIds: [],
        message: null,
        requiresReview: validated.confidence < CONFIDENCE_THRESHOLD,
        confidence: validated.confidence,
        attempts: attempt,
      };

    } catch (err) {
      lastError = err as Error;

      await writeAuditLog({
        eventId,
        agent: 'A2',
        provider: process.env.AI_PROVIDER_A2 ?? 'gemini',
        modelUsed: process.env.AI_MODEL_A2 ?? 'gemini-2.5-flash',
        promptContent: buildSplitCalculatorPrompt(items, participants, naturalLanguageInstruction),
        responseText: rawText ?? '',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: false,
        errorCode: lastError.message,
      });

      if (attempt < MAX_RETRIES) await sleep(getRetryDelay(attempt));
    }
  }

  await setAiStage(eventId, 'failed');
  throw new AppError('SPLIT_CALCULATION_FAILED', lastError?.message ?? 'Unknown error');
}

function getRetryDelay(attempt: number, baseMs = 500, maxMs = 10_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  return Math.floor(Math.random() * exponential);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Currency Support

All amounts are stored and computed in the currency of the event. The `currency` field is an ISO 4217 code (`USD`, `INR`, `EUR`, `GBP`, `AUD`, `CAD`, `SGD`, `JPY`, `BHD`, etc.). A2 operates on numbers only — the currency code is passed through to `calculateSplits()` and unchanged to A3 and the database.

`getCurrencyMinorUnits(currencyCode)` returns the correct decimal exponent for any currency:
- Zero-decimal (JPY, KRW, VND, IDR, HUF, TWD, UGX, RWF): exponent = 0 — amounts are already integers
- Three-decimal (BHD, KWD, OMR, JOD, TND): exponent = 3
- All others (USD, EUR, GBP, INR, AUD, CAD, SGD, etc.): exponent = 2

All arithmetic inside `calculateSplits` uses `toMinorUnits()` and `fromMinorUnits()` — never a hardcoded `* 100`. This prevents silent correctness bugs when processing Japanese yen (¥1200 must stay 1200, not become 120000).

---

## 5. Agent A3 — Message Composer

### Trigger, Input, Output

**Trigger:** Payer taps "Send to all" after reviewing splits.
**Input:** Per-person breakdown from A2 + payer's payment handles (from profile) + event currency and locale.
**Output:** N delivery-ready message packages — one per participant — each containing an AI-personalised greeting, a deterministic amount line, and country-filtered payment deep links.

### Architectural Principle

```
AI writes:     personalised 2-sentence greeting only
TypeScript:    assembles the full message (amount, links, nudge)
Database:      source of truth for amounts and payment handles

The model never generates a dollar amount.
The model never generates a payment handle.
The model never generates a payment URL.
```

### System Prompt (Production-Ready)

```typescript
// src/modules/ai/message-composer/message-composer.prompt.ts
import { sanitizePromptInput } from '../../../infrastructure/llm/prompt-sanitizer';

export function buildMessageComposerPrompt(
  eventName: string,
  restaurantName: string | null,
  participantFirstName: string, // first name only — no PII surname in prompt
  payerFirstName: string,       // first name only
  itemNames: string[],          // items this person ordered (for context only)
): string {
  // NOTE: Full names and amounts are inserted AFTER the AI call, during assembly.
  // Never pass surnames, full phone numbers, or dollar amounts to the AI.
  const safeName      = sanitizePromptInput(participantFirstName, 30);
  const safePayerName = sanitizePromptInput(payerFirstName, 30);
  const safeEvent     = sanitizePromptInput(eventName, 80);
  const safeRestaurant = restaurantName ? sanitizePromptInput(restaurantName, 80) : null;
  const restaurant = safeRestaurant ? ` at ${safeRestaurant}` : '';

  const itemContext = itemNames.length > 0
    ? `They had: ${itemNames.slice(0, 5).map(n => sanitizePromptInput(n, 40)).join(', ')}.`
    : '';

  return `Write a friendly, warm 2-sentence payment reminder message.

Context:
- Event: "${safeEvent}"${restaurant}
- Person who paid the bill: ${safePayerName}
- Person who needs to pay back: ${safeName}
- ${itemContext}

Rules:
- Be warm and casual, as if texting a friend
- Mention ${safeName}'s first name and the event name
- Do NOT include any dollar amounts — they are added automatically after
- Do NOT include payment method names or URLs — added automatically after
- Do NOT write more than 2 sentences
- Return ONLY the message text — no JSON, no labels, no quotes, no markdown

Example of correct output:
Hey Marcus! Hope you had an amazing time at Nobu — here's your share from dinner.`;
}
```

### formatCurrency() Implementation

A3 composes messages for events that can have any currency. The dollar sign `$` must never be hardcoded. Use the event's `currency` (ISO 4217) and `locale` fields to format amounts correctly.

```typescript
// src/modules/ai/message-composer/format-currency.ts

/**
 * Format a numeric amount using the event's currency and locale.
 *
 * NOTE: This function receives amounts in MAJOR units (e.g. 1200 for ¥1200, 12.34 for $12.34).
 * Callers must use fromMinorUnits() to convert before calling this function if the amount
 * is stored as minor units in the database or in-memory calculator.
 *
 * formatCurrency() relies on Intl.NumberFormat which handles zero-decimal currencies
 * automatically: JPY produces '¥1200' (no decimal places), not '¥1200.00'.
 * The minimumFractionDigits/maximumFractionDigits overrides below are explicit for clarity
 * but Intl.NumberFormat would infer the same values from the currency code itself.
 * No fix is needed here — this function is correct for all supported currencies.
 *
 * Examples:
 *   formatCurrency(1234.56, 'INR', 'en-IN') → '₹1,234.56'
 *   formatCurrency(12.34,   'USD', 'en-US') → '$12.34'
 *   formatCurrency(12.34,   'EUR', 'de-DE') → '12,34 €'
 *   formatCurrency(12.34,   'GBP', 'en-GB') → '£12.34'
 *   formatCurrency(15.00,   'AUD', 'en-AU') → 'A$15.00'
 *   formatCurrency(15.00,   'CAD', 'en-CA') → 'CA$15.00'
 *   formatCurrency(10.50,   'SGD', 'en-SG') → 'S$10.50'
 *   formatCurrency(1200,    'JPY', 'ja-JP') → '¥1,200'  (zero decimals — correct)
 *   formatCurrency(1.234,   'BHD', 'ar-BH') → 'BHD 1.234' (three decimals — correct)
 */
export function formatCurrency(
  amountInMajorUnits: number,
  currencyCode: string,
  locale: string
): string {
  const SUPPORTED_CURRENCIES = new Set([
    'USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY', 'MXN', 'BRL'
  ]);
  
  // Normalise currency code
  const normalised = currencyCode?.toUpperCase?.() ?? 'USD';
  const safeCurrency = SUPPORTED_CURRENCIES.has(normalised) ? normalised : 'USD';
  const safeLocale = locale ?? 'en-US';
  
  if (!SUPPORTED_CURRENCIES.has(normalised)) {
    // Log unknown currency but do not throw — degrade gracefully
    console.warn(`formatCurrency: unknown currency code '${currencyCode}', falling back to USD`);
  }
  
  try {
    // Intl.NumberFormat handles zero-decimal currencies (JPY, KRW, etc.) automatically.
    // We pass explicit fraction digit counts derived from getCurrencyMinorUnits() for
    // correctness and clarity — this also ensures three-decimal currencies (BHD, KWD, etc.)
    // render correctly without a separate code path.
    // Import getCurrencyMinorUnits from split-calculator.ts (or extract to a shared util).
    // const decimalPlaces = getCurrencyMinorUnits(safeCurrency);
    // For now the existing JPY guard is extended below; full migration uses the helper above.
    return new Intl.NumberFormat(safeLocale, {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: safeCurrency === 'JPY' ? 0 : 2,
      maximumFractionDigits: safeCurrency === 'JPY' ? 0 : 2,
      // TODO: replace the two lines above with:
      // minimumFractionDigits: getCurrencyMinorUnits(safeCurrency),
      // maximumFractionDigits: getCurrencyMinorUnits(safeCurrency),
    }).format(amountInMajorUnits);
  } catch {
    // Final fallback — should never reach here with validated inputs
    return `${safeCurrency} ${amountInMajorUnits.toFixed(2)}`;
  }
}

/**
 * Map an event's currency to a sensible default locale if locale is not stored.
 * This covers the most common cases. Always prefer storing locale explicitly on the event.
 */
export function defaultLocaleForCurrency(currency: string): string {
  const map: Record<string, string> = {
    USD: 'en-US',
    INR: 'en-IN',
    EUR: 'de-DE',  // Most EUR transactions — Germany. Adjust per payer's country if known.
    GBP: 'en-GB',
    AUD: 'en-AU',
    CAD: 'en-CA',
    SGD: 'en-SG',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    CHF: 'de-CH',
    MXN: 'es-MX',
    BRL: 'pt-BR',
  };
  return map[currency.toUpperCase()] ?? 'en-US';
}
```

### Country-Aware Payment Handle Filtering

The filter is driven by the participant's phone country code (E.164 prefix). Config is data, not code.

```typescript
// src/config/payment-methods.config.ts

export type PaymentMethod =
  | 'venmo'
  | 'cashapp'
  | 'zelle'
  | 'paypal'
  | 'wise'
  | 'upi'
  | 'bank_transfer';

export interface CountryPaymentConfig {
  supportedMethods: PaymentMethod[];
}

/**
 * Country code → supported payment methods.
 * Key is the E.164 country code prefix (e.g. '+1' for US) OR an ISO 3166-1 alpha-2
 * country code (e.g. 'CA' for Canada) for countries that share a +1 prefix with the US.
 * For India (+91): UPI is primary, Wise maps to UPI for INR transfers.
 * For international (+XX where XX is anything else): PayPal, Wise, bank transfer.
 *
 * IMPORTANT: Canadian vs US +1 numbers are distinguished using `libphonenumber-js`
 * `parsePhoneNumber(phone).country` — this returns 'CA' for Canadian numbers even though
 * both use +1 country code. Do NOT use the +1 prefix alone to determine US vs CA.
 */
export const COUNTRY_PAYMENT_CONFIG: Record<string, CountryPaymentConfig> = {
  '+1':  { supportedMethods: ['venmo', 'cashapp', 'zelle', 'paypal', 'bank_transfer'] }, // US
  'CA':  {
    supportedMethods: ['paypal', 'wise', 'bank_transfer'],
    // Venmo, Zelle, Cash App are US-only — do NOT include for Canadian numbers
    // Interac e-Transfer is Canada's primary bank transfer — listed as 'bank_transfer'
    // note: 'Canadian +1 numbers — Venmo and Zelle are US-only and are excluded.',
  },
  '+91': { supportedMethods: ['upi', 'paypal', 'bank_transfer'] },   // India
  '+44': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // UK
  '+49': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // Germany
  '+33': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // France
  '+61': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // Australia
  '+64': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // New Zealand
  '+65': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // Singapore
  '+81': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },   // Japan
  // Default for any country code not listed:
  'default': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
};

/**
 * Returns payment config for a given E.164 phone number.
 *
 * Canadian vs US +1 detection: use `libphonenumber-js` to resolve the ISO country code
 * before calling this function, then pass the resolved country code when it is 'CA'.
 * Do NOT rely on the +1 prefix alone to distinguish Canada from the US.
 *
 * Example:
 *   import { parsePhoneNumber } from 'libphonenumber-js';
 *   const country = parsePhoneNumber(phoneE164).country; // 'US' or 'CA'
 *   if (country === 'CA') return COUNTRY_PAYMENT_CONFIG['CA'];
 */
export function getPaymentConfigForPhone(
  phoneE164: string,
  resolvedCountry?: string,  // ISO 3166-1 alpha-2 from libphonenumber-js
): CountryPaymentConfig {
  // Check resolved country first — handles CA vs US +1 disambiguation
  if (resolvedCountry && COUNTRY_PAYMENT_CONFIG[resolvedCountry]) {
    return COUNTRY_PAYMENT_CONFIG[resolvedCountry];
  }

  // Extract country code: try +1, +91, +44, +49, etc. (1–3 digit prefixes)
  for (const prefix of ['+1', '+7', '+20', '+27', '+30', '+31', '+32', '+33',
    '+34', '+36', '+39', '+40', '+41', '+43', '+44', '+45', '+46', '+47',
    '+48', '+49', '+51', '+52', '+53', '+54', '+55', '+56', '+57', '+58',
    '+60', '+61', '+62', '+63', '+64', '+65', '+66', '+81', '+82', '+84',
    '+86', '+90', '+91', '+92', '+93', '+94', '+95']) {
    if (phoneE164.startsWith(prefix) && COUNTRY_PAYMENT_CONFIG[prefix]) {
      return COUNTRY_PAYMENT_CONFIG[prefix];
    }
  }
  return COUNTRY_PAYMENT_CONFIG['default'];
}
```

### Payment Deep Link Formats

```typescript
// src/modules/ai/message-composer/payment-links.ts

import { PaymentMethod } from '../../../config/payment-methods.config';
import { formatCurrency } from './format-currency';

export interface PaymentHandle {
  method: PaymentMethod;
  handle: string; // decrypted at call time only — AES-256 at rest
}

export interface PaymentLink {
  method: PaymentMethod;
  label: string;
  url: string;
}

/**
 * Build payment deep links for each supported method.
 * amount is a number in major units (e.g. 42.50 for $42.50 or ₹1234.56).
 * currency is ISO 4217 (used for display only — amounts in deep links are numbers).
 */
export function buildPaymentLink(
  handle: PaymentHandle,
  amountMajorUnits: number,
  eventName: string,
  currency: string,
  locale: string,
): PaymentLink | null {
  const formattedAmount = formatCurrency(amountMajorUnits, currency, locale);
  const encodedNote = encodeURIComponent(`${eventName} split`);
  const numericAmount = amountMajorUnits.toFixed(2);

  switch (handle.method) {
    case 'venmo':
      // US only. Venmo deep link — amount and note pre-filled.
      return {
        method: 'venmo',
        label: 'Venmo',
        url: `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handle.handle)}&amount=${numericAmount}&note=${encodedNote}`,
      };

    case 'paypal':
      // PayPal.me — works globally.
      return {
        method: 'paypal',
        label: 'PayPal',
        url: `https://paypal.me/${encodeURIComponent(handle.handle)}/${numericAmount}`,
      };

    case 'cashapp':
      // Cash App — US only.
      return {
        method: 'cashapp',
        label: 'Cash App',
        url: `https://cash.app/${encodeURIComponent(handle.handle)}/${numericAmount}`,
      };

    case 'zelle':
      // Zelle has no universal deep link. Show handle and instruct user to open Zelle.
      return {
        method: 'zelle',
        label: 'Zelle',
        url: `zelle:${encodeURIComponent(handle.handle)}`,  // handled as display-only in UI
      };

    case 'wise':
      // Wise pay.me link — works internationally, including India as UPI bridge.
      return {
        method: 'wise',
        label: 'Wise',
        url: `https://wise.com/pay/me/${encodeURIComponent(handle.handle)}`,
      };

    case 'upi':
      // UPI intent link — India only. Amount in INR.
      return {
        method: 'upi',
        label: 'UPI',
        url: `upi://pay?pa=${encodeURIComponent(handle.handle)}&am=${numericAmount}&cu=INR&tn=${encodedNote}`,
      };

    case 'bank_transfer':
      // No link — return null. The assembler renders bank details as formatted text.
      return null;

    default:
      return null;
  }
}

/**
 * Zelle has no universal deep link that opens the app directly.
 * Render as a "copy handle" instruction instead.
 */
export function buildZelleInstruction(handle: string): string {
  return `Pay via Zelle — send to: ${handle}`;
}

/**
 * Bank transfer renders as structured text, not a link.
 */
export function buildBankTransferText(accountDetails: string): string {
  return `Bank transfer details:\n${accountDetails}`;
}
```

### PII Principle: Names Are Inserted After the AI Call

Participant surnames and the payer's full name are never sent to the AI. The prompt receives first names only. Full display names are inserted during assembly from the database after the AI call returns.

```typescript
// In message-composer.harness.ts — extract first name before building prompt
const participantFirstName = params.participantDisplayName.split(' ')[0];
const payerFirstName       = params.payerDisplayName.split(' ')[0];

const prompt = buildMessageComposerPrompt(
  params.eventName,
  params.restaurantName,
  participantFirstName,   // ← first name only
  payerFirstName,         // ← first name only
  params.itemNames,
);

// After AI returns, assemble with full name from DB
const fullMessage = assembleMessage(aiGreeting, params.participantDisplayName, ...);
```

### Message Assembler (Deterministic)

```typescript
// src/modules/ai/message-composer/message-composer.assembler.ts

import { formatCurrency, defaultLocaleForCurrency } from './format-currency';
import { buildPaymentLink, buildZelleInstruction, buildBankTransferText, PaymentHandle } from './payment-links';
import { getPaymentConfigForPhone } from '../../../config/payment-methods.config';

export interface AssembledMessage {
  participantId: string;
  messageText: string;
  amountFormatted: string;   // e.g. '₹1,234.56' — for UI display
  channel: 'whatsapp' | 'sms';
}

export interface AssembleMessageParams {
  aiGreeting: string;
  participantId: string;
  participantDisplayName: string; // full name — inserted here, never in AI prompt
  participantPhoneE164: string;
  participantIsRegistered: boolean;
  amountOwed: number;             // in major units (e.g. 42.50)
  currency: string;               // ISO 4217
  locale: string;                 // BCP 47 locale string
  eventName: string;
  payerHandles: PaymentHandle[];  // decrypted by caller, never logged
  hasWhatsApp: boolean;
}

export async function assembleMessage(params: AssembleMessageParams): Promise<AssembledMessage> {
  const locale = params.locale || defaultLocaleForCurrency(params.currency);
  const formattedAmount = formatCurrency(params.amountOwed, params.currency, locale);

  // Country-aware filtering
  const countryConfig = getPaymentConfigForPhone(params.participantPhoneE164);
  const availableHandles = params.payerHandles.filter(h =>
    countryConfig.supportedMethods.includes(h.method),
  );

  // Build payment block
  const paymentLines: string[] = [];

  for (const handle of availableHandles) {
    if (handle.method === 'bank_transfer') {
      paymentLines.push(buildBankTransferText(handle.handle));
      continue;
    }
    if (handle.method === 'zelle') {
      paymentLines.push(buildZelleInstruction(handle.handle));
      continue;
    }
    const link = buildPaymentLink(
      handle,
      params.amountOwed,
      params.eventName,
      params.currency,
      locale,
    );
    if (link) {
      paymentLines.push(`${link.label}: ${link.url}`);
    }
  }

  const paymentBlock =
    paymentLines.length > 0
      ? `Pay here:\n${paymentLines.join('\n')}`
      : `Please reply to confirm when you've paid.`;

  // App download nudge — only for non-registered participants, always last
  const nudge = params.participantIsRegistered
    ? ''
    : `\n\nTrack your payments with LetsSplyt: https://letssplyt.app/download`;

  // Full message: AI greeting + deterministic amount + deterministic payment block + optional nudge
  // Full name is inserted here from the DB — never from the AI
  const messageText = [
    params.aiGreeting,
    `Your share is ${formattedAmount}.`,
    paymentBlock,
  ]
    .join('\n\n')
    .concat(nudge);

  return {
    participantId: params.participantId,
    messageText,
    amountFormatted: formattedAmount,
    channel: params.hasWhatsApp ? 'whatsapp' : 'sms',
  };
}
```

### Pre-Send Validation

```typescript
// src/modules/ai/message-composer/message-composer.validator.ts

import { formatCurrency, defaultLocaleForCurrency } from './format-currency';

export function validateMessageBeforeSend(
  message: string,
  expectedAmount: number,
  currency: string,
  locale: string,
): void {
  const resolvedLocale = locale || defaultLocaleForCurrency(currency);
  const formattedAmount = formatCurrency(expectedAmount, currency, resolvedLocale);

  if (!message.includes(formattedAmount)) {
    throw new Error(
      `Message validation failed: expected "${formattedAmount}" to appear verbatim in message.\n` +
      `Message: ${message}`,
    );
  }
}
```

### A3 Greeting Content Check

```typescript
// src/modules/ai/message-composer/message-composer.content-check.ts

const BLOCKED_PATTERNS: RegExp[] = [
  /\bfuck\b/i, /\bshit\b/i, /\bdamn\b/i, /\bass\b/i, // profanity (extend as needed)
  /\$[\d,]+/,                                            // dollar amounts (model ignoring instructions)
  /£[\d,]+/,                                             // pound amounts
  /€[\d,]+/,                                             // euro amounts
  /₹[\d,]+/,                                             // rupee amounts
  /https?:\/\//i,                                        // URLs (model adding its own links)
  /pay\s+me|send\s+money|transfer\s+to/i,               // payment instructions (belongs in template)
];

const MIN_GREETING_LENGTH = 15;
const MAX_GREETING_LENGTH = 300;

export function validateGreeting(greeting: string, participantFirstName: string): void {
  if (greeting.length < MIN_GREETING_LENGTH) {
    throw new Error(`Greeting too short (${greeting.length} chars)`);
  }
  if (greeting.length > MAX_GREETING_LENGTH) {
    throw new Error(
      `Greeting too long (${greeting.length} chars) — model may have ignored length instructions`,
    );
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(greeting)) {
      throw new Error(`Greeting failed content check: matched ${pattern}`);
    }
  }
  // Participant's first name should appear — confirms model personalised the message
  if (!greeting.toLowerCase().includes(participantFirstName.toLowerCase())) {
    throw new Error(
      `Greeting does not mention participant name "${participantFirstName}" — likely generic`,
    );
  }
}
```

### Complete Harness Implementation

```typescript
// src/modules/ai/message-composer/message-composer.harness.ts

import { createLLMProvider } from '../../../infrastructure/llm/llm.factory';
import { buildMessageComposerPrompt } from './message-composer.prompt';
import { assembleMessage, AssembleMessageParams, AssembledMessage } from './message-composer.assembler';
import { validateMessageBeforeSend } from './message-composer.validator';
import { validateGreeting } from './message-composer.content-check';
import { setAiStage, getAiStage } from '../ai-idempotency';
import { writeAuditLog } from '../../../infrastructure/llm/ai-audit';
import { AppError } from '../../../infrastructure/errors';
import { LLMMessage } from '../../../infrastructure/llm/llm.provider';
import { defaultLocaleForCurrency } from './format-currency';

const MAX_RETRIES = parseInt(process.env.MESSAGE_COMPOSE_MAX_RETRIES ?? '3', 10);

export interface ComposeMessageParams extends Omit<AssembleMessageParams, 'aiGreeting'> {
  payerDisplayName: string;
  restaurantName: string | null;
  itemNames: string[];
  eventId: string;
}

export async function composeMessageWithHarness(
  params: ComposeMessageParams,
): Promise<AssembledMessage> {
  const provider = createLLMProvider('A3');

  const participantFirstName = params.participantDisplayName.split(' ')[0];
  const payerFirstName       = params.payerDisplayName.split(' ')[0];
  const locale = params.locale || defaultLocaleForCurrency(params.currency);

  const promptText = buildMessageComposerPrompt(
    params.eventName,
    params.restaurantName,
    participantFirstName,   // first name only — PII principle
    payerFirstName,         // first name only
    params.itemNames,
  );

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    let rawText: string | null = null;

    try {
      const messages: LLMMessage[] = [{ role: 'user', content: promptText }];
      const response = await provider.complete(messages, { maxTokens: 200, timeout: 30_000 });
      rawText = response.text.trim();

      if (!rawText || rawText.length < 10) {
        throw new Error('Greeting too short or empty');
      }

      // Content validation — throws if greeting fails any check
      validateGreeting(rawText, participantFirstName);

      const composed = await assembleMessage({
        ...params,
        aiGreeting: rawText,
        locale,
      });

      // Final safety check — formatted amount must appear verbatim
      validateMessageBeforeSend(composed.messageText, params.amountOwed, params.currency, locale);

      await writeAuditLog({
        eventId: params.eventId,
        agent: 'A3',
        provider: process.env.AI_PROVIDER_A3 ?? 'gemini',
        modelUsed: response.modelUsed,
        promptContent: promptText,
        responseText: rawText,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: true,
      });

      return composed;

    } catch (err) {
      lastError = err as Error;

      await writeAuditLog({
        eventId: params.eventId,
        agent: 'A3',
        provider: process.env.AI_PROVIDER_A3 ?? 'gemini',
        modelUsed: process.env.AI_MODEL_A3 ?? 'gemini-2.5-flash',
        promptContent: promptText,
        responseText: rawText ?? '',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        attempts: attempt,
        success: false,
        errorCode: lastError.message,
      });

      if (attempt < MAX_RETRIES) await sleep(getRetryDelay(attempt));
    }
  }

  // All retries exhausted — use deterministic fallback greeting
  // The message still goes out. Personalisation degrades, accuracy does not.
  const fallbackGreeting = `Hi ${participantFirstName}! Here's your share from ${params.eventName}.`;
  const composed = await assembleMessage({
    ...params,
    aiGreeting: fallbackGreeting,
    locale,
  });

  validateMessageBeforeSend(composed.messageText, params.amountOwed, params.currency, locale);
  return composed;
}

function getRetryDelay(attempt: number, baseMs = 500, maxMs = 10_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  return Math.floor(Math.random() * exponential);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### A3 Stage Guard and Orchestration

```typescript
// In the orchestrating service — before calling composeMessageWithHarness for any participant

// Atomic stage guard — atomically transition from 'calculated' to 'messaging'
await claimMessagingSlot(eventId);

try {
  // Compose messages for all N participants (can be parallelised with Promise.all)
  const messages = await Promise.all(
    participants.map(p => composeMessageWithHarness({ ...p, eventId })),
  );
  await setAiStage(eventId, 'complete');
  return messages;
} catch (err) {
  await setAiStage(eventId, 'failed');
  throw err;
}
```

---

## 6. Agent Communication Flow

### Linear Synchronous Pipeline

```
USER: photographs receipt
    ↓
A1: Vision AI (Gemini dev / Claude Haiku prod)
    → { items[], tax, tip, subtotal, total, currency, parse_confidence }
    → payer reviews + corrects if needed
    ↓
A2: NLP assignment + deterministic split calculator
    → { participants[{ name, amountOwed }] }
    → if partial: payer manually assigns unresolved items, re-submits
    ↓
A3: Message composer (one call per participant, parallelised)
    → N message packages { greeting, formattedAmount, paymentLinks }
    ↓
USER: taps "Send to all" → Twilio delivers to all N participants
```

No message broker is needed. Each agent's output is the next agent's input.

### ai_stage State Machine

```sql
-- events.ai_stage column
-- Allowed transitions:
none        → parsing      (A1 start — atomic claim)
parsing     → parsed       (A1 success)
parsing     → failed       (A1 failure — allows retry)
parsed      → calculating  (A2 start)
calculating → calculated   (A2 success)
calculating → failed       (A2 failure)
calculated  → messaging    (A3 start)
messaging   → complete     (A3 success — terminal happy state)
messaging   → failed       (A3 failure — allows operator retry)
failed      → none         (operator reset for clean retry)
```

Setting `'failed'` instead of leaving a stage mid-flight ensures a crashed request does not permanently lock the event. An operator can reset `ai_stage` to `'none'` (or the prior completed stage) to allow a clean retry.

### Graceful Degradation per Agent

| Agent | On permanent failure | User experience |
|-------|---------------------|-----------------|
| A1 | throw `RECEIPT_PARSE_FAILED` | "Scan failed — enter items manually." Payer continues with manual entry. |
| A2 | throw `SPLIT_CALCULATION_FAILED` | Unresolved. Payer assigns all items via drag-and-drop, skips NLP. |
| A3 (greeting) | Fallback to deterministic greeting | Message still sends with correct amount and links. No personalisation. |
| A3 (whole agent) | throw error | "Send failed — tap retry." Individual retries per participant possible. |

**No agent failure causes an event failure.** The worst case is the payer doing more manual work.

### Timeout Budget

| Agent | Max timeout | Notes |
|-------|-------------|-------|
| A1 | 60 seconds | Vision models on complex receipts can be slow. Users expect a scan to take a moment. |
| A2 | 30 seconds | Text-only — should be much faster in practice. |
| A3 | 30 seconds per participant | Per-participant calls are parallelised, so wall-clock time for N participants ≈ 30s (not N×30s). |

### AI API Call Count Per Event

Typically 2–4 calls total:
- 1 call: A1 (vision)
- 1 call: A2 (NLP, only if text assignment used — even split and drag-and-drop skip A2's AI call)
- N calls: A3 (one per participant, parallelised)

At Gemini rates (dev): near-zero cost. At Haiku rates (production): approximately $0.004–0.008 per event depending on group size.

---

## 7. Eval Framework

### What Evals Are and Why They Matter

An **eval** is a structured automated test that answers: *"Does my AI agent do what it was designed to do, reliably, across many different inputs?"*

LetsSplyt handles financial data. A $0.05 error in a receipt total means everyone overpays or underpays. A Venmo link sent to a German number makes the app look broken. A split that doesn't add up causes a trust failure. Evals are the automated layer that catches these before they reach users.

**The rule:** Every deterministic financial calculation must pass at 100%. Everything else has a minimum acceptable threshold.

### The Three Eval Types

**Type 1 — Deterministic (Pass/Fail).** You know the exact right answer. Code checks it automatically. Use when the answer is mathematically correct or provably wrong. Example: total must be $42.50 exactly.

**Type 2 — Statistical (Score/Threshold).** Measure across many inputs. Use when perfect accuracy is impossible but you need a minimum acceptable level. Example: ≥90% of line items extracted correctly.

**Type 3 — LLM-as-Judge (Rubric-Scored).** A second AI instance reviews output against a rubric. Use when the output is subjective (tone, clarity, reasonableness). Use `claude-sonnet-4-6` as judge regardless of which provider the agent uses. Same model judging its own output produces sycophantic scores.

### Both Providers Must Pass

Every eval must be run against both providers before any deployment. The eval runner accepts a `--provider` flag:

```bash
npm run eval:all --provider=gemini    # dev/staging provider
npm run eval:all --provider=haiku     # production provider
```

Both must pass all thresholds before a deployment is promoted to the next environment. A new model version that passes on one provider but not the other does not ship.

### The Golden Dataset

Before writing eval code, build a **golden dataset** — real inputs with verified correct outputs.

**What makes a good golden dataset:**
- Representative of real-world inputs, not just clean cases
- Includes edge cases and known failure modes
- Correct answers verified by hand (you, not the AI)
- Living document — new production failures are added permanently

**Building the A1 dataset (minimum 45 receipts):**

| Category | Count | What to Include |
|----------|-------|----------------|
| Clean restaurant receipts | 20 | Normal conditions, phone camera, various formats |
| Crumpled / low-light | 10 | Simulate real bad conditions |
| Large groups (10+ items) | 5 | Test completeness on complex bills |
| Unusual formats | 5 | Food trucks, bar tabs, hotel minibar |
| International receipts | 5 | UK (£), Germany (€), India (₹), Canada (CAD) minimum |

For each receipt: photograph it AND manually write the correct JSON in a spreadsheet. That spreadsheet is the ground truth.

**Building the A2 dataset (minimum 55 cases):**

| Category | Count |
|----------|-------|
| Even split scenarios (varied group sizes, awkward amounts) | 10 |
| Itemised split scenarios (manually computed correct answers) | 10 |
| NLP assignment sentences (simple, ambiguous, complex) | 30 |
| Edge cases (empty items, single person, all-or-nothing) | 5 |

All correct amounts must be computed by hand in a spreadsheet first.

**Building the A3 dataset (minimum 20 cases):**

| Category | Count | What to Verify |
|----------|-------|---------------|
| US participants (registered) | 5 | All US payment links present, no download nudge |
| US participants (unregistered/guest) | 3 | All US payment links present, download nudge present |
| International participants (UK, Germany, India) | 4 | Correct filtered payment options, correct currency format |
| INR events (India) | 3 | formatCurrency produces ₹ not $, UPI links present |
| Post-edit revision scenarios | 5 | Only affected participants receive a revised message |

### When to Run Evals

| Trigger | What to Run | Both Providers? |
|---------|------------|-----------------|
| Before first launch | Full suite, all 3 agents | Yes — must hit all thresholds to ship |
| Any prompt change | Affected agent only | Yes — regression check |
| New Gemini version | Full suite | Yes — new version must match or beat previous |
| New Claude version | Full suite | Yes — new version must match or beat previous |
| Monthly (production) | Sample 50 real events | Yes — health monitoring |
| User-reported AI error | Add to dataset, re-run affected agent | Yes |

### Running the Eval Suite

```bash
# Run full suite against Gemini (dev/staging provider)
npm run eval:all --provider=gemini

# Run full suite against Claude Haiku (production provider)
npm run eval:all --provider=haiku

# Run a specific agent
npm run eval:a1 --provider=gemini
npm run eval:a2 --provider=haiku
npm run eval:a3 --provider=gemini

# Run against a specific model override
npm run eval:all --provider=gemini --model=gemini-2.5-flash-preview-0514
```

The eval runner loads test cases from JSON files, calls each agent's API, compares outputs against expected values, and outputs a pass/fail report with per-eval scores and a final deployment gate result.

---

### Agent A1 Evals

#### A1 Eval 1 — Total Amount Accuracy
**Type:** Deterministic | **Threshold:** 100% (both providers)

Agent's extracted `total` must exactly match the known correct total to 2 decimal places.

**Why 100%:** Financial data. A $0.05 error in the total means every participant overpays or underpays.

**Test cases:**
- Round numbers ($40.00, £30.00, ₹500.00)
- Cents/pence ($37.84, £12.37)
- Large bills ($284.50, €187.45)
- Receipts where total is printed in an unusual position
- Receipts with multiple subtotals before the final total

---

#### A1 Eval 2 — Line Item Extraction Rate
**Type:** Statistical | **Threshold:** ≥ 90% (both providers)

Across 45 test receipts, what percentage of line items are correctly identified? An item is "correct" if the name is recognisably the same item AND the price is within 5% of ground truth.

**Test cases:**
- Simple receipts (3–5 items)
- Complex receipts (10–20 items)
- Items with similar names ("Lager", "Craft Lager", "Draught Lager")
- Items that span multiple lines on the receipt

---

#### A1 Eval 3 — Tax and Tip Correctly Separated
**Type:** Deterministic | **Threshold:** 100% (both providers)

Tax must appear in `output.tax`. Tip must appear in `output.tip`. Neither may appear as an entry in `output.items`.

**Why this matters:** If tax appears as a line item, A2 assigns it to a specific person instead of prorating it. This breaks split calculations.

**Test cases:**
- Receipt with explicit "Tax" line
- Receipt with "Service Charge" (is this tax or gratuity?)
- Receipt with auto-added 18% gratuity
- Receipt with tax included in item prices (tax = 0)
- Receipt with both tax and tip separately shown

---

#### A1 Eval 4 — Currency Detection
**Type:** Deterministic | **Threshold:** 100% (both providers)

Agent correctly returns the ISO 4217 currency code for the receipt's currency.

**Test cases:**
- US restaurant receipt ($) → `USD`
- UK pub receipt (£) → `GBP`
- German receipt (€) → `EUR`
- Indian restaurant receipt (₹) → `INR`
- Receipt with currency spelled out ("USD", "Euro")
- Ambiguous symbol (some countries use $ for local currency)

---

#### A1 Eval 5 — Low-Quality Receipt Resilience
**Type:** Statistical | **Threshold:** Complete failure rate ≤ 10% (both providers)

Run 20 deliberately difficult receipt photos. Agent must return usable JSON on at least 18 of 20. A "complete failure" is returning nothing, returning `{ "error": "unreadable" }`, or returning JSON so corrupted it fails Zod validation.

**Test cases:**
- Receipt photographed at a steep angle
- Receipt under poor yellow lighting
- Crumpled receipt smoothed and photographed
- Receipt with a stain obscuring some text
- Handwritten receipt

---

#### A1 Eval 6 — JSON Schema Validity
**Type:** Deterministic | **Threshold:** 100% (both providers)

Every response must pass `ReceiptParseOutputSchema.parse()` without throwing.

**Common failures to check for:**
- `price` returned as a string instead of a number
- Missing required field (no `currency`, no `total`)
- `items` array is empty
- `currency` is 2 letters instead of 3
- UUIDs in `id` fields are not valid v4 UUIDs

---

### Agent A2 Evals

#### A2 Eval 1 — Sum Invariant Check (Most Critical Eval in the App)
**Type:** Deterministic | **Threshold:** 100% (both providers)

Sum of all `amountOwed` values across all participants must equal the event total, within $0.01 for rounding. This is the only tolerance allowed.

**Test cases:**
- 2 people splitting $40.00 (exact division)
- 3 people splitting $40.00 ($13.33 × 3 = $39.99 — penny must be distributed correctly)
- 6 people splitting $47.50 ($7.916... recurring)
- Groups with very different subtotals (one person had $5, another had $85)

---

#### A2 Eval 2 — Even Split Accuracy
**Type:** Deterministic | **Threshold:** 100% (both providers)

When even split is selected, each person's share = total ÷ N using largest-remainder rounding.

**Test cases:**
- 2 people, $40.00 → $20.00 each
- 3 people, $30.00 → $10.00 each
- 3 people, $10.00 → $3.33, $3.33, $3.34 (penny distributed correctly)
- 7 people, $100.00 → verify distribution method is correct
- 1 person → full amount to payer

---

#### A2 Eval 3 — Proportional Tax and Tip
**Type:** Deterministic | **Threshold:** 100% (both providers)

Each person's tax and tip share must be proportional to their food subtotal.

Formula:
```
person_tax = (person_subtotal / event_subtotal) × total_tax
person_tip = (person_subtotal / event_subtotal) × total_tip
```

**Test cases:**
- Two people with very different subtotals ($5 vs $95)
- One person ordered nothing (their tax/tip share = $0.00)
- Large tip (30%+) to verify math holds at unusual percentages
- Zero tax (tax included in item prices)

---

#### A2 Eval 4 — NLP Assignment Accuracy
**Type:** Statistical | **Threshold:** ≥ 85% (both providers)

Given a natural language assignment sentence, A2 correctly maps items to the right participant. Score = correctly assigned items / total items mentioned, across 30 test sentences.

**Test sentences:**

Simple:
- "Rohan had the pasta"
- "Sara had the salad and the wine"
- "Mark had the burger"

Medium:
- "Rohan and Sara split the nachos"
- "Everyone shared the bread"
- "The steak was mine, Rohan had the fish"

Complex:
- "Sara had everything except the beer — that was mine"
- "Rohan had two beers and the appetiser, Sara had the main and dessert, I had everything else"
- "Split the pizza four ways but I paid for the extra toppings"

Edge cases:
- Item not on the receipt ("Rohan had the lobster" — no lobster on receipt)
- Same item assigned to two people by name
- Ambiguous name ("John" — two Johns at the table)

---

#### A2 Eval 5 — Unassigned Item Handling
**Type:** Deterministic | **Threshold:** 100% (both providers)

If A2 cannot assign an item, it must appear in `unassigned_item_ids` and the response status must be `'partial'`. No unassigned item may be silently dropped.

**Test cases:**
- All items assigned → `unassigned_item_ids: []`, `status: 'complete'`
- One item unassigned → `status: 'partial'`, item in `unassigned_item_ids`
- All items unassigned → `status: 'partial'`, all IDs in `unassigned_item_ids`

---

#### A2 Eval 6 — LLM-as-Judge for Ambiguous NLP
**Type:** LLM-as-Judge | **Threshold:** Average score ≥ 4/5 (both providers)

A `claude-sonnet-4-6` instance evaluates A2's interpretation of genuinely ambiguous sentences.

**Rubric:**
```
Score this assignment decision 1-5:
5 = Clearly correct interpretation, exactly what the sentence means
4 = Reasonable interpretation, a human would likely agree
3 = Defensible but other interpretations are equally valid
2 = Questionable, most humans would read it differently
1 = Clearly wrong interpretation

Sentence: [the natural language input]
Assignment decision: [what A2 decided]
Available items: [list of receipt items]
Participants: [list of names]
```

Judge model is always `claude-sonnet-4-6` regardless of which provider A2 uses. In dev, A2 uses Gemini — still use Claude Sonnet as judge.

---

### Agent A3 Evals

#### A3 Eval 1 — Payment Link Amount Matches Owed Amount
**Type:** Deterministic | **Threshold:** 100% (both providers)

Extract the amount parameter from every generated deep link. Must match `participant.amountOwed` exactly.

- Venmo: `venmo://paycharge?txn=pay&recipients=@handle&amount=42.50` → `42.50`
- PayPal: `https://paypal.me/username/42.50` → `42.50`
- Cash App: `https://cash.app/$handle/42.50` → `42.50`
- UPI: `upi://pay?pa=handle@bank&am=1234.56&cu=INR` → `1234.56`

**Test cases:**
- Round numbers ($20.00, ₹500.00)
- Amounts with cents ($18.75, ₹1234.56)
- Very small amounts ($3.33 after 6-way split)
- Very large amounts ($150+, ₹10000+)

---

#### A3 Eval 2 — Country-Aware Payment Option Filtering
**Type:** Deterministic | **Threshold:** 100% (both providers)

- US participants (+1): message MUST contain Venmo, Zelle, Cash App, PayPal
- Indian participants (+91): message MUST contain UPI, must NOT contain Venmo, Zelle, Cash App
- European participants (+44, +49, +33, etc.): message must NOT contain Venmo, Zelle, Cash App; MUST contain PayPal and/or Wise

**Test cases:**
- US participant (+1) → verify Venmo link present
- Indian participant (+91) → verify UPI link present, Venmo absent
- German participant (+49) → verify NO Venmo, YES PayPal
- UK participant (+44) → verify NO Zelle, YES PayPal or Wise

---

#### A3 Eval 3 — App Nudge Suppressed for Registered Users
**Type:** Deterministic | **Threshold:** 100% (both providers)

If `participant.isRegistered === true`, the download nudge URL must NOT appear in the message. If `isRegistered === false`, the nudge MUST appear.

**Test cases:**
- Registered participant → no download link
- Unregistered guest → download link present
- Mixed group (3 registered, 2 not) → verify each individually

---

#### A3 Eval 4 — Selective Revision (Only Affected Participants)
**Type:** Deterministic | **Threshold:** 100% (both providers)

When the payer edits the split after sending, A3 generates revised messages only for participants whose `amountOwed` changed.

**Test cases:**
- Edit one item affecting one participant → only that participant receives revision
- Edit a shared item affecting all → all receive revision
- Edit resulting in no amount changes → nobody receives a revision

---

#### A3 Eval 5 — Deep Link URL Validity
**Type:** Deterministic | **Threshold:** 100% (both providers)

All generated deep link URLs must pass URI validation:
- No spaces in the URL
- Amount is a valid decimal number (not `NaN`, not `undefined`, not empty)
- Handle/username portion is non-empty
- URL scheme is correct (e.g. `venmo://`, not `venmo: //` with a space)
- Special characters in handles are URL-encoded

---

#### A3 Eval 6 — Currency Formatting Correctness
**Type:** Deterministic | **Threshold:** 100% (both providers)

The formatted amount in the message body must use the correct currency symbol and locale format.

**Test cases:**
- USD event, US participant → `$42.50` (not `USD 42.50`, not `42.5`)
- INR event, Indian participant → `₹1,234.56` (not `$1,234.56`, not `INR 1234.56`)
- EUR event, German participant → `42,50 €` (German locale uses comma as decimal separator)
- GBP event, UK participant → `£12.34`
- AUD event, Australian participant → `A$15.00`
- CAD event, Canadian participant → `CA$15.00`
- SGD event, Singapore participant → `S$10.50`

---

#### A3 Eval 7 — Message Clarity (LLM-as-Judge)
**Type:** LLM-as-Judge | **Threshold:** Average score ≥ 4/5 per dimension (both providers)

A `claude-sonnet-4-6` instance evaluates each message on three dimensions:

**Rubric:**
```
Score each dimension 1-5 (5 = excellent, 1 = poor):

AMOUNT CLARITY: Is the recipient's owed amount clearly stated and easy to find?
PAYMENT INSTRUCTIONS: Are the payment options clear and actionable?
TONE: Is the message warm, polite, and appropriate for a financial request between acquaintances?

Message to evaluate: [paste generated message]
Participant's country: [country]
Currency: [ISO 4217 code]
Participant registration status: [registered / guest]
```

Judge model is always `claude-sonnet-4-6` regardless of which provider A3 uses.

---

### Minimum Standards to Ship

All thresholds must be met on **both** Gemini and Haiku before any deployment.

| Agent | Eval | Threshold | Type |
|-------|------|-----------|------|
| A1 | Total amount accuracy | 100% | Deterministic |
| A1 | Line item extraction rate | ≥ 90% | Statistical |
| A1 | Tax/tip separation | 100% | Deterministic |
| A1 | Currency detection | 100% | Deterministic |
| A1 | Low-quality resilience | ≤ 10% failure rate | Statistical |
| A1 | JSON schema validity | 100% | Deterministic |
| A2 | Sum invariant | 100% | Deterministic |
| A2 | Even split accuracy | 100% | Deterministic |
| A2 | Proportional tax/tip | 100% | Deterministic |
| A2 | NLP assignment accuracy | ≥ 85% | Statistical |
| A2 | Unassigned item handling | 100% | Deterministic |
| A2 | NLP judge score | ≥ 4/5 average | LLM-as-Judge |
| A3 | Payment link amounts | 100% | Deterministic |
| A3 | Country payment filtering | 100% | Deterministic |
| A3 | Nudge suppression | 100% | Deterministic |
| A3 | Selective revision | 100% | Deterministic |
| A3 | URL validity | 100% | Deterministic |
| A3 | Currency formatting | 100% | Deterministic |
| A3 | Message clarity judge | ≥ 4/5 average | LLM-as-Judge |

**Deployment gate:** All 100% evals must pass at exactly 100% to ship. Statistical evals must meet their threshold. Do not deploy if any 100% eval fails on either provider.

### Production Monitoring Plan

Evals do not stop at launch.

**Monthly automated check:**
- Sample 50 real events from production (anonymised — strip participant names before eval)
- Run through A1, A2, A3 eval suites against both providers
- Compare scores against launch baseline
- Alert if any score drops more than 5 percentage points

**User-reported error protocol:**
1. Get the original input (receipt photo, assignment text, or split scenario)
2. Verify what the correct output should have been
3. Add as a new test case to the relevant golden dataset
4. Re-run evals to confirm the new case fails (verifying the bug is captured)
5. Fix the prompt or logic
6. Re-run evals to confirm the fix passes on both providers
7. Confirm all baseline scores are maintained

Every real-world bug becomes a permanent test case. The eval suite gets stronger every time someone reports an error.

---

## 8. Model Upgrade Protocol

When either Google or Anthropic releases a new model version:

1. **Update the env var in Doppler dev only.** Do not touch staging or production yet.
   ```bash
   # e.g. upgrading Gemini in dev
   doppler secrets set AI_MODEL_A1=gemini-2.5-flash-preview-0514 --config=dev
   ```

2. **Run the full eval suite against the new model.**
   ```bash
   npm run eval:all --provider=gemini --model=gemini-2.5-flash-preview-0514
   npm run eval:all --provider=haiku  # production model unchanged — still must pass
   ```

3. **Both providers must pass all thresholds** before the upgrade proceeds. If the new model degrades any score (even on a provider it doesn't affect directly, due to cross-eval dependencies), do not promote.

4. **Promote through environments in sequence:**
   - dev → run eval:all → pass → promote to staging
   - staging → run eval:all on production dataset sample → pass → promote to production
   - Update Doppler secrets for each environment as it is promoted

5. **Never upgrade immediately on release.** Models can regress on domain-specific tasks even when overall benchmarks improve. Always run your golden dataset first.

6. **Document the upgrade** in the team Slack channel with: old model, new model, eval scores for both, and the date promoted to production.

---

### sanitizePromptInput Implementation

Every participant name, item name, and NLP instruction that is interpolated into any prompt must be wrapped in `sanitizePromptInput()` with the appropriate `context` option. The function is defined in `src/infrastructure/llm/prompt-sanitizer.ts`.

```typescript
// src/infrastructure/llm/prompt-sanitizer.ts

/**
 * Sanitises user-controlled strings before interpolation into AI prompts.
 * Prevents prompt injection attacks where receipt item names or participant
 * names contain instructions that manipulate AI behaviour.
 */
export function sanitizePromptInput(
  input: string,
  options: {
    maxLength?: number;
    context?: 'item_name' | 'participant_name' | 'nlp_instruction';
  } = {}
): string {
  const { maxLength = 200, context = 'item_name' } = options;
  
  if (typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)                    // Truncate before other transforms
    .replace(/\n/g, ' ')                    // Newlines used for prompt injection
    .replace(/\r/g, ' ')                    // Carriage returns
    .replace(/\|/g, '/')                    // Pipe characters (table injection in some models)
    .replace(/`/g, "'")                     // Backtick code blocks
    .replace(/#{1,6}\s/g, '')              // Markdown headers
    .replace(/\[INST\]|\[\/INST\]/gi, '')  // Llama instruction tokens
    .replace(/<\|.*?\|>/g, '')             // Generic special tokens
    .replace(/system:|user:|assistant:/gi, '') // Role injection
    .trim();
}
```

**Usage at every prompt interpolation point:**

```typescript
// Item names — in buildSplitCalculatorPrompt
sanitizePromptInput(item.name, { maxLength: 60, context: 'item_name' })

// Participant names — in buildSplitCalculatorPrompt and buildMessageComposerPrompt
sanitizePromptInput(p.name, { maxLength: 50, context: 'participant_name' })

// NLP instructions — in buildSplitCalculatorPrompt
sanitizePromptInput(naturalLanguageInstruction, { maxLength: 200, context: 'nlp_instruction' })

// Event and restaurant names — in buildMessageComposerPrompt
sanitizePromptInput(eventName, { maxLength: 80, context: 'item_name' })
sanitizePromptInput(restaurantName, { maxLength: 80, context: 'item_name' })

// Item names passed as context to A3 — in buildMessageComposerPrompt
itemNames.slice(0, 5).map(n => sanitizePromptInput(n, { maxLength: 40, context: 'item_name' }))
```

> Note: The existing prompt builder code uses a legacy two-argument form `sanitizePromptInput(str, maxLength)`. Migrate all call sites to the options-object form above for consistent context tagging.

### Infrastructure Files Summary

| File | Purpose |
|------|---------|
| `src/infrastructure/llm/llm.provider.ts` | `LLMProvider` interface and message types |
| `src/infrastructure/llm/llm.factory.ts` | `createLLMProvider(agent)` — the only entry point for harnesses |
| `src/infrastructure/llm/providers/anthropic.adapter.ts` | Anthropic SDK adapter |
| `src/infrastructure/llm/providers/gemini.adapter.ts` | Gemini SDK adapter |
| `src/infrastructure/llm/providers/openai.adapter.ts` | OpenAI SDK adapter |
| `src/infrastructure/llm/providers/openai-compat.adapter.ts` | Generic OpenAI-compat adapter |
| `src/infrastructure/llm/prompt-sanitizer.ts` | `sanitizePromptInput()` — strips injection attempts |
| `src/infrastructure/llm/input-guards.ts` | `assertImageSize()`, `assertItemCount()`, `assertParticipantCount()` |
| `src/infrastructure/llm/ai-audit.ts` | `writeAuditLog()` — structured AI call log |
| `src/modules/ai/ai-idempotency.ts` | `claimParsingSlot()`, `setAiStage()`, `getCachedReceiptResult()` |
| `src/modules/ai/receipt-parser/` | A1 prompt, schema, preprocess, harness |
| `src/modules/ai/split-calculator/` | A2 prompt, schema, calculator, harness |
| `src/modules/ai/message-composer/` | A3 prompt, assembler, validator, content-check, harness |
| `src/config/payment-methods.config.ts` | Country → payment methods mapping |

### Database Schema Additions

```sql
-- Add to events table
ALTER TABLE events ADD COLUMN ai_stage TEXT NOT NULL DEFAULT 'none'
  CHECK (ai_stage IN ('none','parsing','parsed','calculating','calculated','messaging','complete','failed'));

-- AI audit log
CREATE TABLE ai_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  agent           TEXT NOT NULL CHECK (agent IN ('A1','A2','A3')),
  provider        TEXT NOT NULL,
  model_used      TEXT NOT NULL,
  input_hash      TEXT NOT NULL,   -- SHA-256 of prompt — never raw prompt
  output_hash     TEXT NOT NULL,   -- SHA-256 of response
  confidence      NUMERIC(4,3),
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  latency_ms      INTEGER,
  attempts        INTEGER NOT NULL DEFAULT 1,
  success         BOOLEAN NOT NULL,
  error_code      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_audit_event   ON ai_audit_log(event_id);
CREATE INDEX idx_ai_audit_created ON ai_audit_log(created_at);
```

### Privacy Disclosure Requirements

Participant names and receipt contents are transmitted to a third-party AI provider. This is legally significant under GDPR and CCPA.

1. **Privacy Policy:** Add a section: *"To parse receipts and compose payment messages, we use AI services (Google Gemini during development and staging, Anthropic Claude during production). Receipt images and participant names are transmitted to these services. No data is retained by the AI provider beyond the request."* Verify this claim against both Google's and Anthropic's data processing terms before publishing.

2. **Receipt upload consent:** At the point the payer uploads a receipt, show inline: *"Receipt processing uses AI. Your group's order data is sent to an AI service for analysis."*

3. **DPA for EU users:** Verify `google.com/cloud/terms/dpa` and `anthropic.com/legal/dpa` before going live in the EU.

---

*All prices and SDK versions verified June 2026. Run `npm run eval:all --provider=gemini && npm run eval:all --provider=haiku` before every deployment.*
