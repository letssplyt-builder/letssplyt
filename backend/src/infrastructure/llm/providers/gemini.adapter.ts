import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
  LLMResponse,
} from '../llm.provider';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 10_000;

function isRetriable(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  if (msg.includes('api key') || msg.includes('invalid') || msg.includes('400')) {
    return false;
  }
  return true;
}

function jitteredDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return Math.random() * exponential;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiAdapter implements LLMProvider {
  readonly supportsVision = true;
  private client: GoogleGenerativeAI;

  constructor(private readonly model: string) {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, timeout = 20_000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const genModel = this.client.getGenerativeModel({
          model: this.model,
          generationConfig: { maxOutputTokens: maxTokens },
        });

        const parts = messages.flatMap((m) =>
          typeof m.content === 'string'
            ? [{ text: m.content }]
            : m.content.map((block) =>
                block.type === 'image'
                  ? { inlineData: { mimeType: block.mimeType, data: block.base64 } }
                  : { text: block.text },
              ),
        );

        const abortPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini timeout')), timeout),
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (!isRetriable(err) || attempt === MAX_ATTEMPTS) break;
        await sleep(jitteredDelay(attempt));
      }
    }

    throw lastError ?? new Error('Gemini request failed');
  }
}
